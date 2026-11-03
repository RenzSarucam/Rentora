import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { as, createTestDb, one } from "./harness";
import { assign, createOrg, type Org } from "./fixture";

let db: PGlite;
let org: Org;
let other: Org;

beforeAll(async () => {
  db = await createTestDb();
  org = await createOrg(db, "admin", 2);
  other = await createOrg(db, "elsewhere", 1);
  await assign(db, org, 0, 0);
});

describe("staff management of boarders (writes used by the Boarders screens)", () => {
  it("staff can edit a boarder's contact details and notes, but not their email", async () => {
    const b = org.boarders[0];
    await as(db, org.ownerId, async (tx) => {
      const p = await tx.query(
        `update public.profiles set full_name = 'Maria Santos', phone = '09171234567', emergency_contact_name = 'Lorna Santos', emergency_contact_phone = '09181234567' where id = $1`,
        [b.userId],
      );
      expect(p.affectedRows).toBe(1);
      const n = await tx.query(`update public.organization_members set notes = 'Night shift nurse' where id = $1`, [b.memberId]);
      expect(n.affectedRows).toBe(1);
    });
    await expect(
      as(db, org.ownerId, (tx) => tx.query(`update public.profiles set email = 'x@x.test' where id = $1`, [b.userId])),
    ).rejects.toThrow(/permission denied/);
  });

  it("staff of another organization cannot edit or even find the boarder", async () => {
    const b = org.boarders[0];
    await as(db, other.ownerId, async (tx) => {
      expect((await tx.query(`update public.profiles set phone = '0' where id = $1`, [b.userId])).affectedRows).toBe(0);
      expect((await tx.query(`update public.organization_members set notes = 'x' where id = $1`, [b.memberId])).affectedRows).toBe(0);
      expect((await tx.query(`select id from public.profiles where email = $1`, ["boarder1@admin.test"])).rows).toHaveLength(0);
    });
  });

  it("a boarder cannot write notes about themselves", async () => {
    await as(db, org.boarders[0].userId, async (tx) => {
      expect((await tx.query(`update public.organization_members set notes = 'x' where id = $1`, [org.boarders[0].memberId])).affectedRows).toBe(0);
    });
  });

  it("rent changes only touch future billing: issued invoices keep their snapshot", async () => {
    await as(db, org.ownerId, async (tx) => {
      await tx.query(`select public.generate_monthly_invoices($1, '2026-10-01', '2026-10-05')`, [org.id]);
      await tx.query(`update public.boarder_assignments set monthly_rent_centavos = 400000 where member_id = $1 and move_out_date is null`, [
        org.boarders[0].memberId,
      ]);
      const oct = await one<{ total: number }>(
        tx,
        `select total_centavos::int as total from public.invoices where member_id = $1 and period_month = '2026-10-01'`,
        [org.boarders[0].memberId],
      );
      expect(oct.total).toBe(350000);
      await tx.query(`select public.generate_monthly_invoices($1, '2026-11-01', '2026-11-05')`, [org.id]);
      const nov = await one<{ total: number }>(
        tx,
        `select total_centavos::int as total from public.invoices where member_id = $1 and period_month = '2026-11-01'`,
        [org.boarders[0].memberId],
      );
      expect(nov.total).toBe(400000);
    });
  });

  it("restoring an archived boarder who never accepted keeps them invited", async () => {
    const b = org.boarders[1];
    await db.query(`update public.organization_members set status = 'invited' where id = $1`, [b.memberId]);
    await db.query(`update public.invitations set accepted_at = null where member_id = $1`, [b.memberId]);
    await as(db, org.ownerId, async (tx) => {
      await tx.query(`select public.set_boarder_archived($1, true)`, [b.memberId]);
      await tx.query(`select public.set_boarder_archived($1, false)`, [b.memberId]);
      const s = await one<{ status: string }>(tx, `select status::text from public.organization_members where id = $1`, [b.memberId]);
      expect(s.status).toBe("invited");
    });
  });
});
