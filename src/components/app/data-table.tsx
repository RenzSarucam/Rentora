"use client";

import { useState } from "react";
import {
  columnFilteringFeature,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const tableFeatureSet = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text, basic: sortFn_basic },
  columnFilteringFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  filterFns: { includesString: filterFn_includesString },
});

export type Features = typeof tableFeatureSet;
export type Column<T extends RowData> = ColumnDef<Features, T> & { meta?: { numeric?: boolean; className?: string } };

/**
 * Sortable, searchable table. Numbers are right-aligned in tabular figures (meta.numeric).
 * Rows are rules and alignment: no zebra, no header band.
 */
export function DataTable<T extends RowData>({
  data,
  columns,
  searchPlaceholder,
  emptyMessage,
  toolbar,
  countLabel,
  rowClassName,
}: {
  data: T[];
  columns: Column<T>[];
  searchPlaceholder?: string;
  emptyMessage: React.ReactNode;
  toolbar?: React.ReactNode;
  countLabel?: (n: number) => string;
  rowClassName?: (row: T) => string | undefined;
}) {
  const [globalFilter, setGlobalFilter] = useState("");
  const table = useTable({
    features: tableFeatureSet,
    columns,
    data,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: "includesString",
  });
  const rows = table.getRowModel().rows;

  return (
    <div>
      {(searchPlaceholder || toolbar || countLabel) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {searchPlaceholder && (
              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  value={globalFilter}
                  onChange={(e) => setGlobalFilter(e.target.value)}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  className="h-9 pl-8"
                  type="search"
                />
              </div>
            )}
            {toolbar}
          </div>
          {countLabel && <p className="text-sm text-muted-foreground num">{countLabel(rows.length)}</p>}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id} className="border-b border-border">
                {group.headers.map((header) => {
                  const meta = (header.column.columnDef as Column<T>).meta;
                  const sorted = header.column.getIsSorted();
                  const canSort = header.column.getCanSort();
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                      className={cn(
                        "h-10 px-3 text-left text-xs font-medium whitespace-nowrap text-muted-foreground first:pl-0 last:pr-0",
                        meta?.numeric && "text-right",
                        meta?.className,
                      )}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn("inline-flex items-center gap-1 rounded-sm hover:text-foreground", meta?.numeric && "flex-row-reverse")}
                        >
                          <table.FlexRender header={header} />
                          {sorted === "asc" && <ArrowUp className="size-3" aria-hidden />}
                          {sorted === "desc" && <ArrowDown className="size-3" aria-hidden />}
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={cn("border-b border-rule last:border-0 hover:bg-raised/60", rowClassName?.(row.original))}>
                {row.getAllCells().map((cell) => {
                  const meta = (cell.column.columnDef as Column<T>).meta;
                  return (
                    <td
                      key={cell.id}
                      className={cn("h-12 px-3 align-middle first:pl-0 last:pr-0", meta?.numeric && "text-right num", meta?.className)}
                    >
                      <table.FlexRender cell={cell} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="border-b border-rule py-10 text-center text-sm text-muted-foreground">
            {data.length === 0 ? emptyMessage : "Nothing matches your search."}
          </p>
        )}
      </div>
    </div>
  );
}
