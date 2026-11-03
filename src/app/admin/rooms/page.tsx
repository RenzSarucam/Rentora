import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/app/status-pill";
import { BedCells, BedLegend } from "@/features/rooms/bed-map";
import { listProperties, listRooms, occupancy } from "@/features/rooms/queries";
import { RoomFormDialog } from "@/features/rooms/room-form-dialog";
import { formatPeso } from "@/lib/money";

export const metadata: Metadata = { title: "Rooms & beds" };

export default async function RoomsPage() {
  const [rooms, properties] = await Promise.all([listRooms(), listProperties()]);
  const occ = occupancy(rooms);

  return (
    <>
      <PageHeader
        title="Rooms & beds"
        description={
          rooms.length
            ? `${occ.rooms} rooms · ${occ.beds} beds · ${occ.available} available now`
            : "Add your rooms. Each one gets a bed for every slot of capacity."
        }
        actions={<RoomFormDialog properties={properties} />}
      />

      {rooms.length === 0 ? (
        <EmptyState title="No rooms yet" action={<RoomFormDialog properties={properties} />}>
          Start with your first room. You can set a different rate per bed afterwards.
        </EmptyState>
      ) : (
        <>
          <div className="mb-3 flex justify-end">
            <BedLegend />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th scope="col" className="h-10 pr-3 font-medium">Room</th>
                  {properties.length > 1 && <th scope="col" className="px-3 font-medium">Property</th>}
                  <th scope="col" className="px-3 font-medium">Beds</th>
                  <th scope="col" className="px-3 text-right font-medium">Occupied</th>
                  <th scope="col" className="px-3 text-right font-medium">Rate per bed</th>
                  <th scope="col" className="px-3 font-medium">Status</th>
                  <th scope="col" className="w-8"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => {
                  const occupied = room.beds.filter((b) => b.occupant).length;
                  return (
                    <tr key={room.id} className="group border-b border-rule hover:bg-raised/60">
                      <td className="py-3 pr-3">
                        <Link href={`/admin/rooms/${room.id}`} className="font-medium text-foreground hover:underline">
                          Room {room.code}
                        </Link>
                        {room.floor && <p className="text-xs text-muted-foreground">{room.floor} floor</p>}
                      </td>
                      {properties.length > 1 && <td className="px-3 text-muted-foreground">{room.propertyName}</td>}
                      <td className="px-3 py-3">
                        <BedCells beds={room.beds} roomUnderMaintenance={room.status === "maintenance"} />
                      </td>
                      <td className="num px-3 text-right">
                        {occupied}
                        <span className="text-muted-foreground"> / {room.beds.length}</span>
                      </td>
                      <td className="num px-3 text-right">{formatPeso(room.rate)}</td>
                      <td className="px-3">
                        {room.status === "maintenance" ? (
                          <StatusPill tone="warning">Under maintenance</StatusPill>
                        ) : occupied === room.beds.length ? (
                          <StatusPill tone="neutral">Full</StatusPill>
                        ) : (
                          <StatusPill tone="accent">{room.beds.length - occupied} open</StatusPill>
                        )}
                      </td>
                      <td className="pl-2 text-right">
                        <Link href={`/admin/rooms/${room.id}`} aria-label={`Open room ${room.code}`} className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-active hover:text-foreground">
                          <ChevronRight className="size-4" aria-hidden />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
