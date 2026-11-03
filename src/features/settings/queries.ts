import "server-only";
import { createClient } from "@/lib/supabase/server";

export type OrgSettings = { id: string; name: string; defaultDueDay: number; timezone: string; currency: string };
export type PropertyRow = { id: string; name: string; address: string | null; archivedAt: string | null; activeRooms: number };
export type TeamMember = { id: string; name: string; email: string; role: "owner" | "admin" };

export async function getSettings(orgId: string) {
  const supabase = await createClient();
  const [org, properties, team] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, default_due_day, timezone, currency")
      .eq("id", orgId)
      .single<{ id: string; name: string; default_due_day: number; timezone: string; currency: string }>(),
    supabase
      .from("properties")
      .select("id, name, address, archived_at, rooms(id, archived_at)")
      .order("created_at")
      .returns<{ id: string; name: string; address: string | null; archived_at: string | null; rooms: { id: string; archived_at: string | null }[] }[]>(),
    supabase
      .from("organization_members")
      .select("id, role, profiles(full_name, email)")
      .in("role", ["owner", "admin"])
      .neq("status", "archived")
      .order("role")
      .returns<{ id: string; role: "owner" | "admin"; profiles: { full_name: string; email: string } | null }[]>(),
  ]);
  if (org.error || !org.data) throw new Error("Could not load settings");

  return {
    org: {
      id: org.data.id,
      name: org.data.name,
      defaultDueDay: org.data.default_due_day,
      timezone: org.data.timezone,
      currency: org.data.currency,
    } satisfies OrgSettings,
    properties: (properties.data ?? []).map(
      (p): PropertyRow => ({
        id: p.id,
        name: p.name,
        address: p.address,
        archivedAt: p.archived_at,
        activeRooms: p.rooms.filter((r) => !r.archived_at).length,
      }),
    ),
    team: (team.data ?? []).map(
      (m): TeamMember => ({ id: m.id, role: m.role, name: m.profiles?.full_name || m.profiles?.email || "—", email: m.profiles?.email ?? "" }),
    ),
  };
}
