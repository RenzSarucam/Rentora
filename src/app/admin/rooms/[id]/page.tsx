import { roomLabel } from "@/lib/room-label";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/app/action-button";
import { PageHeader, SectionHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/app/status-pill";
import { archiveBed, archiveRoom, setBedStatus, setRoomStatus } from "@/features/rooms/actions";
import { BedFormDialog } from "@/features/rooms/bed-form-dialog";
import { BedCells } from "@/features/rooms/bed-map";
import { getRoom, listProperties } from "@/features/rooms/queries";
import { RoomFormDialog } from "@/features/rooms/room-form-dialog";
import { formatDate } from "@/lib/dates";
import { formatPeso } from "@/lib/money";
import { uuid } from "@/lib/validation";

export const metadata: Metadata = { title: "Room" };

export default async function RoomPage({ params }: PageProps<"/admin/rooms/[id]">) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const [room, properties] = await Promise.all([getRoom(id), listProperties()]);
  if (!room) notFound();

  const occupied = room.beds.filter((b) => b.occupant).length;
  const full = room.beds.length >= room.capacity;

  return (
    <>
      <PageHeader
        back={{ href: "/admin/rooms", label: "Rooms & beds" }}
        title={
          <span className="flex items-center gap-3">
            {roomLabel(room.code)}
            {room.status === "maintenance" && <StatusPill tone="warning">Under maintenance</StatusPill>}
          </span>
        }
        description={[room.propertyName, room.floor && `${room.floor} floor`, `${occupied} of ${room.beds.length} beds occupied`].filter(Boolean).join(" · ")}
        actions={
          <>
            <ActionButton
              action={setRoomStatus}
              input={{ id: room.id, status: room.status === "maintenance" ? "active" : "maintenance" }}
              confirm={
                room.status === "maintenance"
                  ? undefined
                  : {
                      title: `Mark room ${room.code} under maintenance?`,
                      description: "Vacant beds in this room cannot be assigned until you mark it available again. Current boarders stay.",
                      confirmLabel: "Mark under maintenance",
                    }
              }
            >
              {room.status === "maintenance" ? "Mark available" : "Under maintenance"}
            </ActionButton>
            <RoomFormDialog properties={properties} room={room} />
          </>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <section aria-labelledby="beds-heading">
          <SectionHeader
            title={<span id="beds-heading">Beds</span>}
            action={<BedFormDialog roomId={room.id} defaultRate={room.rate} disabled={full} />}
          />
          {full && <p className="mb-3 text-sm text-muted-foreground">Room is at its capacity of {room.capacity}. Raise the capacity to add a bed.</p>}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th scope="col" className="h-10 pr-3 font-medium">Bed</th>
                <th scope="col" className="px-3 font-medium">Boarder</th>
                <th scope="col" className="px-3 text-right font-medium">Rate</th>
                <th scope="col" className="px-3 font-medium">Status</th>
                <th scope="col" className="pl-3 text-right font-medium"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {room.beds.map((bed) => (
                <tr key={bed.id} className="border-b border-rule">
                  <td className="py-3 pr-3 font-medium">{bed.label}</td>
                  <td className="px-3">
                    {bed.occupant ? (
                      <>
                        <Link href={`/admin/boarders/${bed.occupant.memberId}`} className="hover:underline">
                          {bed.occupant.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          Since {formatDate(bed.occupant.moveIn)} · pays <span className="num">{formatPeso(bed.occupant.rent)}</span>
                        </p>
                      </>
                    ) : (
                      <span className="text-muted-foreground">Vacant</span>
                    )}
                  </td>
                  <td className="num px-3 text-right">{formatPeso(bed.rate)}</td>
                  <td className="px-3">
                    {bed.occupant ? (
                      <StatusPill tone="accent">Occupied</StatusPill>
                    ) : bed.status === "maintenance" || room.status === "maintenance" ? (
                      <StatusPill tone="warning">Maintenance</StatusPill>
                    ) : (
                      <StatusPill tone="neutral">Vacant</StatusPill>
                    )}
                  </td>
                  <td className="py-2 pl-3">
                    <div className="flex justify-end gap-1">
                      <BedFormDialog roomId={room.id} defaultRate={room.rate} bed={bed} />
                      {!bed.occupant && (
                        <>
                          <ActionButton
                            variant="ghost"
                            size="sm"
                            action={setBedStatus}
                            input={{ id: bed.id, status: bed.status === "maintenance" ? "active" : "maintenance" }}
                          >
                            {bed.status === "maintenance" ? "Mark available" : "Maintenance"}
                          </ActionButton>
                          <ActionButton
                            variant="ghost"
                            size="sm"
                            action={archiveBed}
                            input={{ id: bed.id }}
                            confirm={{
                              title: `Remove ${bed.label}?`,
                              description: "The bed is archived. Its history stays in past assignments and invoices.",
                              confirmLabel: "Remove bed",
                              destructive: true,
                            }}
                          >
                            Remove
                          </ActionButton>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {room.beds.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">This room has no beds. Add one to start assigning boarders.</p>}
        </section>

        <aside className="grid content-start gap-6">
          <div className="rounded-lg border border-border p-5">
            <h2 className="mb-3 text-sm font-semibold">At a glance</h2>
            <BedCells beds={room.beds} roomUnderMaintenance={room.status === "maintenance"} />
            <dl className="mt-4 grid grid-cols-2 gap-y-3 text-sm">
              <dt className="text-muted-foreground">Capacity</dt>
              <dd className="num text-right">{room.capacity} beds</dd>
              <dt className="text-muted-foreground">Rate per bed</dt>
              <dd className="num text-right">{formatPeso(room.rate)}</dd>
              <dt className="text-muted-foreground">Monthly at full</dt>
              <dd className="num text-right">{formatPeso(room.beds.reduce((s, b) => s + b.rate, 0))}</dd>
            </dl>
            {room.notes && <p className="mt-4 border-t border-rule pt-3 text-sm text-muted-foreground">{room.notes}</p>}
          </div>
          <div>
            <ActionButton
              variant="ghost"
              className="text-negative hover:bg-pill-negative-bg hover:text-negative"
              action={archiveRoom}
              input={{ id: room.id }}
              disabled={occupied > 0}
              confirm={{
                title: `Archive room ${room.code}?`,
                description: "The room and its beds are hidden from new assignments. Past invoices and history are kept.",
                confirmLabel: "Archive room",
                destructive: true,
              }}
            >
              Archive room
            </ActionButton>
            {occupied > 0 && <p className="mt-1 text-xs text-muted-foreground">Move boarders out before archiving.</p>}
          </div>
        </aside>
      </div>
    </>
  );
}
