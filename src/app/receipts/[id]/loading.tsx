import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="min-h-dvh bg-ground px-4 py-6" aria-busy="true" aria-label="Loading receipt">
      <Skeleton className="mx-auto h-[520px] max-w-2xl rounded-2xl" />
    </div>
  );
}
