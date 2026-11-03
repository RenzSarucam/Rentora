import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { as, commitAs, createTestDb, one } from "./harness";
import { assign, createOrg, type Org } from "./fixture";

// Direct-table writes used by the admin maintenance, announcements and settings screens.

let db: PGlite;
let org: Org;
let other: Org;
let requestId: string;

beforeAll(async () => {
  db = await createTestDb();
  org = await createOrg(db, "adm", 1);
  other = await createOrg(db, "oth", 1);
  await assign(db, org, 0, 0);
  requestId = await commitAs(db, org.boarders[0].userId, async (tx) =>
    (
      await one<{ id: string }>(
        tx,
        `insert into public.maintenance_requests (member_id, title, description) values ($1, 'Broken lock', 'Door will not lock') returning id`,
        [org.boarders[0].memberId],
      )
    ).id,
  );
});

describe("staff maintenance comments", () => {
  it("staff can comment; organization and author are filled by the database", async () => {
    await as(db, org.ownerId, async (tx) => {
      await tx.query(`insert into public.maintenance_updates (request_id, body) values ($1, 'Locksmith coming at 3 PM')`, [requestId]);
      const row = await one<{ organization_id: string; author_id: string; status_to: string | null }>(
        tx,
        `select organization_id, author_id, status_to from public.maintenance_updates where request_id = $1`,
        [requestId],
      );
      expect(row).toEqual({ organization_id: org.id, author_id: org.ownerId, status_to: null });
    });
  });

  it("staff of another organization cannot comment", async () => {
    await expect(
      as(db, other.ownerId, (tx) => tx.query(`insert into public.maintenance_updates (request_id, body) values ($1, 'x')`, [requestId])),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("announcement lifecycle", () => {
  it("unpublished and archived announcements disappear for boarders but stay for staff", async () => {
    const id = await commitAs(db, org.ownerId, async (tx) =>
      (
        await one<{ id: string }>(
          tx,
          `insert into public.announcements (organization_id, title, body, published_at) values ($1, 'Rent reminder', 'Due on the 5th', now()) returning id`,
          [org.id],
        )
      ).id,
    );
    const boarderSees = () => as(db, org.boarders[0].userId, async (tx) => (await tx.query(`select id from public.announcements`)).rows.length);
    expect(await boarderSees()).toBe(1);

    await commitAs(db, org.ownerId, (tx) => tx.query(`update public.announcements set published_at = null where id = $1`, [id]));
    expect(await boarderSees()).toBe(0);

    await commitAs(db, org.ownerId, (tx) =>
      tx.query(`update public.announcements set published_at = now(), archived_at = now() where id = $1`, [id]),
    );
    expect(await boarderSees()).toBe(0);
    await as(db, org.ownerId, async (tx) => {
      expect((await tx.query(`select id from public.announcements`)).rows.length).toBe(1);
    });
  });
});

describe("settings writes", () => {
  it("staff can rename the organization and change the due day, not the invoice counters", async () => {
    await as(db, org.ownerId, async (tx) => {
      const res = await tx.query(`update public.organizations set name = 'Casa Ana', default_due_day = 10 where id = $1`, [org.id]);
      expect(res.affectedRows).toBe(1);
    });
    await expect(
      as(db, org.ownerId, (tx) => tx.query(`update public.organizations set next_invoice_seq = 1 where id = $1`, [org.id])),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as(db, org.ownerId, (tx) => tx.query(`update public.organizations set default_due_day = 31 where id = $1`, [org.id])),
    ).rejects.toThrow(/check constraint/);
  });

  it("boarders cannot change settings or properties", async () => {
    await as(db, org.boarders[0].userId, async (tx) => {
      expect((await tx.query(`update public.organizations set name = 'Mine' where id = $1`, [org.id])).affectedRows).toBe(0);
      expect((await tx.query(`update public.properties set name = 'Mine' where id = $1`, [org.propertyId])).affectedRows).toBe(0);
    });
  });
});
