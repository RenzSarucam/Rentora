import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listBoarderOptions } from "@/features/billing/queries";
import { PaymentsTable } from "@/features/payments/payments-table";
import { listPayments, listPendingSubmissions, listRecentRejections } from "@/features/payments/queries";
import { RecordPaymentDialog } from "@/features/payments/record-payment-dialog";
import { ReviewDialog } from "@/features/payments/review-dialog";
import { formatDate, formatDateTime, manilaToday, monthStart } from "@/lib/dates";
import { formatPeso } from "@/lib/money";
import { PAYMENT_METHOD_LABELS } from "@/lib/validation";

export const metadata: Metadata = { title: "Payments" };

type Method = keyof typeof PAYMENT_METHOD_LABELS;
const methodLabel = (m: string) => PAYMENT_METHOD_LABELS[m as Method] ?? m;

export default async function PaymentsPage() {
  const [pending, payments, rejected, boarders] = await Promise.all([
    listPendingSubmissions(),
    listPayments(),
    listRecentRejections(),
    listBoarderOptions(),
  ]);

  const thisMonth = monthStart(manilaToday());
  const collected = payments.filter((p) => !p.voided && p.receivedOn >= thisMonth).reduce((s, p) => s + p.amount, 0);
  const pendingTotal = pending.reduce((s, p) => s + p.amount, 0);

  return (
    <>
      <PageHeader
        title="Payments"
        description={
          pending.length
            ? `${pending.length} payment${pending.length === 1 ? "" : "s"} (${formatPeso(pendingTotal)}) waiting for your review · ${formatPeso(collected)} collected this month`
            : `Nothing waiting for review · ${formatPeso(collected)} collected this month`
        }
        actions={<RecordPaymentDialog boarders={boarders} />}
      />

      <Tabs defaultValue={pending.length ? "review" : "history"}>
        <TabsList className="mb-4">
          <TabsTrigger value="review">
            To review <span className="num ml-1 text-muted-foreground">{pending.length}</span>
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="rejected">
            Rejected <span className="num ml-1 text-muted-foreground">{rejected.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="review">
          {pending.length === 0 ? (
            <EmptyState title="You're all caught up">
              When a boarder sends a GCash, Maya or bank transfer proof, it shows up here for you to confirm.
            </EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th scope="col" className="h-10 pr-3 font-medium">Boarder</th>
                    <th scope="col" className="px-3 font-medium">Invoice</th>
                    <th scope="col" className="px-3 font-medium">Method</th>
                    <th scope="col" className="px-3 font-medium">Reference</th>
                    <th scope="col" className="px-3 font-medium">Paid on</th>
                    <th scope="col" className="px-3 font-medium">Sent</th>
                    <th scope="col" className="px-3 text-right font-medium">Amount</th>
                    <th scope="col" className="pl-3"><span className="sr-only">Review</span></th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((s) => (
                    <tr key={s.id} className="border-b border-rule">
                      <td className="py-3 pr-3 font-medium">{s.boarder}</td>
                      <td className="px-3">
                        <Link href={`/admin/billing/${s.invoiceId}`} className="font-mono text-[13px] hover:underline">
                          {s.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-3">{methodLabel(s.method)}</td>
                      <td className="px-3 font-mono text-[13px]">{s.reference}</td>
                      <td className="px-3">{formatDate(s.paidOn)}</td>
                      <td className="px-3 text-muted-foreground">{formatDateTime(s.submittedAt)}</td>
                      <td className="num px-3 text-right font-medium">{formatPeso(s.amount)}</td>
                      <td className="py-2 pl-3 text-right">
                        <ReviewDialog submission={s} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          <PaymentsTable payments={payments} />
        </TabsContent>

        <TabsContent value="rejected">
          {rejected.length === 0 ? (
            <EmptyState title="No rejected submissions">Rejected proofs and the reason you gave appear here.</EmptyState>
          ) : (
            <ul className="divide-y divide-rule text-sm">
              {rejected.map((r) => (
                <li key={r.id} className="grid gap-1 py-3 sm:grid-cols-[1fr_auto] sm:gap-6">
                  <div>
                    <p>
                      <span className="font-medium">{r.boarder}</span> · <span className="font-mono text-[13px]">{r.invoiceNumber}</span> ·{" "}
                      {methodLabel(r.method)} <span className="font-mono text-[13px] text-muted-foreground">{r.reference}</span>
                    </p>
                    {r.note && <p className="text-muted-foreground">Reason: {r.note}</p>}
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="num">{formatPeso(r.amount)}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(r.reviewedAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
