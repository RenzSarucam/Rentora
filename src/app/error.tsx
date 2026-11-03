"use client";

import { Button } from "@/components/ui/button";

// Shown for unexpected server errors. Never renders error details (they may contain internals).
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-[22px] font-semibold">Something went wrong</h1>
      <p className="max-w-sm text-sm text-muted-foreground">Please try again. If it keeps happening, sign out and back in.</p>
      <Button onClick={reset} variant="outline">
        Try again
      </Button>
    </main>
  );
}
