import { Skeleton } from "@/components/ui/skeleton";

export default function AuthLoading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="grid gap-5">
      <Skeleton className="h-7 w-36" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="mt-3 h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}
