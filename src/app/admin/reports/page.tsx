import { roomLabel } from "@/lib/room-label";
import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader, SectionHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/app/status-pill";
import { Button } from "@/components/ui/button";
import { listRooms } from "@/features/rooms/queries";
import { CollectionsChart } from "@/features/reports/collections-chart";
import { ReportFilters } from "@/features/reports/report-filters";
import { agingSummary, balancesByBoarder, collectionsByMonth, overdueInvoices, sum, totalsByMethod } from "@/features/reports/compute";
import { openInvoices, paymentsBetween, readRange } from "@/features/reports/queries";
import { addMonths, formatDate, formatMonth } from "@/lib/dates";
import { formatPeso } from "@/lib/money";
import { PAYMENT_METHOD_LABELS } from "@/lib/validation";

export const metadata: Metadata = { title: "Reports" };

const monthLabel = new Intl.DateTimeFormat("en-PH", { timeZone: "UTC", month: "short" });
const th = "h-10 px-3 text-xs font-medium text-muted-foreground first:pl-0 last:pr-0";
const td = "h-11 px-3 first:pl-0 last:pr-0";

function ExportLink({ kind, query = "" }: { kind: string; query?: string }) {
  return (
    <Button asChild variant="outline" size="sm">
      <a href={`/admin/reports/export/${kind}${query}`} download>
        <Download aria-hidden /> CSV
      </a>
    </Button>
  );
}

