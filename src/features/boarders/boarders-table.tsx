"use client";

import Link from "next/link";
import { DataTable, type Column } from "@/components/app/data-table";
import { StatusPill } from "@/components/app/status-pill";
import { formatPeso } from "@/lib/money";
import type { BoarderListItem } from "./queries";

const STATUS: Record<BoarderListItem["status"], { label: string; tone: "warning" | "positive" | "neutral" }> = {
  invited: { label: "Invited", tone: "warning" },
  active: { label: "Active", tone: "positive" },
  archived: { label: "Archived", tone: "neutral" },
};

type Row = BoarderListItem & { bedText: string };

const columns: Column<Row>[] = [
  {
    accessorKey: "name",
    header: "Boarder",
    cell: ({ row }) => (
      <div className="min-w-0">
        <Link href={`/admin/boarders/${row.original.id}`} className="font-medium text-foreground hover:underline">
          {row.original.name}
        </Link>
        <p className="truncate text-xs text-muted-foreground">{row.original.email}</p>
      </div>
    ),
  },
  {
    accessorKey: "phone",
    header: "Mobile",
    enableSorting: false,
    cell: ({ row }) => row.original.phone ?? <span className="text-muted-foreground">—</span>,
  },
  {
    accessorKey: "bedText",
    header: "Room · bed",
    cell: ({ row }) =>
      row.original.bed ? (
        <Link href={`/admin/rooms/${row.original.bed.roomId}`} className="hover:underline">
          {row.original.bedText}
        </Link>
      ) : (
        <span className="text-muted-foreground">No bed</span>
      ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusPill tone={STATUS[row.original.status].tone}>{STATUS[row.original.status].label}</StatusPill>,
  },
  {
    accessorKey: "outstanding",
    header: "Balance",
    meta: { numeric: true },
    cell: ({ row }) =>
      row.original.outstanding > 0 ? formatPeso(row.original.outstanding) : <span className="text-muted-foreground">{formatPeso(0)}</span>,
  },
];

export function BoardersTable({ boarders, emptyMessage }: { boarders: BoarderListItem[]; emptyMessage: React.ReactNode }) {
  const rows: Row[] = boarders.map((b) => ({ ...b, bedText: b.bed ? `Room ${b.bed.roomCode} · ${b.bed.label}` : "" }));
  return (
    <DataTable
      data={rows}
      columns={columns}
      searchPlaceholder="Search name, email, room"
      emptyMessage={emptyMessage}
      countLabel={(n) => `${n} boarder${n === 1 ? "" : "s"}`}
    />
  );
}
