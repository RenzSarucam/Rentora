import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { as, commitAs, createTestDb, one } from "./harness";
import { assign, createOrg, type Org } from "./fixture";

let db: PGlite;
let org: Org;
let other: Org;
let requestId: string;

beforeAll(async () => {
  db = await createTestDb();
  org = await createOrg(db, "fix", 2);
  other = await createOrg(db, "else", 1);
  await assign(db, org, 0, 0);
  requestId = await commitAs(db, org.boarders[0].userId, async (tx) =>
    (
      await one<{ id: string }>(
        tx,
        `insert into public.maintenance_requests (member_id, title, description, priority) values ($1, 'Leaking faucet', 'Bathroom sink drips all night', 'normal') returning id`,
        [org.boarders[0].memberId],
      )
    ).id,
  );
});

describe("maintenance permissions", () => {
  it("fills organization and room from the boarder's current assignment and forces status open", async () => {
    const row = await one<{ organization_id: string; room_id: string; status: string }>(
      db,
      `select organization_id, room_id, status::text from public.maintenance_requests where id = $1`,
      [requestId],
    );
    expect(row).toEqual({ organization_id: org.id, room_id: org.roomId, status: "open" });
  });

  it("a boarder cannot file a request as another boarder", async () => {
    await expect(
      as(db, org.boarders[0].userId, (tx) =>
        tx.query(`insert into public.maintenance_requests (member_id, title, description) values ($1, 'Fake request', 'x')`, [
          org.boarders[1].memberId,
        ]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("a boarder cannot change the status of their request", async () => {
    await expect(
      as(db, org.boarders[0].userId, (tx) => tx.query(`update public.maintenance_requests set status = 'resolved' where id = $1`, [requestId])),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as(db, org.boarders[0].userId, (tx) => tx.query(`select public.update_maintenance_status($1, 'resolved')`, [requestId])),
    ).rejects.toThrow(/Not authorized/);
  });

  it("a boarder's comment cannot smuggle a status change", async () => {
    await as(db, org.boarders[0].userId, async (tx) => {
      await tx.query(`insert into public.maintenance_updates (request_id, body) values ($1, 'Still dripping')`, [requestId]);
      const row = await one<{ status_to: string | null; author_id: string }>(
        tx,
        `select status_to, author_id from public.maintenance_updates where request_id = $1`,
        [requestId],
      );
      expect(row).toEqual({ status_to: null, author_id: org.boarders[0].userId });
    });
  });

  it("other boarders and other organizations cannot see the request", async () => {
    await as(db, org.boarders[1].userId, async (tx) => {
      expect((await tx.query(`select id from public.maintenance_requests`)).rows).toHaveLength(0);
    });
    await as(db, other.ownerId, async (tx) => {
      expect((await tx.query(`select id from public.maintenance_requests`)).rows).toHaveLength(0);
      await expect(tx.query(`select public.update_maintenance_status($1, 'in_progress')`, [requestId])).rejects.toThrow(/Not authorized/);
    });
  });

  it("staff move it through statuses with a timeline entry each time", async () => {
    await as(db, org.ownerId, async (tx) => {
      await tx.query(`select public.update_maintenance_status($1, 'in_progress', 'Plumber booked for Saturday')`, [requestId]);
      await tx.query(`select public.update_maintenance_status($1, 'resolved')`, [requestId]);
      const req = await one<{ status: string; resolved: boolean }>(
        tx,
        `select status::text, resolved_at is not null as resolved from public.maintenance_requests where id = $1`,
        [requestId],
      );
      expect(req).toEqual({ status: "resolved", resolved: true });
      const updates = await tx.query<{ status_to: string }>(
        `select status_to::text from public.maintenance_updates where request_id = $1 and status_to is not null order by created_at`,
        [requestId],
      );
      expect(updates.rows.map((u) => u.status_to)).toEqual(["in_progress", "resolved"]);
    });
  });
});

describe("storage policies", () => {
  const put = (bucket: string, name: string) => `insert into storage.objects (bucket_id, name) values ('${bucket}', '${name}')`;

  it("buckets are private with size and type limits", async () => {
    const rows = await db.query<{ id: string; public: boolean; file_size_limit: number }>(
      `select id, public, file_size_limit::int from storage.buckets order by id`,
    );
    expect(rows.rows).toEqual([
      { id: "maintenance-photos", public: false, file_size_limit: 5242880 },
      { id: "payment-proofs", public: false, file_size_limit: 5242880 },
      { id: "payment-qrs", public: false, file_size_limit: 4194304 },
    ]);
  });

  it("a boarder can upload only into their own folder", async () => {
    const me = org.boarders[0];
    await as(db, me.userId, (tx) => tx.query(put("payment-proofs", `${org.id}/${me.memberId}/a.jpg`)));
    await expect(
      as(db, me.userId, (tx) => tx.query(put("payment-proofs", `${org.id}/${org.boarders[1].memberId}/a.jpg`))),
    ).rejects.toThrow(/row-level security/);
    await expect(as(db, me.userId, (tx) => tx.query(put("payment-proofs", `${other.id}/${me.memberId}/a.jpg`)))).rejects.toThrow(
      /row-level security/,
    );
    await expect(as(db, me.userId, (tx) => tx.query(put("payment-proofs", `${org.id}/${me.memberId}/nested/a.jpg`)))).rejects.toThrow(
      /row-level security/,
    );
    await expect(as(db, me.userId, (tx) => tx.query(put("avatars", `${org.id}/${me.memberId}/a.jpg`)))).rejects.toThrow();
  });

  it("files are readable by their owner and their organization's staff only", async () => {
    const me = org.boarders[0];
    await db.query(put("payment-proofs", `${org.id}/${me.memberId}/receipt.png`));
    const visible = (userId: string) =>
      as(db, userId, async (tx) => (await tx.query(`select name from storage.objects where name like '%receipt.png'`)).rows.length);
    expect(await visible(me.userId)).toBe(1);
    expect(await visible(org.ownerId)).toBe(1);
    expect(await visible(org.boarders[1].userId)).toBe(0);
    expect(await visible(other.ownerId)).toBe(0);
  });

  it("uploads cannot be overwritten or deleted by app users", async () => {
    const me = org.boarders[0];
    await as(db, me.userId, async (tx) => {
      expect((await tx.query(`delete from storage.objects`)).affectedRows).toBe(0);
      expect((await tx.query(`update storage.objects set name = 'x'`)).affectedRows).toBe(0);
    });
  });
});
