import { roomLabel } from "@/lib/room-label";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { AssignDialog, MoveOutDialog, RentDialog, TransferDialog } from "@/features/assignments/assignment-dialogs";
import { listAssignments, listUnassignedBoarders, listVacantBeds } from "@/features/assignments/queries";
import { formatDate } from "@/lib/dates";
import { formatPeso } from "@/lib/money";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Assignments" };

export default async function AssignmentsPage({ searchParams }: PageProps<"/admin/assignments">) {
  const { view } = await searchParams;
  const history = view === "history";
  const [{ current, past }, beds, boarders] = await Promise.all([listAssignments(), listVacantBeds(), listUnassignedBoarders()]);
  const monthlyRent = current.reduce((s, a) => s + a.rent, 0);

  const tabs = [
    { href: "/admin/assignments", label: "Current", count: current.length, active: !history },
    { href: "/admin/assignments?view=history", label: "Moved out", count: past.length, active: history },
  ];

  return (
    <>
      <PageHeader
        title="Assignments"
        description={
          current.length
            ? `${current.length} boarders in beds · ${formatPeso(monthlyRent)} monthly rent · ${beds.length} vacant beds · ${boarders.length} boarders waiting for a bed`
            : "Put boarders in beds. Rent is set per assignment and used for monthly invoices."
        }
        actions={<AssignDialog boarders={boarders} beds={beds} />}
      />

      <nav aria-label="Assignment lists" className="mb-5 flex gap-6 border-b border-border">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={t.active ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 border-transparent pb-2.5 text-sm text-muted-foreground hover:text-foreground",
              t.active && "border-foreground font-medium text-foreground",
            )}
          >
            {t.label} <span className="num text-muted-foreground">{t.count}</span>
          </Link>
        ))}
      </nav>

      {!history &&
        (current.length === 0 ? (
          <EmptyState
            title="Nobody is assigned to a bed"
            action={<AssignDialog boarders={boarders} beds={beds} variant="outline" />}
          >
            {beds.length === 0
              ? "Add rooms first, then assign boarders to their beds."
              : boarders.length === 0
                ? "Invite a boarder first, then assign them a bed."
                : "Assign your boarders to beds so monthly invoices can be generated."}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th scope="col" className="h-10 pr-3 font-medium">Boarder</th>
                  <th scope="col" className="px-3 font-medium">Room · bed</th>
                  <th scope="col" className="px-3 font-medium">Moved in</th>
                  <th scope="col" className="px-3 text-right font-medium">Monthly rent</th>
                  <th scope="col" className="pl-3 text-right font-medium"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {current.map((a) => (
                  <tr key={a.id} className="border-b border-rule hover:bg-raised/60">
                    <td className="py-3 pr-3">
                      <Link href={`/admin/boarders/${a.memberId}`} className="font-medium hover:underline">
                        {a.name}
                      </Link>
                    </td>
                    <td className="px-3">
                      {a.roomId ? (
                        <Link href={`/admin/rooms/${a.roomId}`} className="hover:underline">
                          {roomLabel(a.roomCode)}
                        </Link>
                      ) : (
                        roomLabel(a.roomCode)
                      )}{" "}
                      · {a.bedLabel}
                    </td>
                    <td className="num px-3">{formatDate(a.moveIn)}</td>
                    <td className="num px-3 text-right">{formatPeso(a.rent)}</td>
                    <td className="py-2 pl-3">
                      <div className="flex justify-end gap-1">
                        <TransferDialog memberId={a.memberId} name={a.name} currentRent={a.rent} beds={beds} />
                        <RentDialog assignmentId={a.id} rent={a.rent} name={a.name} />
                        <MoveOutDialog assignmentId={a.id} name={a.name} moveIn={a.moveIn} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="pt-3 text-xs text-muted-foreground">Total monthly rent</td>
                  <td className="num px-3 pt-3 text-right font-medium">{formatPeso(monthlyRent)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        ))}

      {history &&
        (past.length === 0 ? (
          <EmptyState title="No move-outs yet">Ended and transferred stays will be listed here.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th scope="col" className="h-10 pr-3 font-medium">Boarder</th>
                  <th scope="col" className="px-3 font-medium">Room · bed</th>
                  <th scope="col" className="px-3 font-medium">Stay</th>
                  <th scope="col" className="px-3 font-medium">Reason</th>
                  <th scope="col" className="pl-3 text-right font-medium">Rent</th>
                </tr>
              </thead>
              <tbody>
                {past.map((a) => (
                  <tr key={a.id} className="border-b border-rule">
                    <td className="py-3 pr-3">
                      <Link href={`/admin/boarders/${a.memberId}`} className="font-medium hover:underline">
                        {a.name}
                      </Link>
                    </td>
                    <td className="px-3">
                      {roomLabel(a.roomCode)} · {a.bedLabel}
                    </td>
                    <td className="num px-3">
                      {formatDate(a.moveIn)} – {formatDate(a.moveOut)}
                    </td>
                    <td className="px-3 text-muted-foreground">{a.endReason ?? "—"}</td>
                    <td className="num pl-3 text-right">{formatPeso(a.rent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </>
  );
}
