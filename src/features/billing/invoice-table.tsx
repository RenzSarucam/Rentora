"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DataTable, type Column } from "@/components/app/data-table";
import { StatusPill } from "@/components/app/status-pill";
import { formatDate } from "@/lib/dates";
import { formatPeso } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { InvoiceListItem } from "./queries";

const columns: Column<InvoiceListItem>[] = [
  {
    accessorKey: "number",
    header: "Invoice",
    meta: { className: "whitespace-nowrap" },
    cell: ({ row }) => (
      <Link href={`/admin/billing/${row.original.id}`} className="font-mono text-[13px] hover:underline">
        {row.original.number}
      </Link>
    ),
  },
  { accessorKey: "boarder", header: "Boarder", meta: { className: "whitespace-nowrap" } },
  { accessorKey: "periodLabel", header: "For", meta: { className: "whitespace-nowrap" } },
  {
    accessorKey: "dueDate",
    header: "Due",
    meta: { className: "whitespace-nowrap" },
    cell: ({ row }) => (
      <span className={cn(row.original.overdue && "font-medium text-negative")}>{formatDate(row.original.dueDate)}</span>
    ),
  },
  { accessorKey: "total", header: "Total", meta: { numeric: true }, cell: ({ row }) => formatPeso(row.original.total) },
  { accessorKey: "paid", header: "Paid", meta: { numeric: true }, cell: ({ row }) => (row.original.paid ? formatPeso(row.original.paid) : "—") },
  {
    accessorKey: "balance",
    header: "Balance",
    meta: { numeric: true },
    cell: ({ row }) => <span className={cn(row.original.balance > 0 && "font-medium")}>{formatPeso(row.original.balance)}</span>,
  },
  {
    accessorKey: "statusLabel",
    header: "Status",
    cell: ({ row }) => <StatusPill tone={row.original.statusTone}>{row.original.statusLabel}</StatusPill>,
  },
];

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "unpaid", label: "Unpaid" },
  { value: "overdue", label: "Overdue" },
  { value: "paid", label: "Paid" },
  { value: "void", label: "Void" },
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number]["value"];

function matches(i: InvoiceListItem, status: StatusFilter) {
  switch (status) {
    case "unpaid":
      return i.status === "open" || i.status === "partially_paid";
    case "overdue":
      return i.overdue;
    case "paid":
      return i.status === "paid";
    case "void":
      return i.status === "void";
    default:
      return true;
  }
}

export function InvoiceTable({ invoices, months }: { invoices: InvoiceListItem[]; months: { value: string; label: string }[] }) {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [month, setMonth] = useState("all");
  const counts = useMemo(
    () => Object.fromEntries(STATUS_FILTERS.map((f) => [f.value, invoices.filter((i) => matches(i, f.value)).length])),
    [invoices],
  );
  const rows = useMemo(
    () => invoices.filter((i) => matches(i, status) && (month === "all" || i.period === month || (!i.period && i.issueDate.startsWith(month.slice(0, 7))))),
    [invoices, status, month],
  );

  return (
    <div className="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
      <div role="tablist" aria-label="Filter by status" className="mb-4 flex shrink-0 gap-5 overflow-x-auto overflow-y-hidden border-b border-border">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            role="tab"
            type="button"
            aria-selected={status === f.value}
            onClick={() => setStatus(f.value)}
            className={cn(
              "-mb-px flex h-10 items-center gap-1.5 border-b-2 border-transparent text-sm whitespace-nowrap text-muted-foreground hover:text-foreground",
              status === f.value && "border-teal font-medium text-foreground",
            )}
          >
            {f.label}
            <span className="num text-xs text-muted-foreground">{counts[f.value]}</span>
          </button>
        ))}
      </div>
      <DataTable
        fitViewport
        scrollLabel="Invoices"
        data={rows}
        columns={columns}
        searchPlaceholder="Search invoice or boarder"
        emptyMessage={invoices.length ? "No invoices match this filter." : "No invoices yet. Generate this month's rent to get started."}
        countLabel={(n) => `${n} invoice${n === 1 ? "" : "s"}`}
        rowClassName={(i) => (i.status === "void" ? "text-muted-foreground" : undefined)}
        toolbar={
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            aria-label="Filter by month"
            className="h-9 rounded-md border border-input bg-background px-2.5 text-sm"
          >
            <option value="all">All months</option>
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        }
      />
    </div>
  );
}
