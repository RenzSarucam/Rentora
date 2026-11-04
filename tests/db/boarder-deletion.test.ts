import type { PGlite, Transaction } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, commitAs, createTestDb, one } from "./harness";
import { assign, createOrg, type Org } from "./fixture";

let db: PGlite;
let org: Org;
let other: Org;
let invoice: string;
let announcement: string;
const email = "boarder1@deletion.test";
const erase = (tx: Transaction, member: string, confirmation = email) =>
  one<{ id: string }>(tx, "select public.delete_boarder($1, $2) as id", [member, confirmation]);

beforeAll(async () => {
  db = await createTestDb();
  org = await createOrg(db, "deletion", 3);
  other = await createOrg(db, "untouched", 1);
  await db.query("update public.organization_members set role='admin' where id=$1", [org.boarders[2].memberId]);
  await assign(db, org, 0, 0);
  await assign(db, org, 1, 1);
  await assign(db, other, 0, 0);
  for (const house of [org, other]) {
    await commitAs(db, house.ownerId, (tx) => tx.query("select public.generate_monthly_invoices($1, '2026-10-01', '2026-10-05')", [house.id]));
  }
  invoice = (await one<{ id: string }>(db, "select id from public.invoices where member_id=$1", [org.boarders[0].memberId])).id;
  const prefix = `${org.id}/${org.boarders[0].memberId}`;
  const proof = `${prefix}/proof.pdf`;
  const submission = await commitAs(db, org.boarders[0].userId, (tx) => one<{ id: string }>(tx,
    "select public.submit_payment($1, 100000, 'gcash', 'DELETE-TEST-001', (now() at time zone 'Asia/Manila')::date, $2) as id", [invoice, proof]));
  await commitAs(db, org.ownerId, (tx) => tx.query("select public.approve_payment_submission($1)", [submission.id]));
  await commitAs(db, org.ownerId, async (tx) => {
    const payment = await one<{ id: string }>(tx,
      "select public.record_payment($1, 50000, 'cash', null, (now() at time zone 'Asia/Manila')::date, null, $2) as id", [org.boarders[0].memberId, invoice]);
    await tx.query("select public.void_payment($1, 'Entered twice')", [payment.id]);
    const extra = await one<{ id: string }>(tx,
      `select public.create_invoice($1, 'other', (now() at time zone 'Asia/Manila')::date, '[{"kind":"fee","description":"Test fee","amount_centavos":10000}]') as id`,
      [org.boarders[0].memberId]);
    await tx.query("select public.void_invoice($1, 'Cancelled charge')", [extra.id]);
    announcement = (await one<{ id: string }>(tx,
      "insert into public.announcements(organization_id,title,body,published_at) values($1,'House notice','Shared house notice','2020-01-01') returning id", [org.id])).id;
  });
  const repair = await commitAs(db, org.boarders[0].userId, (tx) => one<{ id: string }>(tx,
    "insert into public.maintenance_requests(member_id,title,description,photo_path) values($1,'Broken faucet','Please repair the faucet',$2) returning id",
    [org.boarders[0].memberId, `${prefix}/repair.jpg`]));
  await commitAs(db, org.ownerId, (tx) => tx.query(
    "insert into public.maintenance_updates(request_id,body) values($1,'Repair booked')", [repair.id]));
  for (const boarder of org.boarders.slice(0, 2)) {
    await commitAs(db, boarder.userId, (tx) => tx.query("select public.mark_announcement_read($1,'2020-01-01')", [announcement]));
  }
  for (const [bucket, name] of [["payment-proofs", proof], ["maintenance-photos", `${prefix}/repair.jpg`], ["payment-proofs", `${prefix}/orphan.pdf`]]) {
    await db.query("insert into storage.objects(bucket_id,name,owner) values($1,$2,$3)", [bucket, name, org.boarders[0].userId]);
  }
  await db.exec("create table auth.deletion_test_sessions(user_id uuid references auth.users(id) on delete cascade)");
  await db.query("insert into auth.deletion_test_sessions values($1),($2)", [org.boarders[0].userId, org.boarders[1].userId]);
});
afterAll(async () => { await db?.close(); });

