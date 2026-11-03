import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { as, commitAs, createTestDb, one } from "./harness";
import { assign, createOrg, type Org } from "./fixture";

// The receipt page (/receipts/[id]) loads a payment and its related rows as the signed-in user.
// These tests pin down exactly what each kind of viewer can see.

let db: PGlite;
let org: Org;
let other: Org;
let paymentId: string;

beforeAll(async () => {
  db = await createTestDb();
  org = await createOrg(db, "rcpt", 2);
  other = await createOrg(db, "rcpt-other", 1);
  await assign(db, org, 0, 0);
  await commitAs(db, org.ownerId, (tx) => tx.query(`select public.generate_monthly_invoices($1, '2026-10-01', '2026-10-05')`, [org.id]));
  paymentId = await commitAs(db, org.ownerId, async (tx) =>
    (await one<{ id: string }>(tx, `select public.record_payment($1, 200000, 'cash', null, '2026-10-02', 'Paid at the office') as id`, [org.boarders[0].memberId])).id,
  );
});

const receiptRows = (tx: Parameters<Parameters<typeof as>[2]>[0], id: string) =>
  Promise.all([
    tx.query(`select id, organization_id, recorded_by from public.payments where id = $1`, [id]),
    tx.query(`select pa.amount_centavos, i.invoice_number from public.payment_allocations pa join public.invoices i on i.id = pa.invoice_id where pa.payment_id = $1`, [id]),
    tx.query(`select name from public.organizations`),
    tx.query(`select name, address from public.properties`),
  ]);

describe("receipt visibility", () => {
  it("the paying boarder sees the payment, its allocations, org and property, but not the staff member's profile", async () => {
    await as(db, org.boarders[0].userId, async (tx) => {
      const [payment, allocations, orgs, props] = await receiptRows(tx, paymentId);
      expect(payment.rows).toHaveLength(1);
      expect(allocations.rows).toHaveLength(1);
      expect(orgs.rows).toHaveLength(1);
      expect(props.rows).toHaveLength(1);
      const recorder = (payment.rows[0] as { recorded_by: string }).recorded_by;
      expect(recorder).toBe(org.ownerId);
      const profile = await tx.query(`select full_name from public.profiles where id = $1`, [recorder]);
      expect(profile.rows).toHaveLength(0);
    });
  });

  it("staff see the recorder's name", async () => {
    await as(db, org.ownerId, async (tx) => {
      const profile = await tx.query<{ full_name: string }>(`select full_name from public.profiles where id = $1`, [org.ownerId]);
      expect(profile.rows[0]?.full_name).toBe("Owner rcpt");
    });
  });

  it("another boarder in the same house and staff of another organization see nothing", async () => {
    for (const userId of [org.boarders[1].userId, other.ownerId, other.boarders[0].userId]) {
      await as(db, userId, async (tx) => {
        const [payment, allocations] = await receiptRows(tx, paymentId);
        expect(payment.rows).toHaveLength(0);
        expect(allocations.rows).toHaveLength(0);
      });
    }
  });

  it("a voided payment stays readable (shown as VOID) and its invoice reopens", async () => {
    await as(db, org.ownerId, async (tx) => {
      await tx.query(`select public.void_payment($1, 'Wrong boarder')`, [paymentId]);
      const row = await one<{ voided: boolean; status: string }>(
        tx,
        `select p.voided_at is not null as voided, i.status::text as status
         from public.payments p join public.payment_allocations pa on pa.payment_id = p.id join public.invoices i on i.id = pa.invoice_id
         where p.id = $1`,
        [paymentId],
      );
      expect(row).toEqual({ voided: true, status: "open" });
    });
  });
});

describe("billing screens' writes", () => {
  it("staff can move a due date on an unpaid invoice but not before its issue date", async () => {
    const inv = await one<{ id: string; issue_date: string }>(db, `select id, issue_date::text from public.invoices where organization_id = $1 limit 1`, [org.id]);
    await as(db, org.ownerId, async (tx) => {
      const res = await tx.query(`update public.invoices set due_date = '2026-10-20' where id = $1 and status in ('open','partially_paid')`, [inv.id]);
      expect(res.affectedRows).toBe(1);
    });
    await expect(
      as(db, org.ownerId, (tx) => tx.query(`update public.invoices set due_date = (issue_date - 1) where id = $1`, [inv.id])),
    ).rejects.toThrow(/check constraint/);
  });

  it("staff cannot change an invoice's money columns directly", async () => {
    await expect(as(db, org.ownerId, (tx) => tx.query(`update public.invoices set total_centavos = 1`))).rejects.toThrow(/permission denied/);
  });

  it("create_invoice stores discounts negative and totals the lines", async () => {
    await as(db, org.ownerId, async (tx) => {
      const id = (
        await one<{ id: string }>(
          tx,
          `select public.create_invoice($1, 'other', '2026-11-10', $2::jsonb) as id`,
          [
            org.boarders[1].memberId,
            JSON.stringify([
              { kind: "fee", description: "Key replacement", amount_centavos: 25000 },
              { kind: "discount", description: "Goodwill", amount_centavos: -5000 },
            ]),
          ],
        )
      ).id;
      const inv = await one<{ total: number }>(tx, `select total_centavos::int as total from public.invoices where id = $1`, [id]);
      expect(inv.total).toBe(20000);
    });
  });
});
