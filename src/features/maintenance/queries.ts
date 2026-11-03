import "server-only";
import { createClient } from "@/lib/supabase/server";

export type MaintenanceStatus = "open" | "in_progress" | "resolved" | "cancelled";
export type MaintenancePriority = "low" | "normal" | "urgent";

export type RequestListItem = {
  id: string;
  title: string;
  boarder: string;
  room: string | null;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  createdAt: string;
  updatedAt: string;
};

type RequestRow = {
  id: string;
  title: string;
  description: string;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  photo_path: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  member_id: string;
  rooms: { code: string } | null;
  organization_members: { user_id: string; profiles: { full_name: string; email: string; phone: string | null } | null } | null;
};

const SELECT = `id, title, description, priority, status, photo_path, resolved_at, created_at, updated_at, member_id,
  rooms(code), organization_members(user_id, profiles(full_name, email, phone))`;

const nameOf = (row: RequestRow) =>
  row.organization_members?.profiles?.full_name || row.organization_members?.profiles?.email || "Boarder";

export async function listRequests(): Promise<RequestListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("maintenance_requests")
    .select(SELECT)
    .order("created_at", { ascending: false })
    .limit(500)
    .returns<RequestRow[]>();
  if (error) throw new Error("Could not load maintenance requests");
  return data.map((r) => ({
    id: r.id,
    title: r.title,
    boarder: nameOf(r),
    room: r.rooms?.code ?? null,
    priority: r.priority,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export type TimelineEntry = {
  id: string;
  body: string;
  statusTo: MaintenanceStatus | null;
  createdAt: string;
  author: string;
  byBoarder: boolean;
};

export type RequestDetail = {
  id: string;
  title: string;
  description: string;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  createdAt: string;
  resolvedAt: string | null;
  memberId: string;
  boarder: string;
  boarderPhone: string | null;
  room: string | null;
  photoUrl: string | null;
  timeline: TimelineEntry[];
};

export async function getRequest(id: string): Promise<RequestDetail | null> {
  const supabase = await createClient();
  const { data: row } = await supabase.from("maintenance_requests").select(SELECT).eq("id", id).maybeSingle<RequestRow>();
  if (!row) return null;

  const { data: updates } = await supabase
    .from("maintenance_updates")
    .select("id, body, status_to, created_at, author_id")
    .eq("request_id", id)
    .order("created_at")
    .returns<{ id: string; body: string; status_to: MaintenanceStatus | null; created_at: string; author_id: string | null }[]>();

  const authorIds = [...new Set((updates ?? []).map((u) => u.author_id).filter((v): v is string => Boolean(v)))];
  const names = new Map<string, string>();
  if (authorIds.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", authorIds)
      .returns<{ id: string; full_name: string; email: string }[]>();
    for (const p of profiles ?? []) names.set(p.id, p.full_name || p.email);
  }

  let photoUrl: string | null = null;
  if (row.photo_path) {
    // Short-lived URL; storage RLS lets staff of the organization read it.
    const { data } = await supabase.storage.from("maintenance-photos").createSignedUrl(row.photo_path, 60);
    photoUrl = data?.signedUrl ?? null;
  }

  const boarderUserId = row.organization_members?.user_id;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    priority: row.priority,
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    memberId: row.member_id,
    boarder: nameOf(row),
    boarderPhone: row.organization_members?.profiles?.phone ?? null,
    room: row.rooms?.code ?? null,
    photoUrl,
    timeline: (updates ?? []).map((u) => {
      const byBoarder = u.author_id !== null && u.author_id === boarderUserId;
      return {
        id: u.id,
        body: u.body,
        statusTo: u.status_to,
        createdAt: u.created_at,
        author: (u.author_id && names.get(u.author_id)) || (byBoarder ? "Boarder" : "Staff"),
        byBoarder,
      };
    }),
  };
}
