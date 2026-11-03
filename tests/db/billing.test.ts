import type { PGlite, Transaction } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { as, commitAs, createTestDb, one } from "./harness";
import { assign, createOrg, type Org } from "./fixture";

let db: PGlite;
let org: Org;
let other: Org;
let invoiceId: string;

const invoice = (q: Pick<Transaction, "query">, id: string) =>
  one<{ total_centavos: number; amount_paid_centavos: number; status: string }>(
    q,
    `select total_centavos::int, amount_paid_centavos::int, status::text from public.invoices where id = $1`,
    [id],
  );

beforeAll(async () => {
  db = await createTestDb();
  org = await createOrg(db, "bill", 3);
  other = await createOrg(db, "other", 1);
  await assign(db, org, 0, 0);
  await assign(db, org, 1, 1);
  await commitAs(db, org.ownerId, (tx) => tx.query(`select public.generate_monthly_invoices($1, '2026-10-01', '2026-10-05')`, [org.id]));
  invoiceId = (
    await one<{ id: string }>(db, `select id from public.invoices where member_id = $1 and period_month = '2026-10-01'`, [
      org.boarders[0].memberId,
    ])
  ).id;
});

describe("monthly invoice generation", () => {
  it("creates one rent invoice per current assignment with the rent snapshot", async () => {
    const rows = await db.query<{ invoice_number: string; total_centavos: number; status: string }>(
      `select invoice_number, total_centavos::int, status::text from public.invoices where organization_id = $1 order by invoice_number`,
      [org.id],
    );
    expect(rows.rows).toHaveLength(2);
    expect(rows.rows.map((r) => r.total_centavos)).toEqual([350000, 350000]);
    expect(rows.rows.every((r) => r.status === "open")).toBe(true);
    expect(rows.rows[0].invoice_number).toMatch(/^INV-\d{4}-000001$/);
  });

  it("is idempotent: running it again creates nothing", async () => {
    const created = await commitAs(db, org.ownerId, async (tx) =>
      (await one<{ n: number }>(tx, `select public.generate_monthly_invoices($1, '2026-10-01', '2026-10-05') as n`, [org.id])).n,
    );
    expect(created).toBe(0);
    const n = await one<{ n: number }>(db, `select count(*)::int as n from public.invoices where organization_id = $1`, [org.id]);
    expect(n.n).toBe(2);
  });

  it("the unique index blocks a duplicate rent invoice even outside the RPC", async () => {
    const a = await one<{ id: string }>(db, `select assignment_id as id from public.invoices where id = $1`, [invoiceId]);
    await expect(
      db.query(
        `insert into public.invoices (organization_id, member_id, assignment_id, kind, invoice_number, period_month, issue_date, due_date)
         values ($1, $2, $3, 'rent', 'DUP-1', '2026-10-01', '2026-10-01', '2026-10-05')`,
        [org.id, org.boarders[0].memberId, a.id],
      ),
    ).rejects.toThrow(/invoices_one_rent_per_period/);
  });

  it("changing the room rate later does not change issued invoices", async () => {
    await as(db, org.ownerId, async (tx) => {
      await tx.query(`update public.rooms set monthly_rate_centavos = 999900 where id = $1`, [org.roomId]);
      await tx.query(`update public.beds set monthly_rate_centavos = 999900 where room_id = $1`, [org.roomId]);
      expect((await invoice(tx, invoiceId)).total_centavos).toBe(350000);
    });
  });
});

describe("fees, discounts and deposits", () => {
  it("adds a fee and a discount and recomputes the total", async () => {
    await as(db, org.ownerId, async (tx) => {
      await tx.query(`select public.add_invoice_item($1, 'fee', 'Electricity (Oct)', 45050)`, [invoiceId]);
      await tx.query(`select public.add_invoice_item($1, 'discount', 'Early payment', -10000)`, [invoiceId]);
      expect((await invoice(tx, invoiceId)).total_centavos).toBe(350000 + 45050 - 10000);
    });
  });

  it("rejects a discount larger than the charges", async () => {
    await expect(
      as(db, org.ownerId, (tx) => tx.query(`select public.add_invoice_item($1, 'discount', 'Too much', -400000)`, [invoiceId])),
    ).rejects.toThrow(/Discounts cannot exceed/);
  });

  it("rejects a positive discount and a negative fee", async () => {
    await expect(
      as(db, org.ownerId, (tx) => tx.query(`select public.add_invoice_item($1, 'discount', 'Wrong sign', 100)`, [invoiceId])),
    ).rejects.toThrow(/check constraint/);
    await expect(
      as(db, org.ownerId, (tx) => tx.query(`select public.add_invoice_item($1, 'fee', 'Wrong sign', -100)`, [invoiceId])),
    ).rejects.toThrow(/check constraint/);
  });

  it("records a security deposit as its own invoice", async () => {
    await as(db, org.ownerId, async (tx) => {
      const id = (
        await one<{ id: string }>(
          tx,
          `select public.create_invoice($1, 'deposit', '2026-10-10', '[{"kind":"deposit","description":"Security deposit (1 month)","amount_centavos":350000}]'::jsonb) as id`,
          [org.boarders[2].memberId],
        )
      ).id;
      expect(await invoice(tx, id)).toMatchObject({ total_centavos: 350000, status: "open" });
    });
  });
});