describe("permanent boarder deletion authorization", () => {
  it.each(["boarder", "admin", "other owner", "signed out", "anonymous"])("rejects %s", async (caller) => {
    const user = caller === "boarder" ? org.boarders[0].userId : caller === "admin" ? org.boarders[2].userId : caller === "other owner" ? other.ownerId : null;
    await expect(as(db, user, (tx) => erase(tx, org.boarders[0].memberId), caller === "anonymous" ? "anon" : "authenticated"))
      .rejects.toThrow(/owner|not found|permission denied/);
  });
  it("requires the current email and never accepts an empty confirmation", async () => {
    for (const confirmation of ["", "boarder2@deletion.test"]) {
      await expect(as(db, org.ownerId, (tx) => erase(tx, org.boarders[0].memberId, confirmation))).rejects.toThrow(/Type the boarder email/);
    }
  });
  it("cannot delete owners or admins", async () => {
    const owner = await one<{ id: string }>(db, "select id from public.organization_members where user_id=$1", [org.ownerId]);
    for (const member of [owner.id, org.boarders[2].memberId]) {
      await expect(as(db, org.ownerId, (tx) => erase(tx, member))).rejects.toThrow(/Boarder not found/);
    }
  });
  it("exposes neither the private job table nor its capability helper", async () => {
    await expect(as(db, org.ownerId, (tx) => tx.query("select * from private.boarder_deletions"))).rejects.toThrow(/permission denied/);
    await expect(as(db, org.ownerId, (tx) => tx.query("select private.boarder_delete_allowed('payments','{}')"))).rejects.toThrow(/permission denied/);
    expect((await one<{ rls: boolean }>(db, "select relrowsecurity as rls from pg_class where oid='private.boarder_deletions'::regclass")).rls).toBe(true);
  });
  it("custom settings cannot bypass append-only protection", async () => {
    await expect(db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [org.ownerId]);
      await tx.exec("set local rentora.boarder_purge='on'");
      await tx.query("delete from public.payments where member_id=$1", [org.boarders[0].memberId]);
    })).rejects.toThrow(/append-only/);
  });
  it.each(["boarder_deletion_jobs(null)", "complete_boarder_deletion(null)"])("denies anonymous access to %s", async (rpc) => {
    await expect(as(db, null, (tx) => tx.query(`select public.${rpc}`), "anon")).rejects.toThrow(/permission denied/);
  });
  it("an archived owner cannot start a deletion", async () => {
    await expect(as(db, org.ownerId, async (tx) => {
      await tx.exec("reset role");
      await tx.query("update public.organization_members set status='archived',archived_at=now() where user_id=$1", [org.ownerId]);
      await tx.exec("set local role authenticated");
      await erase(tx, org.boarders[0].memberId);
    })).rejects.toThrow(/active owner/);
  });
});

