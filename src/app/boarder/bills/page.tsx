import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { invoiceStatus, StatusPill } from "@/components/app/status-pill";
import { balanceOf, invoiceTitle, isPayable, listInvoices } from "@/features/boarder/queries";
import { Card, CardHeading, Empty, List, RowLink, ScreenTitle } from "@/features/boarder/ui";
import { requireBoarder } from "@/lib/auth/session";
import { formatDate, formatMonth, manilaToday } from "@/lib/dates";
import { formatPeso } from "@/lib/money";

export const metadata: Metadata = { title: "Bills" };

export default async function BillsPage() {
  const viewer = await requireBoarder();
  const today = manilaToday();
  const invoices = (await listInvoices(viewer)).filter((i) => i.status !== "void");
  const unpaid = invoices.filter(isPayable).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const current = unpaid[0] ?? invoices[0];
  const totalDue = unpaid.reduce((s, i) => s + balanceOf(i), 0);
  const rest = invoices.filter((i) => i.id !== current?.id);

  return (
    <>
      <ScreenTitle sub={unpaid.length > 1 ? `${unpaid.length} unpaid bills · ${formatPeso(totalDue)} in total` : undefined}>Bills</ScreenTitle>

      {current ? (
        <Card>
          {(() => {
            const s = invoiceStatus(current.status, current.due_date, today);
            const payable = isPayable(current);
            return (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">{payable ? "Amount due" : "Latest bill"}</p>
                    <p className="num mt-1 text-[34px] leading-none font-semibold tracking-[-0.02em]">
                      {formatPeso(payable ? balanceOf(current) : current.total_centavos)}
                    </p>
                  </div>
                  <StatusPill tone={s.tone}>{s.label}</StatusPill>
                </div>
                <p className="mt-3 text-[15px]">{invoiceTitle(current, formatMonth)}</p>
                <p className="text-sm text-muted-foreground">
                  Due {formatDate(current.due_date)} · <span className="font-mono text-xs">{current.invoice_number}</span>
                </p>
                <div className="mt-5 grid gap-2">
                  {payable && (
                    <Button asChild className="h-12 rounded-xl text-[15px]">
                      <Link href={`/boarder/bills/${current.id}#pay`}>Submit payment</Link>
                    </Button>
                  )}
                  <Button asChild variant="outline" className="h-12 rounded-xl text-[15px]">
                    <Link href={`/boarder/bills/${current.id}`}>View bill details</Link>
                  </Button>
                </div>
              </>
            );
          })()}
        </Card>
      ) : (
        <Card>
          <Empty>No bills yet. Your monthly rent bill will appear here once your landlord issues it.</Empty>
        </Card>
      )}

      {rest.length > 0 && (
        <Card className="mt-4">
          <CardHeading>All bills</CardHeading>
          <List>
            {rest.map((i) => {
              const s = invoiceStatus(i.status, i.due_date, today);
              return (
                <li key={i.id}>
                  <RowLink
                    href={`/boarder/bills/${i.id}`}
                    trailing={
                      <span className="text-right">
                        <span className="num block text-[15px]">{formatPeso(isPayable(i) ? balanceOf(i) : i.total_centavos)}</span>
                        <StatusPill tone={s.tone} className="mt-1">
                          {s.label}
                        </StatusPill>
                      </span>
                    }
                  >
                    <span className="block text-[15px]">{invoiceTitle(i, formatMonth)}</span>
                    <span className="block text-sm text-muted-foreground">Due {formatDate(i.due_date)}</span>
                  </RowLink>
                </li>
              );
            })}
          </List>
        </Card>
      )}
    </>
  );
}
