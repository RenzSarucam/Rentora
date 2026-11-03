import type { Metadata } from "next";
import Link from "next/link";
import { StatusPill, submissionStatus } from "@/components/app/status-pill";
import { listPayments, listSubmissions } from "@/features/boarder/queries";
import { Card, CardHeading, Empty, List, RowLink, ScreenTitle } from "@/features/boarder/ui";
import { requireBoarder } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { formatPeso } from "@/lib/money";
import { PAYMENT_METHOD_LABELS } from "@/lib/validation";

export const metadata: Metadata = { title: "Payments" };

export default async function PaymentHistoryPage() {
  const viewer = await requireBoarder();
  const [submissions, payments] = await Promise.all([listSubmissions(viewer), listPayments(viewer)]);
  const inReview = submissions.filter((s) => s.status !== "approved");
  const confirmedTotal = payments.filter((p) => !p.voided_at).reduce((s, p) => s + p.amount_centavos, 0);

  return (
    <>
      <ScreenTitle sub={payments.length ? `${formatPeso(confirmedTotal)} confirmed in total` : undefined}>Payments</ScreenTitle>

      {inReview.length > 0 && (
        <Card className="mb-4">
          <CardHeading>Sent for review</CardHeading>
          <List>
            {inReview.map((s) => {
              const st = submissionStatus(s.status);
              return (
                <li key={s.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[15px]">
                        {PAYMENT_METHOD_LABELS[s.method]} · <span className="num">{formatPeso(s.amount_centavos)}</span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Paid {formatDate(s.paid_on)} · Ref <span className="font-mono text-xs">{s.reference_number}</span>
                      </p>
                    </div>
                    <StatusPill tone={st.tone}>{st.label}</StatusPill>
                  </div>
                  {s.status === "rejected" && s.review_note && (
                    <p className="mt-2 rounded-xl bg-pill-negative-bg px-3 py-2 text-sm text-pill-negative-ink">{s.review_note}</p>
                  )}
                  {s.status === "rejected" && (
                    <Link href={`/boarder/bills/${s.invoice_id}#pay`} className="mt-1 inline-flex min-h-11 items-center text-sm font-medium text-teal">
                      Send a corrected payment
                    </Link>
                  )}
                </li>
              );
            })}
          </List>
        </Card>
      )}

      <Card>
        <CardHeading>Confirmed payments</CardHeading>
        {payments.length === 0 ? (
          <Empty>No confirmed payments yet. Once your landlord confirms a payment, its official receipt appears here.</Empty>
        ) : (
          <List>
            {payments.map((p) => (
              <li key={p.id}>
                <RowLink
                  href={`/receipts/${p.id}`}
                  trailing={
                    p.voided_at ? (
                      <StatusPill tone="neutral">Voided</StatusPill>
                    ) : (
                      <span className="num text-[15px] font-medium">{formatPeso(p.amount_centavos)}</span>
                    )
                  }
                >
                  <span className="block text-[15px]">
                    {PAYMENT_METHOD_LABELS[p.method]} · {formatDate(p.received_on)}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    Receipt <span className="font-mono text-xs">{p.receipt_number}</span>
                  </span>
                </RowLink>
              </li>
            ))}
          </List>
        )}
      </Card>
    </>
  );
}
