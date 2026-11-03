import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Announcement = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  publishedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AnnouncementState = "draft" | "published" | "archived";

export function announcementState(a: Pick<Announcement, "publishedAt" | "archivedAt">): AnnouncementState {
  if (a.archivedAt) return "archived";
  return a.publishedAt ? "published" : "draft";
}

type Row = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  published_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function listAnnouncements(): Promise<Announcement[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .select("id, title, body, pinned, published_at, archived_at, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(300)
    .returns<Row[]>();
  if (error) throw new Error("Could not load announcements");
  const rank = (a: Announcement) => (a.archivedAt ? 2 : a.pinned ? 0 : 1);
  return data
    .map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      pinned: r.pinned,
      publishedAt: r.published_at,
      archivedAt: r.archived_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }))
    .sort((a, b) => rank(a) - rank(b) || (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt));
}
