import "server-only";
import { createClient } from "@/lib/supabase/server";

export type AuditEntry = {
  id: number;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  createdAt: string;
  actor: string;
};

/** Latest entries; RLS returns rows only to staff of the organization. */
export async function listAudit(limit = 200): Promise<AuditEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("id, actor_id, action, entity_type, entity_id, metadata, created_at")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit)
    .returns<{ id: number; actor_id: string | null; action: string; entity_type: string; entity_id: string | null; metadata: unknown; created_at: string }[]>();
  if (error) throw new Error("Could not load the activity log");

  const actorIds = [...new Set(data.map((r) => r.actor_id).filter((v): v is string => Boolean(v)))];
  const names = new Map<string, string>();
  if (actorIds.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", actorIds)
      .returns<{ id: string; full_name: string; email: string }[]>();
    for (const p of profiles ?? []) names.set(p.id, p.full_name || p.email);
  }

  return data.map((r) => ({
    id: r.id,
    action: r.action,
    entityType: r.entity_type,
    entityId: r.entity_id,
    metadata: r.metadata,
    createdAt: r.created_at,
    actor: r.actor_id ? (names.get(r.actor_id) ?? "Former member") : "System",
  }));
}
