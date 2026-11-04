import type { PGlite, Transaction } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, commitAs, createTestDb, one } from "./harness";
import { assign, createOrg, type Org } from "./fixture";

let db: PGlite;
let org: Org;
let other: Org;
let ownerMember: string;
let gcashPath: string;
let bankPath: string;
let invoice: string;
let rent: string;
const today = "(now() at time zone 'Asia/Manila')::date";
const save = (tx: Transaction, organization: string, method: string, path: string) => tx.query(
  "insert into public.payment_receiving_accounts(organization_id,method,account_name,institution_name,qr_path) values($1,$2,'QR Test Receiver',$3,$4)",
  [organization, method, method === "bank_transfer" ? "MariBank" : "GCash", path]);
const submit = (tx: Transaction, amount: number, method = "gcash", reference = "QR-TEST-001") => one<{ id: string }>(tx,
  `select public.submit_payment($1,$2,$3,$4,${today},$5) as id`,
  [invoice, amount, method, reference, `${org.id}/${org.boarders[0].memberId}/${crypto.randomUUID()}.png`]);

beforeAll(async () => {
  db = await createTestDb();
  org = await createOrg(db, "qr", 3);
  other = await createOrg(db, "qr-other", 1);
  ownerMember = (await one<{ id: string }>(db, "select id from public.organization_members where user_id=$1", [org.ownerId])).id;
  await db.query("update public.organization_members set role='admin' where id=$1", [org.boarders[2].memberId]);
  gcashPath = `${org.id}/${ownerMember}/${crypto.randomUUID()}.png`;
  bankPath = `${org.id}/${ownerMember}/${crypto.randomUUID()}.jpg`;
  await commitAs(db, org.ownerId, async (tx) => {
    for (const path of [gcashPath, bankPath, `${org.id}/${ownerMember}/${crypto.randomUUID()}.png`]) {
      // Returning the inserted row also checks owner read access before it is referenced.
      await tx.query("insert into storage.objects(bucket_id,name) values('payment-qrs',$1) returning id", [path]);
    }
    await save(tx, org.id, "gcash", gcashPath);
    await save(tx, org.id, "bank_transfer", bankPath);
  });
  await assign(db, org, 0, 0);
  await commitAs(db, org.ownerId, async (tx) => {
    await tx.query("select public.generate_monthly_invoices($1,'2026-10-01','2026-10-05')", [org.id]);
    invoice = (await one<{ id: string }>(tx,
      `select public.create_invoice($1,'other',${today},'[{"kind":"fee","description":"Utilities","amount_centavos":50000}]') as id`, [org.boarders[0].memberId])).id;
    rent = (await one<{ id: string }>(tx, "select id from public.invoices where member_id=$1 and kind='rent'", [org.boarders[0].memberId])).id;
  });
});
afterAll(async () => { await db?.close(); });

