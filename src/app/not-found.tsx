import Link from "next/link";
import { Wordmark } from "@/components/app/brand";

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-ground px-6 text-center">
      <Wordmark />
      <h1 className="text-[22px] font-semibold">This page does not exist</h1>
      <p className="max-w-sm text-sm text-muted-foreground">It may have been moved, or you may not have access to it.</p>
      <Link href="/" className="text-sm font-medium underline underline-offset-4">
        Go to your home screen
      </Link>
    </main>
  );
}
