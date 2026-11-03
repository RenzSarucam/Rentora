import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { GenerateInvoicesDialog } from "@/features/billing/generate-dialog";
import { InvoiceTable } from "@/features/billing/invoice-table";
import { NewChargeDialog } from "@/features/billing/new-charge-dialog";
import {
  countBillableAssignments,
  getOrgBilling,
  listBoarderOptions,
  listInvoices,
  periodSummary,
} from "@/features/billing/queries";
import { addMonths, formatMonth, manilaToday, monthStart } from "@/lib/dates";
import { formatPeso, formatPesoShort } from "@/lib/money";

export const metadata: Metadata = { title: "Billing" };

export default async function BillingPage() {
  const [invoices, org, boarders, billable] = await Promise.all([
    listInvoices(),
    getOrgBilling(),
    listBoarderOptions(),
    countBillableAssignments(),
  ]);

  const current = monthStart(manilaToday());
  const summary = periodSummary(invoices, current);
  const generateMonths = [-1, 0, 1, 2].map((offset) => {
    const value = addMonths(current, offset);
    return { value, label: formatMonth(value), generated: periodSummary(invoices, value).count };
  });
  // Bill the current month first; once it is done, offer the next one.
  const defaultMonth = summary.count > 0 ? addMonths(current, 1) : current;

  const filterMonths = [...new Set(invoices.map((i) => i.period).filter((p): p is string => Boolean(p)))]
    .sort()
    .reverse()
    .map((value) => ({ value, label: formatMonth(value) }));

  const outstanding = invoices.reduce((s, i) => s + (i.status === "open" || i.status === "partially_paid" ? i.balance : 0), 0);
  const overdue = invoices.filter((i) => i.overdue);

  return (
    <div className="lg:flex lg:h-full lg:min-h-0 lg:flex-col">
      <PageHeader
        className="shrink-0"
        title="Billing"
        description={
          summary.count
            ? `${formatMonth(current)}: ${summary.count} rent invoice${summary.count === 1 ? "" : "s"}, ${formatPesoShort(summary.billed)} billed, ${formatPesoShort(summary.collected)} collected`
            : `${formatMonth(current)} rent has not been billed yet. ${billable} boarder${billable === 1 ? "" : "s"} with a bed.`
        }
        actions={
          <>
            <NewChargeDialog boarders={boarders} />
            <GenerateInvoicesDialog months={generateMonths} defaultMonth={defaultMonth} dueDay={org.defaultDueDay} billableCount={billable} />
          </>
        }
      />

      <dl className="mb-6 grid shrink-0 grid-cols-2 divide-border rounded-lg border border-border sm:grid-cols-4 sm:divide-x">
        <div className="p-4">
          <dt className="text-sm text-muted-foreground">Billed in {formatMonth(current).split(" ")[0]}</dt>
          <dd className="num mt-1 text-2xl">{formatPeso(summary.billed)}</dd>
        </div>
        <div className="p-4">
          <dt className="text-sm text-muted-foreground">Collected on those</dt>
          <dd className="num mt-1 text-2xl">{formatPeso(summary.collected)}</dd>
          {summary.billed > 0 && (
            <p className="num mt-0.5 text-xs text-muted-foreground">{Math.round((summary.collected / summary.billed) * 100)}% of billed</p>
          )}
        </div>
        <div className="border-t border-border p-4 sm:border-t-0">
          <dt className="text-sm text-muted-foreground">Unpaid, all bills</dt>
          <dd className="num mt-1 text-2xl">{formatPeso(outstanding)}</dd>
        </div>
        <div className="border-t border-border p-4 sm:border-t-0">
          <dt className="text-sm text-muted-foreground">Overdue</dt>
          <dd className={`num mt-1 text-2xl ${overdue.length ? "text-negative" : ""}`}>{formatPeso(overdue.reduce((s, i) => s + i.balance, 0))}</dd>
          <p className="num mt-0.5 text-xs text-muted-foreground">
            {overdue.length ? `${overdue.length} invoice${overdue.length === 1 ? "" : "s"} past due` : "Nothing past due"}
          </p>
        </div>
      </dl>

      <InvoiceTable invoices={invoices} months={filterMonths} />
    </div>
  );
}