describe("receiving account and QR isolation", () => {
  it("has RLS and exposes no table or QR access to anonymous callers", async () => {
    expect((await one<{ rls: boolean }>(db,
      "select relrowsecurity as rls from pg_class where oid='public.payment_receiving_accounts'::regclass")).rls).toBe(true);
    await expect(as(db, null, (tx) => tx.query("select * from public.payment_receiving_accounts"), "anon")).rejects.toThrow(/permission denied/);
  });
  it.each(["boarder", "admin", "owner"])("allows %s to read only the house's current receiving images", async (role) => {
    const user = role === "boarder" ? org.boarders[0].userId : role === "admin" ? org.boarders[2].userId : org.ownerId;
    await as(db, user, async (tx) => {
      expect((await tx.query("select method from public.payment_receiving_accounts")).rows).toHaveLength(2);
      const images = await tx.query("select name from storage.objects where bucket_id='payment-qrs'");
      expect(images.rows).toHaveLength(role === "owner" ? 3 : 2);
    });
  });
  it("keeps another organization's details and known QR paths invisible", async () => {
    await as(db, other.ownerId, async (tx) => {
      expect((await tx.query("select * from public.payment_receiving_accounts")).rows).toHaveLength(0);
      expect((await tx.query("select name from storage.objects where name=$1", [gcashPath])).rows).toHaveLength(0);
    });
  });
  it.each(["boarder", "admin", "other owner"])("prevents %s from changing the receiving account", async (role) => {
    const user = role === "boarder" ? org.boarders[0].userId : role === "admin" ? org.boarders[2].userId : other.ownerId;
    await as(db, user, async (tx) => {
      const update = await tx.query("update public.payment_receiving_accounts set account_name='Hijacked' where organization_id=$1", [org.id]);
      expect(update.affectedRows).toBe(0);
    });
    await expect(as(db, user, (tx) => save(tx, org.id, "gcash", `${org.id}/${ownerMember}/${crypto.randomUUID()}.png`)))
      .rejects.toThrow(/row-level security/);
  });
  it("allows an owner to replace their own receiving details", async () => {
    await as(db, org.ownerId, async (tx) => {
      expect((await tx.query("update public.payment_receiving_accounts set account_name='Updated QR Receiver' where organization_id=$1", [org.id])).affectedRows).toBe(2);
    });
  });
  it("rejects another organization or a boarder's folder as a receiving QR path", async () => {
    for (const path of [`${other.id}/${ownerMember}/${crypto.randomUUID()}.png`, `${org.id}/${org.boarders[0].memberId}/${crypto.randomUUID()}.png`]) {
      await expect(as(db, org.ownerId, (tx) => tx.query("update public.payment_receiving_accounts set qr_path=$1 where organization_id=$2 and method='gcash'", [path, org.id])))
        .rejects.toThrow(/row-level security|check constraint/);
    }
  });
  it.each(["boarder", "admin", "other owner"])("rejects QR uploads from %s into the owner's folder", async (role) => {
    const user = role === "boarder" ? org.boarders[0].userId : role === "admin" ? org.boarders[2].userId : other.ownerId;
    await expect(as(db, user, (tx) => tx.query("insert into storage.objects(bucket_id,name) values('payment-qrs',$1)",
      [`${org.id}/${ownerMember}/${crypto.randomUUID()}.png`]))).rejects.toThrow(/row-level security/);
  });
  it("does not expose receiving data to archived members", async () => {
    await as(db, org.ownerId, async (tx) => {
      await tx.query("select public.set_boarder_archived($1,true)", [org.boarders[1].memberId]);
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [org.boarders[1].userId]);
      expect((await tx.query("select * from public.payment_receiving_accounts")).rows).toHaveLength(0);
      expect((await tx.query("select * from storage.objects where bucket_id='payment-qrs'")).rows).toHaveLength(0);
    });
  });
  it("blocks overwrites, direct deletion, and non-image or nested upload paths", async () => {
    await as(db, org.ownerId, async (tx) => {
      expect((await tx.query("delete from storage.objects where name=$1", [gcashPath])).affectedRows).toBe(0);
      expect((await tx.query("update storage.objects set name='changed' where name=$1", [gcashPath])).affectedRows).toBe(0);
    });
    for (const suffix of ["fake.svg", "nested/image.png", "../image.png"]) {
      await expect(as(db, org.ownerId, (tx) => tx.query("insert into storage.objects(bucket_id,name) values('payment-qrs',$1)",
        [`${org.id}/${ownerMember}/${suffix}`]))).rejects.toThrow(/row-level security/);
    }
  });
});

describe("exact manual QR payment amounts", () => {
  it.each(["maya", "other", "cash"])("rejects %s for new boarder submissions", async (method) => {
    await expect(as(db, org.boarders[0].userId, (tx) => submit(tx, 25025, method))).rejects.toThrow(/Choose GCash or bank transfer/);
  });
  it("requires ownership even if the caller knows the invoice ID", async () => {
    for (const user of [org.ownerId, other.boarders[0].userId, null]) {
      await expect(as(db, user, (tx) => submit(tx, 25025))).rejects.toThrow(/Not authorized/);
    }
  });
  it("reserves the exact partial amount and prevents excess payment on this bill", async () => {
    await as(db, org.boarders[0].userId, async (tx) => {
      await submit(tx, 25025);
      const row = await one<{ amount: number; paid: number }>(tx,
        "select (select amount_centavos::int from public.payment_submissions where invoice_id=$1) as amount,amount_paid_centavos::int as paid from public.invoices where id=$1", [invoice]);
      expect(row).toEqual({ amount: 25025, paid: 0 });
    });
    await expect(as(db, org.boarders[0].userId, async (tx) => {
      await submit(tx, 25025);
      await submit(tx, 25000, "bank_transfer", "QR-TEST-002");
    })).rejects.toThrow(/remaining amount on this bill/);
  });
  it("credits only the approved exact amount to the selected bill", async () => {
    await as(db, org.boarders[0].userId, async (tx) => {
      const first = await submit(tx, 25025);
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [org.ownerId]);
      await tx.query("select public.approve_payment_submission($1)", [first.id]);
      expect((await one<{ paid: number }>(tx, "select amount_paid_centavos::int as paid from public.invoices where id=$1", [invoice])).paid).toBe(25025);
      expect((await one<{ paid: number }>(tx, "select amount_paid_centavos::int as paid from public.invoices where id=$1", [rent])).paid).toBe(0);
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [org.boarders[0].userId]);
      const second = await submit(tx, 24975, "bank_transfer", "QR-TEST-003");
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [org.ownerId]);
      await tx.query("select public.approve_payment_submission($1)", [second.id]);
      expect(await one(tx, "select amount_paid_centavos::int as paid,status::text from public.invoices where id=$1", [invoice])).toEqual({ paid: 50000, status: "paid" });
      expect((await one<{ paid: number }>(tx, "select amount_paid_centavos::int as paid from public.invoices where id=$1", [rent])).paid).toBe(0);
    });
  });
});
