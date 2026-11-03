import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { StatusPill } from "@/components/app/status-pill";
import { AnnouncementReadReceipt } from "@/features/announcements/announcement-read-receipt";
import { getAnnouncementInbox } from "@/features/announcements/boarder-inbox";
import { Card } from "@/features/boarder/ui";
import { requireBoarder } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/dates";

export const metadata: Metadata = { title: "Announcement" };

export default async function AnnouncementPage({ params }: PageProps<"/boarder/announcements/[id]">) {
  await requireBoarder();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { announcements } = await getAnnouncementInbox();
  const announcement = announcements.find((item) => item.id === id);
  if (!announcement) notFound();

  return (
    <>
      <Link href="/boarder/announcements" className="mb-3 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" aria-hidden /> All announcements
      </Link>
      <Card className="border border-border">
        {announcement.pinned && <StatusPill tone="accent" className="mb-3">Pinned</StatusPill>}
        <h1 className="text-xl leading-snug font-semibold break-words">{announcement.title}</h1>
        <p className="mt-2 text-xs text-muted-foreground">{formatDateTime(announcement.published_at)}</p>
        <p className="mt-5 text-[15px] leading-7 whitespace-pre-wrap break-words">{announcement.body}</p>
      </Card>
      {announcement.isUnread && <AnnouncementReadReceipt key={`${id}:${announcement.published_at}`}
        id={id} publishedAt={announcement.published_at} />}
    </>
  );
}
