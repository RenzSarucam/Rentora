"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, X } from "lucide-react";

export type AnnouncementNotice = { id: string; title: string; preview: string; publishedAt: string };
const noticeKey = (notice: AnnouncementNotice) => `${notice.id}:${notice.publishedAt}`;

export function AnnouncementAlerts({ notices }: { notices: AnnouncementNotice[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [active, setActive] = useState(true);
  const [paused, setPaused] = useState(false);
  const [session, setSession] = useState(0);
  const remaining = notices.filter((notice) => !dismissed.has(noticeKey(notice)));
  const current = remaining[0];
  const key = current ? noticeKey(current) : null;
  const showing = active && !pathname.startsWith("/boarder/announcements") && Boolean(current);
  const dismiss = useCallback((item: string) => {
    setDismissed((previous) => new Set([...previous, item]));
    setPaused(false);
  }, []);

  useEffect(() => {
    function resume() {
      if (document.visibilityState !== "visible") return;
      setActive(true);
      setPaused(false);
      setDismissed(new Set());
      setSession((previous) => previous + 1);
      // The new server props include announcements published while the app was away.
      router.refresh();
    }
    function visibilityChanged() {
      if (document.visibilityState === "hidden") {
        setActive(false);
      } else {
        resume();
      }
    }
    function restored(event: PageTransitionEvent) {
      if (event.persisted) resume();
    }
    document.addEventListener("visibilitychange", visibilityChanged);
    window.addEventListener("pageshow", restored);
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 60000);
    return () => {
      document.removeEventListener("visibilitychange", visibilityChanged);
      window.removeEventListener("pageshow", restored);
      window.clearInterval(poll);
    };
  }, [router]);

  useEffect(() => {
    if (!showing || !key || paused || document.visibilityState !== "visible") return;
    const timer = window.setTimeout(() => dismiss(key), 5000);
    return () => window.clearTimeout(timer);
  }, [showing, key, paused, dismiss, session]);

  if (!showing || !current) return null;
  return (
    <section aria-label="Unread announcement" aria-live="polite" aria-atomic="true"
      className="no-print fixed inset-x-4 top-16 z-40 mx-auto max-w-md rounded-xl border border-border bg-background p-4"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}>
      <button type="button" aria-label="Dismiss announcement"
        className="absolute top-1 right-1 inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-active hover:text-foreground"
        onClick={() => {
          dismiss(noticeKey(current));
          if (remaining.length === 1) document.getElementById("boarder-announcement-link")?.focus();
        }}>
        <X className="size-4" aria-hidden />
      </button>
      <Link href={`/boarder/announcements/${current.id}`} className="block rounded-md pr-9">
        <p className="mb-1 text-xs font-medium text-negative">Unread announcement{remaining.length > 1 ? ` · ${remaining.length} waiting` : ""}</p>
        <h2 className="line-clamp-2 text-base leading-snug font-semibold break-words">{current.title}</h2>
        <p className="mt-2 line-clamp-2 text-sm leading-6 break-words text-muted-foreground">{current.preview}</p>
        <span className="mt-3 inline-flex min-h-8 items-center gap-2 text-sm font-medium">Open announcement <ArrowRight className="size-4" aria-hidden /></span>
      </Link>
    </section>
  );
}
