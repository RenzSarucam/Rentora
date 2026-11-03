import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { as, createTestDb, one } from "./harness";
import { assign, createOrg, type Org } from "./fixture";

let db: PGlite;
let org: Org;
let other: Org;

beforeAll(async () => {
  db = await createTestDb();
  org = await createOrg(db, "occ", 3);
  other = await createOrg(db, "occx", 1);
  await assign(db, org, 0, 0);
  await assign(db, org, 1, 1);
});

const countAs = (userId: string, roomId: string) =>
  as(db, userId, async (tx) => (await one<{ n: number }>(tx, `select public.room_occupied_count($1) as n`, [roomId])).n);

describe("room_occupied_count", () => {
  it("tells an occupant how many beds are taken, without names", async () => {
    expect(await countAs(org.boarders[0].userId, org.roomId)).toBe(2);
  });

  it("works for staff of the organization", async () => {
    expect(await countAs(org.ownerId, org.roomId)).toBe(2);
  });

  it("is refused to boarders of other rooms and other organizations", async () => {
    await expect(countAs(org.boarders[2].userId, org.roomId)).rejects.toThrow(/Not authorized/);
    await expect(countAs(other.ownerId, org.roomId)).rejects.toThrow(/Not authorized/);
  });

  it("is not callable anonymously", async () => {
    await expect(
      as(db, null, (tx) => tx.query(`select public.room_occupied_count($1)`, [org.roomId]), "anon"),
    ).rejects.toThrow(/permission denied/);
  });
});