describe("cash payments", () => {
  it("supports partial payments and settles the invoice when fully paid", async () => {
    await as(db, org.ownerId, async (tx) => {
      const member = org.boarders[0].memberId;
      const p1 = (
        await one<{ id: string }>(tx, `select public.record_payment($1, 150000, 'cash', null, '2026-10-02') as id`, [member])
      ).id;
      expect(await invoice(tx, invoiceId)).toMatchObject({ amount_paid_centavos: 150000, status: "partially_paid" });
      const receipt = await one<{ receipt_number: string }>(tx, `select receipt_number from public.payments where id = $1`, [p1]);
      expect(receipt.receipt_number).toMatch(/^OR-\d{4}-000001$/);

      await tx.query(`select public.record_payment($1, 200000, 'cash', null, '2026-10-03')`, [member]);
      expect(await invoice(tx, invoiceId)).toMatchObject({ amount_paid_centavos: 350000, status: "paid" });
    });
  });

  it("rejects paying more than the outstanding balance", async () => {
    await expect(
      as(db, org.ownerId, (tx) => tx.query(`select public.record_payment($1, 350001, 'cash', null, '2026-10-02')`, [org.boarders[0].memberId])),
    ).rejects.toThrow(/more than the boarder's outstanding balance/);
  });

  it("rejects zero, negative and future-dated payments", async () => {
    const m = org.boarders[0].memberId;
    await expect(as(db, org.ownerId, (tx) => tx.query(`select public.record_payment($1, 0, 'cash', null, '2026-10-02')`, [m]))).rejects.toThrow(
      /greater than zero/,
    );
    await expect(as(db, org.ownerId, (tx) => tx.query(`select public.record_payment($1, -5, 'cash', null, '2026-10-02')`, [m]))).rejects.toThrow(
      /greater than zero/,
    );
    await expect(as(db, org.ownerId, (tx) => tx.query(`select public.record_payment($1, 100, 'cash', null, '2999-01-01')`, [m]))).rejects.toThrow(
      /future/,
    );
  });

  it("voiding a payment reopens the invoice; payments cannot be edited", async () => {
    await as(db, org.ownerId, async (tx) => {
      const p = (
        await one<{ id: string }>(tx, `select public.record_payment($1, 350000, 'cash', null, '2026-10-02') as id`, [org.boarders[0].memberId])
      ).id;
      expect((await invoice(tx, invoiceId)).status).toBe("paid");
      await tx.query(`select public.void_payment($1, 'Recorded on wrong boarder')`, [p]);
      expect(await invoice(tx, invoiceId)).toMatchObject({ amount_paid_centavos: 0, status: "open" });
      await expect(tx.query(`select public.void_payment($1, 'again')`, [p])).rejects.toThrow(/already void/);
    });
  });

  it("an invoice with payments cannot be voided", async () => {
    await expect(
      as(db, org.ownerId, async (tx) => {
        await tx.query(`select public.record_payment($1, 1000, 'cash', null, '2026-10-02')`, [org.boarders[0].memberId]);
        await tx.query(`select public.void_invoice($1, 'mistake')`, [invoiceId]);
      }),
    ).rejects.toThrow(/Void the payments/);
  });
});

describe("payment submissions", () => {
  const proofPath = () => `${org.id}/${org.boarders[0].memberId}/proof.jpg`;

  async function submit(tx: Transaction, amount: number, ref: string, path = proofPath()) {
    return (
      await one<{ id: string }>(tx, `select public.submit_payment($1, $2, 'gcash', $3, (now() at time zone 'Asia/Manila')::date, $4) as id`, [
        invoiceId,
        amount,
        ref,
        path,
      ])
    ).id;
  }

  it("boarder submits, owner approves exactly once", async () => {
    const subId = await commitAs(db, org.boarders[0].userId, (tx) => submit(tx, 100000, "GC-1000001"));
    const paymentId = await commitAs(db, org.ownerId, async (tx) =>
      (await one<{ id: string }>(tx, `select public.approve_payment_submission($1) as id`, [subId])).id,
    );
    expect(paymentId).toBeTruthy();
    expect(await invoice(db, invoiceId)).toMatchObject({ amount_paid_centavos: 100000, status: "partially_paid" });

    await expect(
      as(db, org.ownerId, (tx) => tx.query(`select public.approve_payment_submission($1)`, [subId])),
    ).rejects.toThrow(/already approved/);
    await expect(
      as(db, org.ownerId, (tx) => tx.query(`select public.reject_payment_submission($1, 'no')`, [subId])),
    ).rejects.toThrow(/already approved/);

    const posted = await one<{ n: number }>(db, `select count(*)::int as n from public.payments where submission_id = $1`, [subId]);
    expect(posted.n).toBe(1);
  });

  it("the same transaction reference cannot be submitted twice", async () => {
    await expect(as(db, org.boarders[0].userId, (tx) => submit(tx, 1000, "gc-1000001"))).rejects.toThrow(/submissions_reference_unique/);
  });

  it("a boarder cannot submit for someone else's invoice or into someone else's folder", async () => {
    await expect(as(db, org.boarders[1].userId, (tx) => submit(tx, 1000, "GC-2000001"))).rejects.toThrow(/Not authorized/);
    await expect(
      as(db, org.boarders[0].userId, (tx) => submit(tx, 1000, "GC-2000002", `${org.id}/${org.boarders[1].memberId}/x.jpg`)),
    ).rejects.toThrow(/Invalid proof file/);
  });

  it("a boarder cannot submit more than their balance minus pending submissions", async () => {
    await expect(
      as(db, org.boarders[0].userId, async (tx) => {
        await submit(tx, 200000, "GC-3000001");
        await submit(tx, 60000, "GC-3000002"); // 250000 left, 200000 pending
      }),
    ).rejects.toThrow(/more than your unpaid balance/);
  });

  it("rejection requires a reason and frees the reference for a corrected submission", async () => {
    const subId = await commitAs(db, org.boarders[0].userId, (tx) => submit(tx, 5000, "GC-4000001"));
    await expect(as(db, org.ownerId, (tx) => tx.query(`select public.reject_payment_submission($1, '  ')`, [subId]))).rejects.toThrow(
      /why it was rejected/,
    );
    await commitAs(db, org.ownerId, (tx) => tx.query(`select public.reject_payment_submission($1, 'Amount does not match screenshot')`, [subId]));
    await as(db, org.boarders[0].userId, (tx) => submit(tx, 5000, "GC-4000001"));
  });

  it("staff of another organization cannot approve", async () => {
    const subId = await commitAs(db, org.boarders[0].userId, (tx) => submit(tx, 1000, "GC-5000001"));
    await expect(
      as(db, other.ownerId, (tx) => tx.query(`select public.approve_payment_submission($1)`, [subId])),
    ).rejects.toThrow(/Not authorized/);
  });
});

describe("financial consistency", () => {
  it("allocations always equal the invoice's amount paid and never exceed totals", async () => {
    const res = await db.query<{ bad: number }>(`
      select count(*)::int as bad from public.invoices i
      where i.amount_paid_centavos <> coalesce((
        select sum(pa.amount_centavos) from public.payment_allocations pa join public.payments p on p.id = pa.payment_id
        where pa.invoice_id = i.id and p.voided_at is null), 0)
        or i.amount_paid_centavos > i.total_centavos`);
    expect(res.rows[0].bad).toBe(0);
  });

  it("payments and allocations are immutable, even for the database owner", async () => {
    const n = await one<{ n: number }>(db, `select count(*)::int as n from public.payment_allocations`);
    expect(n.n).toBeGreaterThan(0); // the approved submission above
    await expect(db.query(`delete from public.payments`)).rejects.toThrow(/append-only/);
    await expect(db.query(`update public.payment_allocations set amount_centavos = 1`)).rejects.toThrow(/append-only/);
    await expect(db.query(`update public.payments set amount_centavos = 1`)).rejects.toThrow(/cannot be edited/);
  });
});
