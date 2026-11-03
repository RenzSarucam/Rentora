"use client";

import Link from "next/link";
import { DataTable, type Column } from "@/components/app/data-table";
import { StatusPill } from "@/components/app/status-pill";
import { formatDate } from "@/lib/dates";
import { formatPeso } from "@/lib/money";
import { PAYMENT_METHOD_LABELS } from "@/lib/validation";
import { voidPayment } from "./actions";
import type { PaymentListItem } from "./queries";
import { ReasonDialog } from "./reason-dialog";

type Method = keyof typeof PAYMENT_METHOD_LABELS;

const columns: Column<PaymentListItem>[] = [
  {
    accessorKey: "receiptNumber",
    header: "Receipt",
    cell: ({ row }) => (
      <Link href={`/receipts/${row.original.id}`} className="font-mono text-[13px] hover:underline">
        {row.original.receiptNumber}
      </Link>
    ),
  },
  { accessorKey: "boarder", header: "Boarder" },
  {
    id: "method",
    accessorFn: (p) => PAYMENT_METHOD_LABELS[p.method as Method] ?? p.method,
    header: "Method",
    cell: ({ row }) => (
      <span>
        {PAYMENT_METHOD_LABELS[row.original.method as Method] ?? row.original.method}
        {row.original.online && <span className="text-muted-foreground"> · online</span>}
      </span>
    ),
  },
  {
    accessorKey: "reference",
    header: "Reference",
    cell: ({ row }) => <span className="font-mono text-[13px] text-muted-foreground">{row.original.reference || "—"}</span>,
  },
  { accessorKey: "receivedOn", header: "Received", cell: ({ row }) => formatDate(row.original.receivedOn) },
  {
    accessorKey: "amount",
    header: "Amount",
    meta: { numeric: true },
    cell: ({ row }) => (
      <span className={row.original.voided ? "text-muted-foreground line-through" : undefined}>{formatPeso(row.original.amount)}</span>
    ),
  },
  {
    id: "status",
    accessorFn: (p) => (p.voided ? "Void" : "Posted"),
    header: "Status",
    cell: ({ row }) =>
      row.original.voided ? (
        <span title={row.original.voidReason ?? undefined}>
          <StatusPill tone="neutral">Void</StatusPill>
        </span>
      ) : (
        <StatusPill tone="positive">Posted</StatusPill>
      ),
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    enableSorting: false,
    meta: { className: "text-right" },
    cell: ({ row }) =>
      row.original.voided ? null : (
        <ReasonDialog
          trigger="Void"
          triggerVariant="ghost"
          triggerSize="sm"
          title={`Void receipt ${row.original.receiptNumber}?`}
          description={`${formatPeso(row.original.amount)} from ${row.original.boarder} is reversed and the invoices it paid reopen. The receipt stays on record, marked void.`}
          fieldLabel="Reason"
          placeholder="Recorded under the wrong boarder"
          submitLabel="Void payment"
          destructive
          action={(reason) => voidPayment({ paymentId: row.original.id, reason })}
        />
      ),
  },
];

export function PaymentsTable({ payments }: { payments: PaymentListItem[] }) {
  return (
    <DataTable
      data={payments}
      columns={columns}
      searchPlaceholder="Search receipt, boarder or reference"
      emptyMessage="No payments yet. Recorded and confirmed payments appear here with their receipts."
      countLabel={(n) => `${n} payment${n === 1 ? "" : "s"}`}
      rowClassName={(p) => (p.voided ? "text-muted-foreground" : undefined)}
    />
  );
}
