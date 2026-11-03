import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { as, createTestDb, one } from "./harness";
import { assign, createOrg, type Org } from "./fixture";

let db: PGlite;
let a: Org;
let b: Org;

beforeAll(async () => {
  db = await createTestDb();
  a = await createOrg(db, "alpha");
  b = await createOrg(db, "bravo");
  await assign(db, a, 0, 0);
  await assign(db, a, 1, 1);
  await assign(db, b, 0, 0);
  // One invoice each so boarders have financial rows.
  await db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [a.ownerId]);
    await tx.exec(`set local role authenticated`);
    await tx.query(`select public.generate_monthly_invoices($1, '2026-10-01', '2026-10-05')`, [a.id]);
  });
  await db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [b.ownerId]);
    await tx.exec(`set local role authenticated`);
    await tx.query(`select public.generate_monthly_invoices($1, '2026-10-01', '2026-10-05')`, [b.id]);
  });
});

const count = async (tx: { query: PGlite["query"] }, table: string) =>
  Number((await one<{ n: number }>(tx, `select count(*)::int as n from ${table}`)).n);

describe("anonymous callers", () => {
  it.each([
    "public.organizations",
    "public.profiles",
    "public.rooms",
    "public.invoices",
    "public.payments",
    "public.audit_logs",
  ])("cannot read %s", async (table) => {
    await expect(as(db, null, (tx) => tx.query(`select * from ${table}`), "anon")).rejects.toThrow(/permission denied/);
  });

  it("cannot call RPCs", async () => {
    await expect(
      as(db, null, (tx) => tx.query(`select public.generate_monthly_invoices($1, '2026-11-01', '2026-11-05')`, [a.id]), "anon"),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("organization isolation", () => {
  it("an owner sees only their own organization's data", async () => {
    await as(db, a.ownerId, async (tx) => {
      expect(await count(tx, "public.organizations")).toBe(1);
      expect(await count(tx, "public.rooms")).toBe(1);
      expect(await count(tx, "public.invoices")).toBe(2);
      const orgs = await tx.query<{ id: string }>(`select distinct organization_id as id from public.invoices`);
      expect(orgs.rows.map((r) => r.id)).toEqual([a.id]);
      const profiles = await tx.query<{ email: string }>(`select email from public.profiles order by email`);
      expect(profiles.rows.every((p) => p.email.endsWith("@alpha.test"))).toBe(true);
    });
  });

  it("an owner cannot run staff RPCs against another organization", async () => {
    await expect(
      as(db, a.ownerId, (tx) => tx.query(`select public.generate_monthly_invoices($1, '2026-11-01', '2026-11-05')`, [b.id])),
    ).rejects.toThrow(/Not authorized/);
    await expect(
      as(db, a.ownerId, (tx) => tx.query(`select public.create_room($1, 'X1', null, 1, 100000)`, [b.propertyId])),
    ).rejects.toThrow(/Not authorized/);
    await expect(
      as(db, a.ownerId, (tx) =>
        tx.query(`select public.record_payment($1, 1000, 'cash', null, '2026-10-02')`, [b.boarders[0].memberId]),
      ),
    ).rejects.toThrow(/Not authorized/);
  });

  it("an owner cannot update another organization's rows", async () => {
    await as(db, a.ownerId, async (tx) => {
      const res = await tx.query(`update public.rooms set notes = 'hijack' where id = $1`, [b.roomId]);
      expect(res.affectedRows).toBe(0);
    });
  });

  it("an owner cannot insert rows into another organization", async () => {
    await expect(
      as(db, a.ownerId, (tx) =>
        tx.query(`insert into public.announcements (organization_id, title, body) values ($1, 'Hello there', 'x')`, [b.id]),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("boarder isolation", () => {
  it("a boarder sees only their own invoices, assignment and room", async () => {
    const me = a.boarders[0];
    await as(db, me.userId, async (tx) => {
      const invoices = await tx.query<{ member_id: string }>(`select member_id from public.invoices`);
      expect(invoices.rows).toHaveLength(1);
      expect(invoices.rows[0].member_id).toBe(me.memberId);
      expect(await count(tx, "public.boarder_assignments")).toBe(1);
      expect(await count(tx, "public.rooms")).toBe(1);
      // Only their own bed, not the roommate's.
      expect(await count(tx, "public.beds")).toBe(1);
      expect(await count(tx, "public.profiles")).toBe(1);
      expect(await count(tx, "public.organization_members")).toBe(1);
    });
  });

  it("a boarder cannot read the audit log, invitations or another boarder's invoice items", async () => {
    await as(db, a.boarders[0].userId, async (tx) => {
      expect(await count(tx, "public.audit_logs")).toBe(0);
      expect(await count(tx, "public.invitations")).toBe(0);
      const items = await tx.query<{ invoice_id: string }>(`select invoice_id from public.invoice_items`);
      expect(items.rows).toHaveLength(1);
    });
  });

  it("a boarder cannot run staff RPCs, even in their own organization", async () => {
    const me = a.boarders[0];
    await expect(
      as(db, me.userId, (tx) => tx.query(`select public.generate_monthly_invoices($1, '2026-11-01', '2026-11-05')`, [a.id])),
    ).rejects.toThrow(/Not authorized/);
    await expect(
      as(db, me.userId, (tx) => tx.query(`select public.record_payment($1, 100, 'cash', null, '2026-10-02')`, [me.memberId])),
    ).rejects.toThrow(/Not authorized/);
    await expect(
      as(db, me.userId, (tx) => tx.query(`select public.assign_bed($1, $2, '2026-10-01', 0)`, [me.memberId, a.bedIds[2]])),
    ).rejects.toThrow(/Not authorized/);
  });

  it("a boarder cannot write financial tables directly", async () => {
    const me = a.boarders[0];
    await as(db, me.userId, async (tx) => {
      await expect(tx.query(`update public.invoices set total_centavos = 0`)).rejects.toThrow(/permission denied/);
    });
    await expect(
      as(db, me.userId, (tx) =>
        tx.query(
          `insert into public.payments (organization_id, member_id, amount_centavos, method, received_on, receipt_number) values ($1, $2, 100, 'cash', '2026-10-01', 'X')`,
          [a.id, me.memberId],
        ),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("a boarder can edit permitted profile fields only", async () => {
    const me = a.boarders[0];
    await as(db, me.userId, async (tx) => {
      const ok = await tx.query(`update public.profiles set phone = '09171234567' where id = $1`, [me.userId]);
      expect(ok.affectedRows).toBe(1);
      const other = await tx.query(`update public.profiles set phone = '0' where id = $1`, [a.boarders[1].userId]);
      expect(other.affectedRows).toBe(0);
    });
    await expect(
      as(db, me.userId, (tx) => tx.query(`update public.profiles set email = 'x@evil.test' where id = $1`, [me.userId])),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as(db, me.userId, (tx) => tx.query(`update public.organization_members set role = 'owner' where user_id = $1`, [me.userId])),
    ).rejects.toThrow(/permission denied/);
  });

  it("server-only RPCs are not callable by signed-in users", async () => {
    await expect(
      as(db, a.ownerId, (tx) => tx.query(`select public.rate_limit_hit('x', 1, 60)`)),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as(db, a.ownerId, (tx) =>
        tx.query(`select public.register_boarder_invitation($1, $2, 'e@x.test', 'E', null, $3)`, [a.id, a.ownerId, a.ownerId]),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("published announcements are visible to members, drafts are not", async () => {
    await db.transaction(async (tx) => {
      await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [a.ownerId]);
      await tx.exec(`set local role authenticated`);
      await tx.query(
        `insert into public.announcements (organization_id, title, body, published_at) values ($1, 'Water interruption', 'Sat 9-12', now()), ($1, 'Draft notice', 'later', null)`,
        [a.id],
      );
    });
    await as(db, a.boarders[0].userId, async (tx) => {
      const rows = await tx.query<{ title: string }>(`select title from public.announcements`);
      expect(rows.rows.map((r) => r.title)).toEqual(["Water interruption"]);
    });
    await as(db, b.boarders[0].userId, async (tx) => {
      expect(await count(tx, "public.announcements")).toBe(0);
    });
  });
});

describe("audit log", () => {
  it("is append-only even for staff", async () => {
    await expect(as(db, a.ownerId, (tx) => tx.query(`delete from public.audit_logs`))).rejects.toThrow(/permission denied/);
    await expect(db.query(`update public.audit_logs set action = 'x'`)).rejects.toThrow(/append-only/);
  });

  it("records staff actions", async () => {
    const res = await db.query<{ action: string }>(`select action from public.audit_logs where organization_id = $1`, [a.id]);
    const actions = res.rows.map((r) => r.action);
    expect(actions).toContain("assignment.created");
    expect(actions).toContain("invoices.generated");
    expect(actions).toContain("rooms.insert");
  });
});