export default async function ReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  const params = await searchParams;
  const range = readRange(params);
  const chartFrom = addMonths(range.currentMonth, -(range.months - 1));
  const [rooms, chartPayments, rangePayments, invoices] = await Promise.all([
    listRooms(),
    paymentsBetween(chartFrom, range.today),
    paymentsBetween(range.from, range.to),
    openInvoices(),
  ]);

  const roomRows = rooms.map((r) => {
    const occupied = r.beds.filter((b) => b.occupant).length;
    const maintenance = r.beds.filter((b) => !b.occupant && (b.status === "maintenance" || r.status === "maintenance")).length;
    return { id: r.id, code: r.code, property: r.propertyName, beds: r.beds.length, occupied, maintenance, vacant: r.beds.length - occupied - maintenance, rate: r.rate };
  });
  const bedTotal = sum(roomRows, (r) => r.beds);
  const occupiedTotal = sum(roomRows, (r) => r.occupied);

  const months = collectionsByMonth(chartPayments, range.currentMonth, range.months);
  const chartData = months.map((m) => ({ ...m, label: monthLabel.format(new Date(`${m.month}T00:00:00Z`)) }));
  const thisMonth = months[months.length - 1];
  const byMethod = totalsByMethod(rangePayments);
  const rangeTotal = sum(rangePayments, (p) => p.amount);

  const balances = balancesByBoarder(invoices, range.today);
  const overdue = overdueInvoices(invoices, range.today);
  const aging = agingSummary(overdue);
  const rangeQuery = `?from=${range.from}&to=${range.to}`;

  return (
    <>
      <PageHeader
        title="Reports"
        description={`Collected ${formatPeso(thisMonth.amount)} in ${formatMonth(range.currentMonth)} · ${formatPeso(sum(balances, (b) => b.balance))} still unpaid · ${formatPeso(sum(overdue, (o) => o.balance))} overdue`}
      />

      <ReportFilters key={JSON.stringify([params.from, params.to, params.months])} range={range} />

      <div className="grid min-w-0 gap-14 [&>section]:min-w-0">
        <section aria-labelledby="collections">
          <SectionHeader title={<span id="collections">Collections</span>} action={<ExportLink kind="collections" query={`?months=${range.months}`} />} />
          <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="min-w-0 rounded-lg border border-border p-5">
              <p className="text-sm text-muted-foreground">Collected per month, last {range.months} months</p>
              <p className="num mt-1 mb-4 text-[28px] leading-none">
                {formatPeso(thisMonth.amount)} <span className="text-sm text-muted-foreground">in {formatMonth(range.currentMonth)} so far</span>
              </p>
              <CollectionsChart data={chartData} currentMonth={range.currentMonth} />
            </div>
            <div className="min-w-0 overflow-x-auto">
              <p className="mb-2 text-sm text-muted-foreground">
                By method, {formatDate(range.from)} – {formatDate(range.to)}
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th scope="col" className={th}>Method</th>
                    <th scope="col" className={`${th} text-right`}>Payments</th>
                    <th scope="col" className={`${th} text-right`}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {byMethod.map((m) => (
                    <tr key={m.method} className="border-b border-rule">
                      <td className={td}>{PAYMENT_METHOD_LABELS[m.method as keyof typeof PAYMENT_METHOD_LABELS] ?? m.method}</td>
                      <td className={`${td} num text-right`}>{m.count}</td>
                      <td className={`${td} num text-right`}>{formatPeso(m.amount)}</td>
                    </tr>
                  ))}
                  {byMethod.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-muted-foreground">No payments in this range.</td>
                    </tr>
                  )}
                </tbody>
                {byMethod.length > 0 && (
                  <tfoot>
                    <tr className="font-medium">
                      <td className={td}>Total</td>
                      <td className={`${td} num text-right`}>{rangePayments.length}</td>
                      <td className={`${td} num text-right`}>{formatPeso(rangeTotal)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </section>

        <section aria-labelledby="outstanding">
          <SectionHeader title={<span id="outstanding">Outstanding balances</span>} action={<ExportLink kind="outstanding" />} />
          {balances.length === 0 ? (
            <EmptyState title="Every boarder is paid up">No open invoices right now.</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th scope="col" className={th}>Boarder</th>
                    <th scope="col" className={`${th} text-right`}>Open invoices</th>
                    <th scope="col" className={`${th} text-right`}>Billed</th>
                    <th scope="col" className={`${th} text-right`}>Paid</th>
                    <th scope="col" className={`${th} text-right`}>Balance</th>
                    <th scope="col" className={`${th} text-right`}>Oldest due</th>
                  </tr>
                </thead>
                <tbody>
                  {balances.map((b) => (
                    <tr key={b.memberId} className="border-b border-rule">
                      <td className={td}>
                        <Link href={`/admin/boarders/${b.memberId}`} className="hover:underline">{b.boarder}</Link>
                      </td>
                      <td className={`${td} num text-right`}>{b.invoices}</td>
                      <td className={`${td} num text-right`}>{formatPeso(b.billed)}</td>
                      <td className={`${td} num text-right`}>{formatPeso(b.paid)}</td>
                      <td className={`${td} num text-right font-medium`}>{formatPeso(b.balance)}</td>
                      <td className={`${td} num text-right ${b.overdue ? "text-negative" : ""}`}>{formatDate(b.oldestDue)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-medium">
                    <td className={td}>{balances.length} boarders</td>
                    <td className={`${td} num text-right`}>{sum(balances, (b) => b.invoices)}</td>
                    <td className={`${td} num text-right`}>{formatPeso(sum(balances, (b) => b.billed))}</td>
                    <td className={`${td} num text-right`}>{formatPeso(sum(balances, (b) => b.paid))}</td>
                    <td className={`${td} num text-right`}>{formatPeso(sum(balances, (b) => b.balance))}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        <section aria-labelledby="overdue">
          <SectionHeader title={<span id="overdue">Overdue invoices</span>} action={<ExportLink kind="overdue" />} />
          <dl className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
            {aging.map((a) => (
              <div key={a.key} className="bg-background p-4">
                <dt className="text-sm text-muted-foreground">{a.label} late</dt>
                <dd className={`num mt-1 text-xl ${a.amount > 0 && a.min > 60 ? "text-negative" : ""}`}>{formatPeso(a.amount)}</dd>
                <dd className="num text-xs text-muted-foreground">{a.count} invoice{a.count === 1 ? "" : "s"}</dd>
              </div>
            ))}
          </dl>
          {overdue.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing is past due.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th scope="col" className={th}>Invoice</th>
                    <th scope="col" className={th}>Boarder</th>
                    <th scope="col" className={`${th} text-right`}>Due</th>
                    <th scope="col" className={`${th} text-right`}>Days late</th>
                    <th scope="col" className={`${th} text-right`}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {overdue.map((o) => (
                    <tr key={o.id} className="border-b border-rule">
                      <td className={td}>
                        <Link href={`/admin/billing/${o.id}`} className="font-mono text-[13px] hover:underline">{o.invoiceNumber}</Link>
                      </td>
                      <td className={td}>{o.boarder}</td>
                      <td className={`${td} num text-right`}>{formatDate(o.dueDate)}</td>
                      <td className={`${td} num text-right`}>{o.daysOverdue > 60 ? <StatusPill tone="negative">{o.daysOverdue}</StatusPill> : o.daysOverdue}</td>
                      <td className={`${td} num text-right`}>{formatPeso(o.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section aria-labelledby="occupancy">
          <SectionHeader title={<span id="occupancy">Occupancy</span>} action={<ExportLink kind="occupancy" />} />
          {roomRows.length === 0 ? (
            <EmptyState title="No rooms yet" action={<Button asChild variant="outline"><Link href="/admin/rooms">Add rooms</Link></Button>}>
              Occupancy appears once rooms and beds exist.
            </EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full max-w-4xl text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th scope="col" className={th}>Room</th>
                    <th scope="col" className={`${th} text-right`}>Beds</th>
                    <th scope="col" className={`${th} text-right`}>Occupied</th>
                    <th scope="col" className={`${th} text-right`}>Vacant</th>
                    <th scope="col" className={`${th} text-right`}>Maintenance</th>
                    <th scope="col" className={`${th} text-right`}>Rate per bed</th>
                  </tr>
                </thead>
                <tbody>
                  {roomRows.map((r) => (
                    <tr key={r.id} className="border-b border-rule">
                      <td className={td}>{roomLabel(r.code)}</td>
                      <td className={`${td} num text-right`}>{r.beds}</td>
                      <td className={`${td} num text-right`}>{r.occupied}</td>
                      <td className={`${td} num text-right`}>{r.vacant}</td>
                      <td className={`${td} num text-right`}>{r.maintenance}</td>
                      <td className={`${td} num text-right`}>{formatPeso(r.rate)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-medium">
                    <td className={td}>
                      {bedTotal ? Math.round((occupiedTotal / bedTotal) * 100) : 0}% occupied
                    </td>
                    <td className={`${td} num text-right`}>{bedTotal}</td>
                    <td className={`${td} num text-right`}>{occupiedTotal}</td>
                    <td className={`${td} num text-right`}>{sum(roomRows, (r) => r.vacant)}</td>
                    <td className={`${td} num text-right`}>{sum(roomRows, (r) => r.maintenance)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        <section aria-labelledby="history">
          <SectionHeader
            title={<span id="history">Payment history, {formatDate(range.from)} – {formatDate(range.to)}</span>}
            action={<ExportLink kind="payments" query={rangeQuery} />}
          />
          {rangePayments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No confirmed payments in this range.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th scope="col" className={th}>Received</th>
                    <th scope="col" className={th}>Receipt</th>
                    <th scope="col" className={th}>Boarder</th>
                    <th scope="col" className={th}>Method</th>
                    <th scope="col" className={th}>Reference</th>
                    <th scope="col" className={`${th} text-right`}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {rangePayments.slice(0, 200).map((p) => (
                    <tr key={p.id} className="border-b border-rule">
                      <td className={`${td} num`}>{formatDate(p.receivedOn)}</td>
                      <td className={td}>
                        <Link href={`/receipts/${p.id}`} className="font-mono text-[13px] hover:underline">{p.receiptNumber}</Link>
                      </td>
                      <td className={td}>{p.boarder}</td>
                      <td className={td}>{PAYMENT_METHOD_LABELS[p.method as keyof typeof PAYMENT_METHOD_LABELS] ?? p.method}</td>
                      <td className={`${td} font-mono text-[13px] text-muted-foreground`}>{p.reference ?? "—"}</td>
                      <td className={`${td} num text-right`}>{formatPeso(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-medium">
                    <td className={td} colSpan={5}>
                      {rangePayments.length} payments{rangePayments.length > 200 ? " (first 200 shown; the CSV has all)" : ""}
                    </td>
                    <td className={`${td} num text-right`}>{formatPeso(rangeTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
