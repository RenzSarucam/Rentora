import { Skeleton } from "@/components/ui/skeleton";

/** Loading frame shared by the admin screens this feature owns: title row, then rows. */
export function PageSkeleton({ rows = 6, aside = false }: { rows?: number; aside?: boolean }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton className="mb-2 h-7 w-56" />
      <Skeleton className="mb-8 h-4 w-80" />
      <div className={aside ? "grid gap-8 lg:grid-cols-[1fr_320px]" : ""}>
        <div className="grid gap-3">
          {Array.from({ length: rows }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
        {aside && <Skeleton className="h-56 w-full" />}
      </div>
    </div>
  );
}
