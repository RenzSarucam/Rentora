import Link from "next/link";
import { Bell } from "lucide-react";

export function AnnouncementBell({ unreadCount }: { unreadCount: number }) {
  return (
    <Link id="boarder-announcement-link" href="/boarder/announcements"
      className="relative inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-active hover:text-foreground"
      aria-label={unreadCount > 0 ? `Announcements, ${unreadCount} unread` : "Announcements"}>
      <Bell className="size-5" aria-hidden />
      {unreadCount > 0 && <span aria-hidden className="num absolute top-0.5 right-0 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-negative px-1 text-[10px] leading-none font-semibold text-white">
        {unreadCount > 9 ? "9+" : unreadCount}
      </span>}
    </Link>
  );
}
