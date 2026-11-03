import { Skeleton } from "@/components/ui/skeleton";

export default function BoarderLoading() {
  return (
    <div className="grid gap-4 pt-2" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-7 w-40 rounded-lg" />
      <div className="rounded-[20px] bg-background p-5">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mt-3 h-10 w-48" />
        <Skeleton className="mt-4 h-4 w-36" />
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
        </div>
      </div>
      <div className="grid gap-3 rounded-[20px] bg-background p-5">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
      </div>
    </div>
  );
}
