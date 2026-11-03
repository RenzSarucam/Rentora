import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder with the real page's shape: title row, figure strip, then table rows. */
export function TableSkeleton({ figures = 4, rows = 8 }: { figures?: number; rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="mt-2 mb-6 h-4 w-80 max-w-full" />
      {figures > 0 && (
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: figures }, (_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      )}
      <Skeleton className="mb-3 h-9 w-72 max-w-full" />
      <div className="grid gap-2">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
    </div>
  );
}
