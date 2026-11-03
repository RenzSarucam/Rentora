import Link from "next/link";
import { BrandMark } from "@/components/app/brand";
import { BottomNav } from "@/components/boarder/bottom-nav";
import { RegisterServiceWorker } from "@/components/boarder/register-sw";
import { requireBoarder } from "@/lib/auth/session";
import { getAnnouncementInbox } from "@/features/announcements/boarder-inbox";
import { AnnouncementBell } from "@/features/announcements/announcement-bell";
import { AnnouncementAlerts } from "@/features/announcements/announcement-alerts";

export default async function BoarderLayout({ children }: LayoutProps<"/boarder">) {
  // Server-side gate: only boarders reach these routes, whatever the screen size.
  const viewer = await requireBoarder();
  const { announcements, unreadCount } = await getAnnouncementInbox();

  return (
    <div className="min-h-dvh bg-ground">
      <header className="no-print sticky top-0 z-20 bg-ground/100">
        <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
          <Link href="/boarder/home" className="flex min-w-0 items-center gap-2" aria-label="Home">
            <BrandMark />
            <span className="truncate text-sm font-medium text-foreground">{viewer.orgName}</span>
          </Link>
          <AnnouncementBell unreadCount={unreadCount} />
        </div>
      </header>
      {viewer.status === "archived" && (
        <p className="mx-auto max-w-md px-4 pb-2 text-sm text-muted-foreground">
          Your stay has ended. You can still view your bills and receipts.
        </p>
      )}
      <main id="main" className="mx-auto max-w-md px-4 pt-1 pb-28">
        {children}
      </main>
      <BottomNav />
      <AnnouncementAlerts notices={announcements.filter((a) => a.isUnread).map((a) => ({
        id: a.id, title: a.title, preview: a.body.slice(0, 180), publishedAt: a.published_at,
      }))} />
      <RegisterServiceWorker />
    </div>
  );
}
