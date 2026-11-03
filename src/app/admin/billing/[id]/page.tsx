import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/app/action-button";
import { PageHeader, SectionHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/app/status-pill";
import { removeInvoiceItem, voidInvoice } from "@/features/billing/actions";
import { AddItemDialog, DueDateDialog } from "@/features/billing/invoice-dialogs";
import { getInvoice, listBoarderOptions } from "@/features/billing/queries";
import { ReasonDialog } from "@/features/payments/reason-dialog";
import { RecordPaymentDialog } from "@/features/payments/record-payment-dialog";
import { formatDate } from "@/lib/dates";
import { formatPeso } from "@/lib/money";
import { cn } from "@/lib/utils";
import { PAYMENT_METHOD_LABELS, uuid } from "@/lib/validation";

export const metadata: Metadata = { title: "Invoice" };

type Method = keyof typeof PAYMENT_METHOD_LABELS;

export default async function InvoicePage({ params }: PageProps<"/admin/billing/[id]">) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const [invoice, boarders] = await Promise.all([getInvoice(id), listBoarderOptions()]);
  if (!invoice) notFound();

  const open = invoice.status === "open" || invoice.status === "partially_paid";
  const editable = invoice.status !== "void";
  const livePaid = invoice.allocations.filter((a) => !a.voided);

  return (
    <>
      <PageHeader
        back={{ href: "/admin/billing", label: "Billing" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono">{invoice.number}</span>
            <StatusPill tone={invoice.statusTone}>{invoice.statusLabel}</StatusPill>
          </span>
        }
        description={
          <>
            <Link href={`/admin/boarders/${invoice.memberId}`} className="text-foreground hover:underline">
              {invoice.boarder}
            </Link>{" "}
            · {invoice.periodLabel} · issued {formatDate(invoice.issueDate)}
          </>
        }
        actions={
          open ? (
            <>
              {invoice.paid === 0 && invoice.pendingSubmissions.length === 0 && (
                <ReasonDialog
                  trigger="Void invoice"
                  triggerVariant="ghost"
                  title={`Void ${invoice.number}?`}
                  description="A void invoice no longer counts toward the boarder's balance. It stays on record and the number is not reused. For rent, you can generate the month again afterwards."
                  fieldLabel="Reason"
                  placeholder="Issued to the wrong boarder"
                  submitLabel="Void invoice"
                  destructive
                  action={async (reason) => {
                    "use server";
                    return voidInvoice({ invoiceId: invoice.id, reason });
                  }}
                />
              )}
              <RecordPaymentDialog
                boarders={boarders}
                invoice={{ id: invoice.id, number: invoice.number, memberId: invoice.memberId, balance: invoice.balance }}
              />
            </>
          ) : undefined
        }
      />

      {invoice.status === "void" && invoice.voidReason && (
        <p className="mb-6 rounded-md bg-pill-neutral-bg px-3 py-2 text-sm text-pill-neutral-ink">Voided: {invoice.voidReason}</p>
      )}
      {invoice.pendingSubmissions.length > 0 && (
        <p className="mb-6 rounded-md bg-pill-warning-bg px-3 py-2 text-sm text-pill-warning-ink">
          {invoice.pendingSubmissions.length === 1 ? "A payment" : `${invoice.pendingSubmissions.length} payments`} of{" "}
          {formatPeso(invoice.pendingSubmissions.reduce((s, p) => s + p.amount, 0))} submitted by the boarder{" "}
          {invoice.pendingSubmissions.length === 1 ? "is" : "are"} waiting for review.{" "}
          <Link href="/admin/payments" className="font-medium underline underline-offset-4">
            Review now
          </Link>
        </p>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        <section aria-labelledby="lines-heading">
          <SectionHeader title={<span id="lines-heading">Charges</span>} action={editable ? <AddItemDialog invoiceId={invoice.id} /> : undefined} />
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th scope="col" className="h-10 pr-3 font-medium">Description</th>
                <th scope="col" className="px-3 text-right font-medium">Amount</th>
                <th scope="col" className="w-20 pl-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item) => (
                <tr key={item.id} className="border-b border-rule">
                  <td className="py-3 pr-3">
                    {item.description}
                    {item.kind !== "rent" && <span className="ml-2 text-xs text-muted-foreground capitalize">{item.kind}</span>}
                  </td>
                  <td className={cn("num px-3 text-right", item.amount < 0 && "text-positive")}>
                    {item.amount < 0 ? `−${formatPeso(-item.amount)}` : formatPeso(item.amount)}
                  </td>
                  <td className="py-2 pl-3 text-right">
                    {editable && item.kind !== "rent" && (
                      <ActionButton
                        variant="ghost"
                        size="sm"
                        action={removeInvoiceItem}
                        input={{ itemId: item.id, invoiceId: invoice.id }}
                        confirm={{
                          title: "Remove this line?",
                          description: `"${item.description}" (${formatPeso(Math.abs(item.amount))}) is taken off the invoice.`,
                          confirmLabel: "Remove line",
                          destructive: true,
                        }}
                      >
                        Remove
                      </ActionButton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="text-sm">
              <tr>
                <th scope="row" className="pt-4 pr-3 text-left font-medium">Total</th>
                <td className="num px-3 pt-4 text-right font-semibold">{formatPeso(invoice.total)}</td>
                <td />
              </tr>
              <tr>
                <th scope="row" className="pt-1 pr-3 text-left font-normal text-muted-foreground">Paid</th>
                <td className="num px-3 pt-1 text-right text-muted-foreground">{formatPeso(invoice.paid)}</td>
                <td />
              </tr>
              <tr>
                <th scope="row" className="pt-1 pr-3 text-left font-medium">Balance</th>
                <td className={cn("num px-3 pt-1 text-right font-semibold", invoice.overdue && "text-negative")}>{formatPeso(invoice.balance)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
          {invoice.notes && <p className="mt-6 text-sm text-muted-foreground">Note: {invoice.notes}</p>}
        </section>

        <aside className="grid content-start gap-6">
          <dl className="grid grid-cols-[1fr_auto] items-center gap-y-2 rounded-lg border border-border p-5 text-sm">
            <dt className="text-muted-foreground">Due date</dt>
            <dd className={cn("text-right", invoice.overdue && "font-medium text-negative")}>
              {formatDate(invoice.dueDate)}
              {open && <DueDateDialog invoiceId={invoice.id} dueDate={invoice.dueDate} issueDate={invoice.issueDate} />}
            </dd>
            <dt className="text-muted-foreground">Issued</dt>
            <dd className="text-right">{formatDate(invoice.issueDate)}</dd>
          </dl>

          <section aria-labelledby="payments-heading">
            <h2 id="payments-heading" className="mb-2 text-base font-semibold">
              Payments applied
            </h2>
            {invoice.allocations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing paid on this invoice yet.</p>
            ) : (
              <ul className="divide-y divide-rule text-sm">
                {invoice.allocations.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className={cn(a.voided && "text-muted-foreground")}>
                      <Link href={`/receipts/${a.paymentId}`} className="font-mono text-[13px] hover:underline">
                        {a.receiptNumber}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(a.receivedOn)} · {PAYMENT_METHOD_LABELS[a.method as Method] ?? a.method}
                        {a.voided && " · void"}
                      </p>
                    </div>
                    <span className={cn("num", a.voided && "text-muted-foreground line-through")}>{formatPeso(a.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
            {livePaid.length > 1 && (
              <p className="num mt-2 text-right text-xs text-muted-foreground">
                {livePaid.length} payments · {formatPeso(livePaid.reduce((s, a) => s + a.amount, 0))}
              </p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
