import type { Metadata } from "next";
import Link from "next/link";
import { StatusPill } from "@/components/app/status-pill";
import { getAnnouncementInbox } from "@/features/announcements/boarder-inbox";
import { Card, Empty, ScreenTitle } from "@/features/boarder/ui";
import { requireBoarder } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/dates";

export const metadata: Metadata = { title: "Announcements" };

export default async function AnnouncementsPage() {
  await requireBoarder();
  const { announcements, unreadCount } = await getAnnouncementInbox();

  return (
    <>
      <ScreenTitle sub={unreadCount ? `${unreadCount} unread. Open an announcement to read it.` : "You're all caught up."}>Announcements</ScreenTitle>
      {announcements.length === 0 ? (
        <Card>
          <Empty>No announcements yet. Notices about water, power, visitors or house rules will appear here.</Empty>
        </Card>
      ) : (
        <div className="grid gap-4">
          {announcements.map((a) => (
            <Card key={a.id} id={a.id} className="border border-border" aria-labelledby={`a-${a.id}`}>
              <Link href={`/boarder/announcements/${a.id}`} className="block rounded-md">
                <div className="flex items-start justify-between gap-3">
                  <h2 id={`a-${a.id}`} className="min-w-0 text-lg leading-snug font-semibold break-words">
                    {a.title}
                  </h2>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    {a.isUnread && <StatusPill tone="negative">Unread</StatusPill>}
                    {a.pinned && <StatusPill tone="accent">Pinned</StatusPill>}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(a.published_at)}</p>
                {/* Rendered as plain text: announcement bodies never become HTML. */}
                <p className="mt-3 line-clamp-2 text-[15px] leading-relaxed break-words text-muted-foreground">{a.body}</p>
                <span className="mt-3 inline-flex min-h-8 items-center text-sm font-medium">Open announcement →</span>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
