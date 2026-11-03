"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { markAnnouncementRead } from "./read-actions";

/** Runs after a visible detail page mounts, never during route prefetching. */
export function AnnouncementReadReceipt({ id, publishedAt }: { id: string; publishedAt: string }) {
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const markRead = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      const result = await markAnnouncementRead({ id, publishedAt });
      if (!result.ok) setError(result.error);
      else router.refresh();
    } catch {
      setError("Could not update read status. Please try again.");
    } finally {
      setPending(false);
    }
  }, [id, publishedAt, router]);

  useEffect(() => {
    function readWhenVisible() {
      if (document.visibilityState === "visible" && !started.current) {
        started.current = true;
        void markRead();
      }
    }
    readWhenVisible();
    document.addEventListener("visibilitychange", readWhenVisible);
    return () => document.removeEventListener("visibilitychange", readWhenVisible);
  }, [markRead]);

  if (!error) return null;
  return <div className="mt-4 rounded-lg border border-border p-3">
    <p role="alert" className="text-sm text-negative">{error}</p>
    <Button type="button" variant="outline" className="mt-2 min-h-10" disabled={pending} onClick={() => void markRead()}>Try again</Button>
  </div>;
}
