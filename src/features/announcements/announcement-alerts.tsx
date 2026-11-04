"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/button";

export type AnnouncementNotice = { id: string; title: string; preview: string; publishedAt: string };
const noticeKey = (notice: AnnouncementNotice) => `${notice.id}:${notice.publishedAt}`;

export function AnnouncementAlerts({ notices }: { notices: AnnouncementNotice[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [active, setActive] = useState(true);
  const [paused, setPaused] = useState(false);
  const [session, setSession] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
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
    <Dialog.Root open onOpenChange={(open) => { if (!open) dismiss(noticeKey(current)); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="no-print fixed inset-0 z-50 bg-black/35 backdrop-blur-sm" />
        <Dialog.Content key={noticeKey(current)} ref={dialogRef} tabIndex={-1}
          className="no-print fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-2xl border border-border border-t-4 border-t-negative bg-background p-5 outline-none sm:p-6"
          onOpenAutoFocus={(event) => { event.preventDefault(); dialogRef.current?.focus(); }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (remaining.length === 1 && document.visibilityState === "visible" && !pathname.startsWith("/boarder/announcements")) {
              document.getElementById("boarder-announcement-link")?.focus();
            }
          }}
          onPointerDownOutside={(event) => event.preventDefault()}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={(event) => setPaused(event.currentTarget !== document.activeElement && event.currentTarget.contains(document.activeElement))}
          onFocusCapture={(event) => { if (event.target !== event.currentTarget) setPaused(true); }}
          onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}>
          <div className="pr-9">
            <p className="text-xs font-semibold text-negative">Unread announcement{remaining.length > 1 ? ` · ${remaining.length} waiting` : ""}</p>
            <Dialog.Title className="mt-2 line-clamp-3 text-xl leading-snug font-semibold break-words">{current.title}</Dialog.Title>
          </div>
          <Dialog.Close asChild>
            <button type="button" aria-label="Dismiss announcement"
              className="absolute top-2 right-2 inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-active focus-visible:outline-2 focus-visible:outline-ring">
              <X className="size-5" aria-hidden />
            </button>
          </Dialog.Close>
          <Dialog.Description className="line-clamp-4 text-sm leading-6 break-words text-muted-foreground">{current.preview}</Dialog.Description>
          <div className="border-t border-border pt-4">
            <Button asChild className="h-12 w-full rounded-xl">
              <Link href={`/boarder/announcements/${current.id}`}>Open announcement <ArrowRight className="size-4" aria-hidden /></Link>
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
