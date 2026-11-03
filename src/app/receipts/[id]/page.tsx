import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { BrandMark } from "@/components/app/brand";
import { PrintButton } from "@/features/payments/print-button";
import { getReceipt } from "@/features/payments/queries";
import { amountInWords } from "@/features/payments/words";
import { getViewer, isStaff } from "@/lib/auth/session";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatPeso } from "@/lib/money";
import { PAYMENT_METHOD_LABELS, uuid } from "@/lib/validation";

export const metadata: Metadata = { title: "Receipt" };

type Method = keyof typeof PAYMENT_METHOD_LABELS;

export default async function ReceiptPage({ params }: PageProps<"/receipts/[id]">) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  // RLS: staff of the organization or the boarder who paid. Anyone else gets nothing back.
  const receipt = await getReceipt(id);
  if (!receipt) notFound();

  const staff = isStaff(viewer);
  const back = staff ? { href: "/admin/payments", label: "Payments" } : { href: "/boarder/payment-history", label: "Payment history" };

  return (
    <div className="min-h-dvh bg-ground px-4 py-6 print:bg-white print:p-0">
      <div className="no-print mx-auto mb-4 flex max-w-2xl items-center justify-between gap-3">
        <Link href={back.href} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" aria-hidden /> {back.label}
        </Link>
        <PrintButton />
      </div>

      <main id="main" className="relative mx-auto max-w-2xl overflow-hidden rounded-2xl border border-border bg-background p-6 sm:p-10 print:rounded-none print:border-0 print:p-0">
        {receipt.voided && (
          <p
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center justify-center text-[96px] font-semibold tracking-widest text-negative/15 select-none"
          >
            VOID
          </p>
        )}

        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
          <div className="flex items-start gap-3">
            <BrandMark className="size-8" />
            <div>
              <p className="text-lg font-semibold">{receipt.orgName}</p>
              {receipt.property && (
                <p className="text-sm text-muted-foreground">
                  {receipt.property.name}
                  {receipt.property.address ? ` · ${receipt.property.address}` : ""}
                </p>
              )}
            </div>
          </div>
          <div className="text-left sm:text-right">
            <h1 className="text-sm font-medium text-muted-foreground">Payment receipt</h1>
            <p className="font-mono text-lg">{receipt.receiptNumber}</p>
            <p className="text-sm text-muted-foreground">{formatDate(receipt.receivedOn)}</p>
          </div>
        </header>

        {receipt.voided && (
          <p className="mt-6 rounded-md bg-pill-negative-bg px-3 py-2 text-sm text-pill-negative-ink">
            This receipt was voided{receipt.voidReason ? `: ${receipt.voidReason}` : "."} The payment no longer counts toward any bill.
          </p>
        )}

        <section className="mt-6 grid gap-6 sm:grid-cols-[1fr_auto]">
          <div>
            <p className="text-sm text-muted-foreground">Received from</p>
            <p className="text-base font-medium">{receipt.boarder.name}</p>
            {receipt.boarder.email && <p className="text-sm text-muted-foreground">{receipt.boarder.email}</p>}
          </div>
          <div className="sm:text-right">
            <p className="text-sm text-muted-foreground">Amount</p>
            <p className="num text-3xl font-semibold tracking-[-0.01em]">{formatPeso(receipt.amount)}</p>
          </div>
        </section>

        <p className="mt-4 rounded-md bg-raised px-3 py-2 text-sm">
          <span className="text-muted-foreground">In words: </span>
          {amountInWords(receipt.amount)}
        </p>

        <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Method</dt>
          <dd>
            {PAYMENT_METHOD_LABELS[receipt.method as Method] ?? receipt.method}
            {receipt.online && <span className="text-muted-foreground"> · proof submitted online and verified</span>}
          </dd>
          {receipt.reference && (
            <>
              <dt className="text-muted-foreground">Reference</dt>
              <dd className="font-mono break-all">{receipt.reference}</dd>
            </>
          )}
          {receipt.recordedBy && (
            <>
              <dt className="text-muted-foreground">Recorded by</dt>
              <dd>{receipt.recordedBy}</dd>
            </>
          )}
          {receipt.notes && (
            <>
              <dt className="text-muted-foreground">Note</dt>
              <dd>{receipt.notes}</dd>
            </>
          )}
        </dl>

        <section aria-labelledby="applied-heading" className="mt-8">
          <h2 id="applied-heading" className="mb-2 text-sm font-semibold">
            Applied to
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th scope="col" className="h-9 pr-3 font-medium">Invoice</th>
                <th scope="col" className="px-3 font-medium">For</th>
                <th scope="col" className="pl-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {receipt.allocations.map((a, i) => (
                <tr key={i} className="border-b border-rule">
                  <td className="py-2.5 pr-3 font-mono text-[13px]">{a.invoiceNumber}</td>
                  <td className="px-3">{a.label}</td>
                  <td className="num pl-3 text-right">{formatPeso(a.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" colSpan={2} className="pt-3 pr-3 text-left font-medium">
                  Total received
                </th>
                <td className="num pt-3 pl-3 text-right font-semibold">{formatPeso(receipt.amount)}</td>
              </tr>
            </tfoot>
          </table>
        </section>

        <footer className="mt-10 border-t border-border pt-4 text-xs text-muted-foreground">
          <p>
            Acknowledgement of payment issued by {receipt.orgName} through Rentora on {formatDateTime(receipt.createdAt)}. This is not a BIR-registered
            official receipt; ask your landlord if you need one.
          </p>
        </footer>
      </main>
    </div>
  );
}
