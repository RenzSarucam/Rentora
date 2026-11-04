import { roomLabel } from "@/lib/room-label";
import type { Metadata } from "next";
import { listAssignments } from "@/features/boarder/queries";
import { Card, CardHeading, Empty, List, ScreenTitle } from "@/features/boarder/ui";
import { requireBoarder } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { formatPeso } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My room" };

export default async function MyRoomPage() {
  const viewer = await requireBoarder();
  const assignments = await listAssignments(viewer);
  const current = assignments.find((a) => a.move_out_date === null);
  const past = assignments.filter((a) => a.move_out_date !== null);
  const room = current?.beds?.rooms;

  // Only a count of roommates — never their names or details.
  let roommates = 0;
  if (room) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("room_occupied_count", { p_room: room.id });
    roommates = Math.max(0, Number(data ?? 1) - 1);
  }

  return (
    <>
      <ScreenTitle>My room</ScreenTitle>
      {current && room ? (
        <Card>
          <p className="text-sm text-muted-foreground">{room.properties?.name}</p>
          <p className="mt-0.5 text-[28px] leading-tight font-semibold tracking-[-0.01em]">{roomLabel(room.code)}</p>
          <p className="text-[15px]">{current.beds?.label}</p>
          <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-[15px]">
            <dt className="text-muted-foreground">Monthly rent</dt>
            <dd className="num text-right font-medium">{formatPeso(current.monthly_rent_centavos)}</dd>
            <dt className="text-muted-foreground">Moved in</dt>
            <dd className="text-right">{formatDate(current.move_in_date)}</dd>
            {room.floor && (
              <>
                <dt className="text-muted-foreground">Floor</dt>
                <dd className="text-right">{room.floor}</dd>
              </>
            )}
            <dt className="text-muted-foreground">Room for</dt>
            <dd className="num text-right">
              {room.capacity} {room.capacity === 1 ? "person" : "people"}
            </dd>
            {room.capacity > 1 && (
              <>
                <dt className="text-muted-foreground">Roommates now</dt>
                <dd className="num text-right">{roommates}</dd>
              </>
            )}
          </dl>
          {room.notes && <p className="mt-5 border-t border-rule pt-4 text-[15px] whitespace-pre-line text-muted-foreground">{room.notes}</p>}
          {room.properties?.address && <p className="mt-3 text-sm text-muted-foreground">{room.properties.address}</p>}
        </Card>
      ) : (
        <Card>
          <Empty>You don&apos;t have a bed assigned yet. Your landlord will assign one when you move in.</Empty>
        </Card>
      )}

      {past.length > 0 && (
        <Card className="mt-4">
          <CardHeading>Previous rooms</CardHeading>
          <List>
            {past.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-3 text-[15px]">
                <span>
                  {roomLabel(a.beds?.rooms?.code ?? "?")} · {a.beds?.label}
                  <span className="block text-sm text-muted-foreground">
                    {formatDate(a.move_in_date)} – {formatDate(a.move_out_date)}
                  </span>
                </span>
                <span className="num text-sm text-muted-foreground">{formatPeso(a.monthly_rent_centavos)}</span>
              </li>
            ))}
          </List>
        </Card>
      )}
    </>
  );
}
