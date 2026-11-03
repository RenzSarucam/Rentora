import type { PGlite } from "@electric-sql/pglite";
import { commitAs, one } from "./harness";

export type Org = {
  id: string;
  propertyId: string;
  ownerId: string;
  boarders: { userId: string; memberId: string }[];
  roomId: string;
  bedIds: string[];
};

async function createUser(db: PGlite, email: string, fullName: string): Promise<string> {
  const row = await one<{ id: string }>(
    db,
    `insert into auth.users (email, raw_user_meta_data) values ($1, jsonb_build_object('full_name', $2::text)) returning id`,
    [email, fullName],
  );
  return row.id;
}

/** Org with an owner, a 3-bed room (₱3,500 per bed) and `boarderCount` accepted boarders. */
export async function createOrg(db: PGlite, slug: string, boarderCount = 2): Promise<Org> {
  const ownerId = await createUser(db, `owner@${slug}.test`, `Owner ${slug}`);
  const orgId = await commitAs(
    db,
    null,
    async (tx) =>
      (
        await one<{ id: string }>(tx, `select public.provision_organization($1, 'Main house', 'Sampaloc, Manila', $2, $3, $4) as id`, [
          `Org ${slug}`,
          ownerId,
          `Owner ${slug}`,
          `owner@${slug}.test`,
        ])
      ).id,
    "service_role",
  );
  const propertyId = (await one<{ id: string }>(db, `select id from public.properties where organization_id = $1`, [orgId])).id;

  const boarders: Org["boarders"] = [];
  for (let i = 1; i <= boarderCount; i++) {
    const email = `boarder${i}@${slug}.test`;
    const userId = await createUser(db, email, `Boarder ${i} ${slug}`);
    const memberId = await commitAs(
      db,
      null,
      async (tx) =>
        (
          await one<{ id: string }>(tx, `select public.register_boarder_invitation($1, $2, $3, $4, '09170000000', $5) as id`, [
            orgId,
            userId,
            email,
            `Boarder ${i} ${slug}`,
            ownerId,
          ])
        ).id,
      "service_role",
    );
    await commitAs(db, userId, (tx) => tx.query(`select public.accept_invitation()`));
    boarders.push({ userId, memberId });
  }

  const roomId = await commitAs(db, ownerId, async (tx) =>
    (await one<{ id: string }>(tx, `select public.create_room($1, '101', '1', 3, 350000) as id`, [propertyId])).id,
  );
  const bedIds = (await db.query<{ id: string }>(`select id from public.beds where room_id = $1 order by label`, [roomId])).rows.map(
    (r) => r.id,
  );
  return { id: orgId, propertyId, ownerId, boarders, roomId, bedIds };
}

export async function assign(db: PGlite, org: Org, boarderIndex: number, bedIndex: number, moveIn = "2026-09-01") {
  return commitAs(db, org.ownerId, async (tx) =>
    (
      await one<{ id: string }>(tx, `select public.assign_bed($1, $2, $3, 350000) as id`, [
        org.boarders[boarderIndex].memberId,
        org.bedIds[bedIndex],
        moveIn,
      ])
    ).id,
  );
}
