import "server-only";
import { cache } from "react";
import { requireBoarder } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type BoarderAnnouncement = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  published_at: string;
  isUnread: boolean;
};
type PublishedRow = Omit<BoarderAnnouncement, "isUnread">;
type ReadRow = { announcement_id: string; read_published_at: string };

/** Cached only within one server request; all reads use the viewer's RLS client. */
export const getAnnouncementInbox = cache(async () => {
  const viewer = await requireBoarder();
  const supabase = await createClient();
  const batch = 500;
  const now = new Date().toISOString();
  const loadAnnouncements = async () => {
    const rows: PublishedRow[] = [];
    for (let offset = 0; ; offset += batch) {
      const { data, error } = await supabase.from("announcements")
        .select("id, title, body, pinned, published_at")
        .eq("organization_id", viewer.orgId).not("published_at", "is", null)
        .lte("published_at", now).is("archived_at", null)
        .order("pinned", { ascending: false }).order("published_at", { ascending: false }).order("id")
        .range(offset, offset + batch - 1).returns<PublishedRow[]>();
      if (error) throw new Error("Could not load announcements");
      rows.push(...data);
      if (data.length < batch) return rows;
    }
  };
  const loadReads = async () => {
    const rows: ReadRow[] = [];
    for (let offset = 0; ; offset += batch) {
      const { data, error } = await supabase.from("announcement_reads")
        .select("announcement_id, read_published_at").eq("member_id", viewer.memberId)
        .order("announcement_id").range(offset, offset + batch - 1).returns<ReadRow[]>();
      if (error) throw new Error("Could not load announcement read status");
      rows.push(...data);
      if (data.length < batch) return rows;
    }
  };
  const [published, reads] = await Promise.all([loadAnnouncements(), loadReads()]);
  const versions = new Map(reads.map((read) => [read.announcement_id, read.read_published_at]));
  const announcements: BoarderAnnouncement[] = published.map((announcement) => ({
    ...announcement, isUnread: versions.get(announcement.id) !== announcement.published_at,
  }));
  return { announcements, unreadCount: announcements.filter((announcement) => announcement.isUnread).length };
});
