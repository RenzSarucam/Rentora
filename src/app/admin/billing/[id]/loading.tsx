import { TableSkeleton } from "@/features/billing/table-skeleton";

export default function Loading() {
  return <TableSkeleton figures={0} rows={4} />;
}
