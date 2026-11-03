import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, commitAs, createTestDb, one } from "./harness";
import { createOrg, type Org } from "./fixture";

let db: PGlite;
let a: Org;
let b: Org;
let published: string;
const version = "2020-01-01T00:00:00Z";
const nextVersion = "2020-01-02T00:00:00Z";
const unavailable: string[] = [];
const markSql = "select public.mark_announcement_read($1, $2::timestamptz)";

beforeAll(async () => {
  db = await createTestDb();
  a = await createOrg(db, "read-alpha");
  b = await createOrg(db, "read-bravo");
  published = await commitAs(db, a.ownerId, async (tx) => (await one<{ id: string }>(tx,
    `insert into public.announcements (organization_id, title, body, published_at)
     values ($1, 'Water interruption', 'Water returns at noon.', $2) returning id`, [a.id, version])).id);
  for (const [publishedAt, archivedAt] of [[null, null], ["2099-01-01T00:00:00Z", null], [version, version]]) {
    unavailable.push(await commitAs(db, a.ownerId, async (tx) => {
      const { id } = await one<{ id: string }>(tx,
        `insert into public.announcements (organization_id, title, body, published_at)
         values ($1, 'House notice', 'Not currently visible.', $2) returning id`, [a.id, publishedAt]);
      if (archivedAt) await tx.query("update public.announcements set archived_at=$2 where id=$1", [id, archivedAt]);
      return id;
    }));
  }
  // Both boarders read the same announcement; callers must only see their own receipt.
  for (const boarder of a.boarders) {
    await commitAs(db, boarder.userId, (tx) => tx.query(markSql, [published, version]));
  }
});
afterAll(async () => { await db?.close(); });

describe("announcement read receipts", () => {
  it("persists a versioned receipt and repeat opens remain idempotent", async () => {
    await as(db, a.boarders[0].userId, async (tx) => {
      await tx.query(markSql, [published, version]);
      await tx.query(markSql, [published, version]);
      const row = await one<{ n: number; correct: boolean }>(tx,
        `select count(*)::int n, bool_and(read_published_at = $1::timestamptz) correct from public.announcement_reads`, [version]);
      expect(row).toEqual({ n: 1, correct: true });
    });
  });

  it("each boarder can read only their own receipt", async () => {
    for (const boarder of a.boarders) {
      await as(db, boarder.userId, async (tx) => {
        const rows = await tx.query<{ member_id: string }>("select member_id from public.announcement_reads");
        expect(rows.rows).toEqual([{ member_id: boarder.memberId }]);
      });
    }
  });

  it.each(["owner", "other organization"])("does not expose receipts to %s", async (caller) => {
    const userId = caller === "owner" ? a.ownerId : b.boarders[0].userId;
    const rows = await as(db, userId, (tx) => tx.query("select * from public.announcement_reads"));
    expect(rows.rows).toHaveLength(0);
  });

  it.each(["insert", "update", "delete"])("denies direct %s even for the receipt owner", async (operation) => {
    const queries = {
      insert: "insert into public.announcement_reads (member_id, announcement_id, read_published_at) values ($1,$2,$3)",
      update: "update public.announcement_reads set read_published_at=$3 where member_id=$1 and announcement_id=$2",
      delete: "delete from public.announcement_reads where member_id=$1 and announcement_id=$2 and read_published_at=$3",
    };
    await expect(as(db, a.boarders[0].userId, (tx) => tx.query(queries[operation as keyof typeof queries],
      [a.boarders[0].memberId, published, version]))).rejects.toThrow(/permission denied/);
  });

  it("denies anonymous table access and RPC execution", async () => {
    await expect(as(db, null, (tx) => tx.query("select * from public.announcement_reads"), "anon")).rejects.toThrow(/permission denied/);
    await expect(as(db, null, (tx) => tx.query(markSql, [published, version]), "anon")).rejects.toThrow(/permission denied/);
  });

  it.each(["owner", "other organization", "no session"])("rejects RPC for %s", async (caller) => {
    const userId = caller === "owner" ? a.ownerId : caller === "other organization" ? b.boarders[0].userId : null;
    await expect(as(db, userId, (tx) => tx.query(markSql, [published, version]))).rejects.toThrow(/Not authorized/);
  });

  it.each([0, 1, 2])("rejects a draft, future or archived announcement (%i)", async (index) => {
    await expect(as(db, a.boarders[0].userId, (tx) => tx.query(markSql, [unavailable[index], version])))
      .rejects.toThrow(/not available/);
  });

  it("rejects an archived boarder even with a known announcement id", async () => {
    await db.transaction(async (tx) => {
      await tx.query("update public.organization_members set status='archived', archived_at=now() where id=$1", [a.boarders[0].memberId]);
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [a.boarders[0].userId]);
      await tx.exec("set local role authenticated");
      await expect(tx.query(markSql, [published, version])).rejects.toThrow(/Not authorized/);
      await tx.rollback();
    });
  });

  it.each([null, nextVersion])("rejects a missing or stale publication version (%s)", async (timestamp) => {
    await expect(as(db, a.boarders[0].userId, (tx) => tx.query(markSql, [published, timestamp])))
      .rejects.toThrow(/has changed/);
  });

  it("republishing makes the old receipt unread until the new version is opened", async () => {
    await db.transaction(async (tx) => {
      await tx.query("update public.announcements set published_at=$2 where id=$1", [published, nextVersion]);
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [a.boarders[0].userId]);
      await tx.exec("set local role authenticated");
      const unread = () => one<{ unread: boolean }>(tx, `select a.published_at<>r.read_published_at unread
        from public.announcements a join public.announcement_reads r on r.announcement_id=a.id where a.id=$1`, [published]);
      expect((await unread()).unread).toBe(true);
      await tx.query(markSql, [published, nextVersion]);
      expect((await unread()).unread).toBe(false);
      await tx.rollback();
    });
  });
});
