import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { as, commitAs, createTestDb, one } from "./harness";
import { assign, createOrg, type Org } from "./fixture";

let db: PGlite;
let org: Org;

beforeAll(async () => {
  db = await createTestDb();
  org = await createOrg(db, "rooms", 4);
  await assign(db, org, 0, 0);
});

describe("room capacity", () => {
  it("create_room makes one bed per capacity slot", async () => {
    expect(org.bedIds).toHaveLength(3);
  });

  it("rejects adding a bed beyond capacity", async () => {
    await expect(
      as(db, org.ownerId, (tx) =>
        tx.query(`insert into public.beds (organization_id, room_id, label, monthly_rate_centavos) values ($1, $2, 'Bed D', 1)`, [
          org.id,
          org.roomId,
        ]),
      ),
    ).rejects.toThrow(/capacity of 3 beds reached/);
  });

  it("rejects lowering capacity below the number of active beds", async () => {
    await expect(
      as(db, org.ownerId, (tx) => tx.query(`update public.rooms set capacity = 2 where id = $1`, [org.roomId])),
    ).rejects.toThrow(/cannot be lower/);
  });

  it("allows a new bed after raising capacity", async () => {
    await as(db, org.ownerId, async (tx) => {
      await tx.query(`update public.rooms set capacity = 4 where id = $1`, [org.roomId]);
      await tx.query(`insert into public.beds (organization_id, room_id, label, monthly_rate_centavos) values ($1, $2, 'Bed D', 1)`, [
        org.id,
        org.roomId,
      ]);
    });
  });
});

describe("bed assignment rules", () => {
  it("prevents double-assigning an occupied bed", async () => {
    await expect(
      as(db, org.ownerId, (tx) =>
        tx.query(`select public.assign_bed($1, $2, '2026-10-01', 350000)`, [org.boarders[1].memberId, org.bedIds[0]]),
      ),
    ).rejects.toThrow(/already occupied/);
  });

  it("the unique index blocks double assignment even without the RPC", async () => {
    await expect(
      db.query(
        `insert into public.boarder_assignments (organization_id, member_id, bed_id, monthly_rent_centavos, move_in_date) values ($1, $2, $3, 1, '2026-10-01')`,
        [org.id, org.boarders[1].memberId, org.bedIds[0]],
      ),
    ).rejects.toThrow(/assignments_one_current_per_bed/);
  });

  it("prevents giving one boarder two beds", async () => {
    await expect(
      as(db, org.ownerId, (tx) =>
        tx.query(`select public.assign_bed($1, $2, '2026-10-01', 350000)`, [org.boarders[0].memberId, org.bedIds[1]]),
      ),
    ).rejects.toThrow(/already has a bed/);
  });

  it("refuses beds under maintenance", async () => {
    await expect(
      as(db, org.ownerId, async (tx) => {
        await tx.query(`update public.beds set status = 'maintenance' where id = $1`, [org.bedIds[2]]);
        await tx.query(`select public.assign_bed($1, $2, '2026-10-01', 350000)`, [org.boarders[2].memberId, org.bedIds[2]]);
      }),
    ).rejects.toThrow(/under maintenance/);
  });

  it("refuses to archive an occupied bed or room", async () => {
    await expect(
      as(db, org.ownerId, (tx) => tx.query(`update public.beds set archived_at = now() where id = $1`, [org.bedIds[0]])),
    ).rejects.toThrow(/Move the boarder out/);
    await expect(
      as(db, org.ownerId, (tx) => tx.query(`update public.rooms set archived_at = now() where id = $1`, [org.roomId])),
    ).rejects.toThrow(/Move all boarders out/);
  });

  it("transfer ends the old assignment and opens a new one atomically", async () => {
    await as(db, org.ownerId, async (tx) => {
      await tx.query(`select public.transfer_bed($1, $2, '2026-10-15', 360000)`, [org.boarders[0].memberId, org.bedIds[1]]);
      const rows = await tx.query<{ bed_id: string; move_out_date: string | null; end_reason: string | null }>(
        `select bed_id, move_out_date::text, end_reason from public.boarder_assignments where member_id = $1 order by move_in_date`,
        [org.boarders[0].memberId],
      );
      expect(rows.rows).toEqual([
        { bed_id: org.bedIds[0], move_out_date: "2026-10-15", end_reason: "Transferred" },
        { bed_id: org.bedIds[1], move_out_date: null, end_reason: null },
      ]);
    });
  });

  it("move-out frees the bed and allows archiving the boarder", async () => {
    const memberId = org.boarders[3].memberId;
    const assignmentId = await commitAs(db, org.ownerId, async (tx) =>
      (await one<{ id: string }>(tx, `select public.assign_bed($1, $2, '2026-09-01', 300000) as id`, [memberId, org.bedIds[1]])).id,
    );
    await expect(
      as(db, org.ownerId, (tx) => tx.query(`select public.set_boarder_archived($1, true)`, [memberId])),
    ).rejects.toThrow(/Record the move-out/);
    await commitAs(db, org.ownerId, async (tx) => {
      await tx.query(`select public.end_assignment($1, '2026-10-31', 'Graduated')`, [assignmentId]);
      await tx.query(`select public.set_boarder_archived($1, true)`, [memberId]);
    });
    const status = await one<{ status: string }>(db, `select status from public.organization_members where id = $1`, [memberId]);
    expect(status.status).toBe("archived");
    await expect(
      as(db, org.ownerId, (tx) => tx.query(`select public.assign_bed($1, $2, '2026-11-01', 1)`, [memberId, org.bedIds[1]])),
    ).rejects.toThrow(/Only current boarders/);
  });
});