describe("transactional removal and cleanup", () => {
  it("removes every application row, including paid/void records, and leaves the bed and other boarders intact", async () => {
    await as(db, org.ownerId, async (tx) => {
      const numbers = await one(tx, "select next_invoice_seq,next_receipt_seq from public.organizations where id=$1", [org.id]);
      const { id } = await erase(tx, org.boarders[0].memberId, `  ${email.toUpperCase()}  `);
      const job = await one<{ status: string; counts: { invoices: number; payments: number } }>(tx,
        "select status,counts from public.boarder_deletion_jobs($1)", [id]);
      expect(job.status).toBe("cleanup_pending");
      expect(job.counts.invoices).toBe(2);
      expect(job.counts.payments).toBe(2);
      for (const table of ["organization_members", "invoices", "payments", "payment_submissions", "boarder_assignments", "maintenance_requests", "invitations", "announcement_reads"]) {
        const key = table === "organization_members" ? "id" : "member_id";
        expect((await tx.query(`select 1 from public.${table} where ${key}=$1`, [org.boarders[0].memberId])).rows).toHaveLength(0);
      }
      expect((await tx.query("select id from public.profiles where id=$1", [org.boarders[0].userId])).rows).toHaveLength(0);
      expect((await tx.query("select id from public.beds where id=$1", [org.bedIds[0]])).rows).toHaveLength(1);
      expect(await one(tx, "select next_invoice_seq,next_receipt_seq from public.organizations where id=$1", [org.id])).toEqual(numbers);
      expect((await tx.query("select id from public.invoices where member_id=$1", [org.boarders[1].memberId])).rows).toHaveLength(1);
      expect((await tx.query("select member_id from public.announcement_reads where announcement_id=$1", [announcement])).rows).toHaveLength(0); // owners cannot read personal receipts
      expect((await tx.query("select id from public.audit_logs where action='boarder.deletion_started' and entity_id=$1", [org.boarders[0].memberId])).rows).toHaveLength(1);
      await tx.exec("reset role");
      for (const table of ["invoice_items", "payment_allocations", "maintenance_updates"]) {
        expect((await one<{ n: number }>(tx, `select count(*)::int as n from public.${table} where organization_id=$1`, [org.id])).n)
          .toBe(table === "invoice_items" ? 1 : 0);
      }
      expect((await one<{ n: number }>(tx, "select count(*)::int as n from public.announcement_reads where announcement_id=$1", [announcement])).n).toBe(1);
      expect((await one<{ n: number }>(tx, "select count(*)::int as n from auth.users where id=$1", [org.boarders[0].userId])).n).toBe(1);
      expect((await one<{ n: number }>(tx, "select count(*)::int as n from public.invoices where organization_id=$1", [other.id])).n).toBe(1);
      const capability = await one<{ tx: string | null; rows: object }>(tx,
        "select delete_transaction_id::text as tx, allowed_delete_rows as rows from private.boarder_deletions where id=$1", [id]);
      expect(capability).toEqual({ tx: null, rows: {} });
    });
  });
  it("cannot reuse the purge permission for another row in the same transaction", async () => {
    await expect(as(db, org.ownerId, async (tx) => {
      await erase(tx, org.boarders[0].memberId);
      await tx.exec("reset role");
      await tx.query("delete from public.audit_logs where organization_id=$1", [org.id]);
    })).rejects.toThrow(/append-only/);
  });
  it("keeps a resumable job until all referenced and orphaned uploads are removed", async () => {
    await expect(as(db, org.ownerId, async (tx) => {
      const { id } = await erase(tx, org.boarders[0].memberId);
      await tx.query("select public.complete_boarder_deletion($1)", [id]);
    })).rejects.toThrow(/uploads still need cleanup/);
  });
  it("finishes the login deletion after storage cleanup, clears identifying job text, and is idempotent", async () => {
    await as(db, org.ownerId, async (tx) => {
      const { id } = await erase(tx, org.boarders[0].memberId);
      await tx.exec("set local role service_role");
      await tx.query("delete from storage.objects where name like $1", [`${org.id}/${org.boarders[0].memberId}/%`]);
      await tx.exec("set local role authenticated");
      await tx.query("select public.complete_boarder_deletion($1)", [id]);
      await tx.query("select public.complete_boarder_deletion($1)", [id]);
      expect((await tx.query("select * from public.boarder_deletion_jobs()")).rows).toHaveLength(0);
      expect(await one<{ status: string; display_name: string | null }>(tx,
        "select status,display_name from public.boarder_deletion_jobs($1)", [id])).toEqual({ status: "complete", display_name: null });
      await tx.exec("reset role");
      expect((await tx.query("select id from auth.users where id=$1", [org.boarders[0].userId])).rows).toHaveLength(0);
      expect((await tx.query("select * from auth.deletion_test_sessions where user_id=$1", [org.boarders[0].userId])).rows).toHaveLength(0);
      expect((await tx.query("select * from auth.deletion_test_sessions where user_id=$1", [org.boarders[1].userId])).rows).toHaveLength(1);
      expect((await tx.query("select id from public.audit_logs where action='boarder.deleted' and entity_id=$1", [org.boarders[0].memberId])).rows).toHaveLength(1);
    });
  });
  it.each(["boarder", "admin", "other owner"])("hides cleanup jobs and rejects completion for %s", async (caller) => {
    await expect(as(db, org.ownerId, async (tx) => {
      const { id } = await erase(tx, org.boarders[0].memberId);
      const user = caller === "boarder" ? org.boarders[1].userId : caller === "admin" ? org.boarders[2].userId : other.ownerId;
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [user]);
      if (caller === "other owner") expect((await tx.query("select * from public.boarder_deletion_jobs($1)", [id])).rows).toHaveLength(0);
      else await tx.query("select * from public.boarder_deletion_jobs($1)", [id]);
      await tx.query("select public.complete_boarder_deletion($1)", [id]);
    })).rejects.toThrow(/owner|Deletion not found/);
  });
  it("rolls back the whole purge when a later dependent deletion fails", async () => {
    await expect(as(db, org.ownerId, async (tx) => {
      await tx.exec("reset role");
      await tx.exec(`create function private.test_delete_failure() returns trigger language plpgsql as $$ begin raise exception 'forced late failure'; end $$;
        create trigger test_late_failure before delete on public.profiles for each row execute function private.test_delete_failure()`);
      await tx.exec("set local role authenticated");
      await erase(tx, org.boarders[0].memberId);
    })).rejects.toThrow(/forced late failure/);
    expect((await db.query("select id from public.organization_members where id=$1", [org.boarders[0].memberId])).rows).toHaveLength(1);
    expect((await db.query("select id from public.payments where member_id=$1", [org.boarders[0].memberId])).rows).toHaveLength(2);
    expect((await db.query("select id from private.boarder_deletions")).rows).toHaveLength(0);
  });
  it("rejects a cross-boarder financial link instead of changing another person's balance", async () => {
    await expect(as(db, org.ownerId, async (tx) => {
      await tx.exec("reset role");
      const otherInvoice = await one<{ id: string }>(tx, "select id from public.invoices where member_id=$1", [org.boarders[1].memberId]);
      const payment = await one<{ id: string }>(tx,
        "insert into public.payments(organization_id,member_id,amount_centavos,method,received_on,receipt_number) values($1,$2,1,'cash',current_date,'TEST-CROSS-LINK') returning id",
        [org.id, org.boarders[0].memberId]);
      await tx.query("insert into public.payment_allocations(organization_id,payment_id,invoice_id,amount_centavos) values($1,$2,$3,1)", [org.id, payment.id, otherInvoice.id]);
      await tx.exec("set local role authenticated");
      await erase(tx, org.boarders[0].memberId);
    })).rejects.toThrow(/linked to another account/);
    expect((await db.query("select id from private.boarder_deletions")).rows).toHaveLength(0);
  });
  it("the old boarder token loses row and upload access before account cleanup", async () => {
    await expect(as(db, org.ownerId, async (tx) => {
      await erase(tx, org.boarders[0].memberId);
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [org.boarders[0].userId]);
      expect((await tx.query("select id from public.invoices")).rows).toHaveLength(0);
      expect((await tx.query("select id from public.profiles")).rows).toHaveLength(0);
      await tx.query("insert into storage.objects(bucket_id,name) values('payment-proofs',$1)", [`${org.id}/${org.boarders[0].memberId}/late.pdf`]);
    })).rejects.toThrow(/row-level security/);
  });
  it("does not start erasing an account that recorded another boarder's payment", async () => {
    await expect(as(db, org.ownerId, async (tx) => {
      await tx.exec("reset role");
      await tx.query("insert into public.payments(organization_id,member_id,amount_centavos,method,received_on,receipt_number,recorded_by) values($1,$2,1,'cash',current_date,'TEST-OLD-STAFF',$3)",
        [org.id, org.boarders[1].memberId, org.boarders[0].userId]);
      await tx.exec("set local role authenticated");
      await erase(tx, org.boarders[0].memberId);
    })).rejects.toThrow(/linked to another account/);
  });
});
