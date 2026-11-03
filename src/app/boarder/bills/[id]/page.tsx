import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { invoiceStatus, StatusPill } from "@/components/app/status-pill";
import { PaymentProofForm } from "@/features/boarder/payment-proof-form";
import { balanceOf, getInvoice, invoiceTitle, isPayable, listSubmissions } from "@/features/boarder/queries";
import { Card, CardHeading } from "@/features/boarder/ui";
import { requireBoarder } from "@/lib/auth/session";
import { formatDate, formatMonth, manilaToday } from "@/lib/dates";
import { formatPeso } from "@/lib/money";
import { PAYMENT_METHOD_LABELS, uuid } from "@/lib/validation";

export const metadata: Metadata = { title: "Bill" };

export default async function BillPage({ params }: PageProps<"/boarder/bills/[id]">) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const viewer = await requireBoarder();
  const [invoice, submissions] = await Promise.all([getInvoice(viewer, id), listSubmissions(viewer)]);
  if (!invoice) notFound();

  const today = manilaToday();
  const s = invoiceStatus(invoice.status, invoice.due_date, today);
  const balance = balanceOf(invoice);
  const pendingHere = submissions.filter((x) => x.invoice_id === invoice.id && x.status === "pending");
  const pendingThis = pendingHere.reduce((sum, x) => sum + x.amount_centavos, 0);
  // The database also caps a submission at (all unpaid) − (all pending); this bill's remainder is the practical limit.
  const payable = Math.max(0, balance - pendingThis);
  const canPay = isPayable(invoice) && viewer.status !== "archived" && payable > 0;
  const items = [...invoice.invoice_items].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const applied = invoice.payment_allocations.filter((a) => a.payments && !a.payments.voided_at);

  return (
    <div className="grid gap-4">
      <Link href="/boarder/bills" className="mt-1 inline-flex min-h-11 items-center gap-1 self-start text-sm text-muted-foreground">
        <ChevronLeft className="size-4" aria-hidden /> Bills
      </Link>

      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[22px] leading-tight font-semibold">{invoiceTitle(invoice, formatMonth)}</h1>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">{invoice.invoice_number}</p>
          </div>
          <StatusPill tone={s.tone}>{s.label}</StatusPill>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-y-2 text-[15px]">
          <dt className="text-muted-foreground">Issued</dt>
          <dd className="text-right">{formatDate(invoice.issue_date)}</dd>
          <dt className="text-muted-foreground">Due</dt>
          <dd className="text-right">{formatDate(invoice.due_date)}</dd>
        </dl>

        <ul className="mt-4 divide-y divide-rule border-t border-rule">
          {items.map((item) => (
            <li key={item.id} className="flex justify-between gap-4 py-3 text-[15px]">
              <span className="min-w-0">{item.description}</span>
              <span className="num shrink-0">{formatPeso(item.amount_centavos)}</span>
            </li>
          ))}
        </ul>
        <dl className="grid grid-cols-2 gap-y-2 border-t border-border pt-3 text-[15px]">
          <dt>Total</dt>
          <dd className="num text-right font-medium">{formatPeso(invoice.total_centavos)}</dd>
          {invoice.amount_paid_centavos > 0 && (
            <>
              <dt className="text-muted-foreground">Paid</dt>
              <dd className="num text-right text-muted-foreground">−{formatPeso(invoice.amount_paid_centavos)}</dd>
            </>
          )}
          {invoice.status !== "void" && (
            <>
              <dt className="font-semibold">Balance</dt>
              <dd className="num text-right text-lg font-semibold">{formatPeso(balance)}</dd>
            </>
          )}
        </dl>
        {invoice.notes && <p className="mt-4 text-sm whitespace-pre-line text-muted-foreground">{invoice.notes}</p>}
      </Card>

      {applied.length > 0 && (
        <Card>
          <CardHeading>Payments on this bill</CardHeading>
          <ul className="divide-y divide-rule">
            {applied.map((a) => (
              <li key={a.id}>
                <Link href={`/receipts/${a.payments!.id}`} className="flex min-h-14 items-center justify-between gap-3 py-3 active:opacity-70">
                  <span>
                    <span className="block text-[15px]">
                      {PAYMENT_METHOD_LABELS[a.payments!.method as keyof typeof PAYMENT_METHOD_LABELS] ?? a.payments!.method} ·{" "}
                      {formatDate(a.payments!.received_on)}
                    </span>
                    <span className="block font-mono text-xs text-muted-foreground">{a.payments!.receipt_number}</span>
                  </span>
                  <span className="num text-[15px]">{formatPeso(a.amount_centavos)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {pendingThis > 0 && (
        <p className="rounded-[20px] bg-pill-warning-bg px-5 py-4 text-[15px] text-pill-warning-ink">
          <span className="num">{formatPeso(pendingThis)}</span> is awaiting your landlord&apos;s review for this bill.
        </p>
      )}

      {canPay && (
        <Card id="pay" className="scroll-mt-20">
          <CardHeading>Submit a payment</CardHeading>
          <PaymentProofForm invoiceId={invoice.id} payable={payable} today={today} />
        </Card>
      )}
    </div>
  );
}
