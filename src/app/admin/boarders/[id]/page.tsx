import { roomLabel } from "@/lib/room-label";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/app/action-button";
import { PageHeader, SectionHeader } from "@/components/app/page-header";
import { invoiceStatus, StatusPill } from "@/components/app/status-pill";
import { AssignDialog, MoveOutDialog, RentDialog, TransferDialog } from "@/features/assignments/assignment-dialogs";
import { listVacantBeds } from "@/features/assignments/queries";
import { resendInvite, setBoarderArchived } from "@/features/boarders/actions";
import { NotesForm } from "@/features/boarders/notes-form";
import { ProfileDialog } from "@/features/boarders/profile-dialog";
import { DeleteBoarderDialog } from "@/features/boarders/delete-boarder-dialog";
import { getBoarder } from "@/features/boarders/queries";
import { requireStaff } from "@/lib/auth/session";
import { formatDate, formatDateTime, formatMonth, manilaToday } from "@/lib/dates";
import { formatPeso } from "@/lib/money";
import { PAYMENT_METHOD_LABELS, uuid } from "@/lib/validation";

export const metadata: Metadata = { title: "Boarder" };

const KIND_LABEL: Record<string, string> = { rent: "Rent", deposit: "Deposit", other: "Charge" };

export default async function BoarderPage({ params }: PageProps<"/admin/boarders/[id]">) {
  const viewer = await requireStaff();
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const [boarder, beds] = await Promise.all([getBoarder(id), listVacantBeds()]);
  if (!boarder) notFound();

  const today = manilaToday();
  const archived = boarder.status === "archived";
  const overdue = boarder.invoices.filter((i) => (i.status === "open" || i.status === "partially_paid") && i.dueDate < today);
  const statusPill =
    boarder.status === "invited" ? (
      <StatusPill tone="warning">Invited</StatusPill>
    ) : archived ? (
      <StatusPill tone="neutral">Archived</StatusPill>
    ) : (
      <StatusPill tone="positive">Active</StatusPill>
    );

  return (
    <>
      <PageHeader
        back={{ href: "/admin/boarders", label: "Boarders" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {boarder.name}
            {statusPill}
          </span>
        }
        description={
          boarder.current
            ? `${roomLabel(boarder.current.roomCode)} · ${boarder.current.bedLabel} since ${formatDate(boarder.current.moveIn)}`
            : archived
              ? "Moved out. History is kept for your records."
              : "No bed assigned yet."
        }
        actions={
          <>
            {boarder.status === "invited" && (
              <ActionButton action={resendInvite} input={{ memberId: boarder.id }}>
                Resend invite
              </ActionButton>
            )}
            {!archived && !boarder.current && (
              <AssignDialog boarders={[]} beds={beds} presetMemberId={boarder.id} label="Assign bed" />
            )}
          </>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="grid content-start gap-10">
          {/* Balance strip: one container split by dividers. */}
          <div className="grid grid-cols-3 divide-x divide-border rounded-lg border border-border">
            <div className="p-4">
              <p className="text-sm text-muted-foreground">Unpaid balance</p>
              <p className={`num mt-1 text-[28px] leading-tight ${boarder.outstanding > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                {formatPeso(boarder.outstanding)}
              </p>
            </div>
            <div className="p-4">
              <p className="text-sm text-muted-foreground">Overdue invoices</p>
              <p className={`num mt-1 text-2xl leading-tight ${overdue.length ? "text-negative" : "text-muted-foreground"}`}>{overdue.length}</p>
            </div>
            <div className="p-4">
              <p className="text-sm text-muted-foreground">Monthly rent</p>
              <p className="num mt-1 text-2xl leading-tight">{boarder.current ? formatPeso(boarder.current.rent) : "—"}</p>
            </div>
          </div>

          <section aria-labelledby="invoices-heading">
            <SectionHeader title={<span id="invoices-heading">Invoices</span>} action={<Link href="/admin/billing" className="text-sm text-muted-foreground hover:text-foreground">Billing</Link>} />
            {boarder.invoices.length === 0 ? (
              <p className="border-y border-rule py-6 text-sm text-muted-foreground">No invoices yet. Rent invoices appear after you generate a month in Billing.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th scope="col" className="h-10 pr-3 font-medium">Invoice</th>
                    <th scope="col" className="px-3 font-medium">For</th>
                    <th scope="col" className="px-3 font-medium">Due</th>
                    <th scope="col" className="px-3 text-right font-medium">Total</th>
                    <th scope="col" className="px-3 text-right font-medium">Balance</th>
                    <th scope="col" className="pl-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {boarder.invoices.map((inv) => {
                    const s = invoiceStatus(inv.status, inv.dueDate, today);
                    return (
                      <tr key={inv.id} className="border-b border-rule">
                        <td className="py-3 pr-3">
                          <Link href={`/admin/billing/${inv.id}`} className="font-mono text-[13px] hover:underline">
                            {inv.number}
                          </Link>
                        </td>
                        <td className="px-3">{inv.periodMonth ? `${KIND_LABEL[inv.kind]} · ${formatMonth(inv.periodMonth)}` : KIND_LABEL[inv.kind]}</td>
                        <td className="num px-3">{formatDate(inv.dueDate)}</td>
                        <td className="num px-3 text-right">{formatPeso(inv.total)}</td>
                        <td className="num px-3 text-right">{inv.status === "void" ? "—" : formatPeso(inv.total - inv.paid)}</td>
                        <td className="pl-3">
                          <StatusPill tone={s.tone}>{s.label}</StatusPill>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>

          <section aria-labelledby="payments-heading">
            <SectionHeader title={<span id="payments-heading">Payments</span>} />
            {boarder.payments.length === 0 ? (
              <p className="border-y border-rule py-6 text-sm text-muted-foreground">No payments recorded yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th scope="col" className="h-10 pr-3 font-medium">Receipt</th>
                    <th scope="col" className="px-3 font-medium">Received</th>
                    <th scope="col" className="px-3 font-medium">Method</th>
                    <th scope="col" className="pl-3 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {boarder.payments.map((p) => (
                    <tr key={p.id} className="border-b border-rule">
                      <td className="py-3 pr-3">
                        <Link href={`/receipts/${p.id}`} className="font-mono text-[13px] hover:underline">
                          {p.receiptNumber}
                        </Link>
                        {p.voided && (
                          <StatusPill tone="neutral" className="ml-2">
                            Void
                          </StatusPill>
                        )}
                      </td>
                      <td className="num px-3">{formatDate(p.receivedOn)}</td>
                      <td className="px-3">{PAYMENT_METHOD_LABELS[p.method as keyof typeof PAYMENT_METHOD_LABELS] ?? p.method}</td>
                      <td className={`num pl-3 text-right ${p.voided ? "text-muted-foreground line-through" : ""}`}>{formatPeso(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section aria-labelledby="stays-heading">
            <SectionHeader title={<span id="stays-heading">Stays</span>} />
            {boarder.assignments.length === 0 ? (
              <p className="border-y border-rule py-6 text-sm text-muted-foreground">Never assigned a bed.</p>
            ) : (
              <ul className="divide-y divide-rule border-y border-rule">
                {boarder.assignments.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                    <span>
                      {a.roomId ? (
                        <Link href={`/admin/rooms/${a.roomId}`} className="font-medium hover:underline">
                          {roomLabel(a.roomCode)}
                        </Link>
                      ) : (
                        <span className="font-medium">{roomLabel(a.roomCode)}</span>
                      )}{" "}
                      · {a.bedLabel}
                      <span className="block text-xs text-muted-foreground">
                        {formatDate(a.moveIn)} – {a.moveOut ? formatDate(a.moveOut) : "now"}
                        {a.endReason ? ` · ${a.endReason}` : ""}
                      </span>
                    </span>
                    <span className="num">{formatPeso(a.rent)}/mo</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="grid content-start gap-6">
          <div className="rounded-lg border border-border p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Contact</h2>
              <ProfileDialog
                memberId={boarder.id}
                fullName={boarder.name}
                phone={boarder.phone}
                emergencyName={boarder.emergencyName}
                emergencyPhone={boarder.emergencyPhone}
              />
            </div>
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Email</dt>
                <dd className="break-all">{boarder.email}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Mobile</dt>
                <dd>{boarder.phone ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Emergency contact</dt>
                <dd>{boarder.emergencyName ? `${boarder.emergencyName}${boarder.emergencyPhone ? ` · ${boarder.emergencyPhone}` : ""}` : "—"}</dd>
              </div>
              {boarder.status === "invited" && boarder.lastInvitedAt && (
                <div>
                  <dt className="text-xs text-muted-foreground">Last invited</dt>
                  <dd>{formatDateTime(boarder.lastInvitedAt)}</dd>
                </div>
              )}
            </dl>
          </div>

          {boarder.current && (
            <div className="rounded-lg border border-border p-5">
              <h2 className="mb-1 text-sm font-semibold">Current bed</h2>
              <p className="text-sm">
                <Link href={`/admin/rooms/${boarder.current.roomId}`} className="hover:underline">
                  {roomLabel(boarder.current.roomCode)}
                </Link>{" "}
                · {boarder.current.bedLabel}
              </p>
              <p className="num mt-0.5 text-xs text-muted-foreground">
                {formatPeso(boarder.current.rent)} a month since {formatDate(boarder.current.moveIn)}
              </p>
              <div className="mt-3 flex flex-wrap gap-1">
                <TransferDialog memberId={boarder.id} name={boarder.name} currentRent={boarder.current.rent} beds={beds} />
                <RentDialog assignmentId={boarder.current.id} rent={boarder.current.rent} name={boarder.name} />
                <MoveOutDialog assignmentId={boarder.current.id} name={boarder.name} moveIn={boarder.current.moveIn} />
              </div>
            </div>
          )}

          <div className="rounded-lg border border-border p-5">
            <NotesForm memberId={boarder.id} notes={boarder.notes} />
          </div>

          <div>
            {archived ? (
              <ActionButton action={setBoarderArchived} input={{ memberId: boarder.id, archived: false }}>
                Restore boarder
              </ActionButton>
            ) : (
              <>
                <ActionButton
                  variant="ghost"
                  className="text-negative hover:bg-pill-negative-bg hover:text-negative"
                  action={setBoarderArchived}
                  input={{ memberId: boarder.id, archived: true }}
                  disabled={Boolean(boarder.current)}
                  confirm={{
                    title: `Archive ${boarder.name}?`,
                    description:
                      boarder.outstanding > 0
                        ? `They still owe ${formatPeso(boarder.outstanding)}. Archiving keeps their invoices and receipts, and they can still sign in to view them, but they cannot send new payments or requests.`
                        : "Their invoices and receipts are kept, and they can still sign in to view them.",
                    confirmLabel: "Archive boarder",
                    destructive: true,
                  }}
                >
                  Archive boarder
                </ActionButton>
                {boarder.current && <p className="mt-1 text-xs text-muted-foreground">Record the move-out first.</p>}
              </>
            )}
          </div>
          {viewer.role === "owner" && (
            <div className="border-t border-border pt-5">
              <DeleteBoarderDialog memberId={boarder.id} name={boarder.name} email={boarder.email}
                invoices={boarder.invoices.length} payments={boarder.payments.length} outstanding={boarder.outstanding} hasBed={Boolean(boarder.current)} />
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
