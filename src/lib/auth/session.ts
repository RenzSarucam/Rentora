import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "owner" | "admin" | "boarder";
export type MemberStatus = "invited" | "active" | "archived";

export type Viewer = {
  userId: string;
  email: string;
  fullName: string;
  memberId: string;
  orgId: string;
  orgName: string;
  role: Role;
  status: MemberStatus;
};

type MemberRow = {
  id: string;
  organization_id: string;
  role: Role;
  status: MemberStatus;
  organizations: { name: string } | null;
};

/**
 * The single place the app learns who is signed in and what they belong to.
 * Uses getUser(), which verifies the session with Supabase Auth instead of trusting the cookie.
 * Cached per request.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const { data: auth, error } = await supabase.auth.getUser();
  if (error || !auth.user) return null;

  const [{ data: member }, { data: profile }] = await Promise.all([
    supabase
      .from("organization_members")
      .select("id, organization_id, role, status, organizations(name)")
      .eq("user_id", auth.user.id)
      .maybeSingle<MemberRow>(),
    supabase.from("profiles").select("full_name").eq("id", auth.user.id).maybeSingle<{ full_name: string }>(),
  ]);
  if (!member) return null;

  return {
    userId: auth.user.id,
    email: auth.user.email ?? "",
    fullName: profile?.full_name || auth.user.email || "",
    memberId: member.id,
    orgId: member.organization_id,
    orgName: member.organizations?.name ?? "",
    role: member.role,
    status: member.status,
  };
});

export function isStaff(viewer: Pick<Viewer, "role" | "status">): boolean {
  return (viewer.role === "owner" || viewer.role === "admin") && viewer.status === "active";
}

export function homeFor(viewer: Pick<Viewer, "role" | "status">): string {
  return isStaff(viewer) ? "/admin/dashboard" : "/boarder/home";
}

/** Server-side gate for every admin page and admin action. */
export async function requireStaff(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!isStaff(viewer)) redirect("/boarder/home");
  return viewer;
}

/** Server-side gate for the boarder app. Archived boarders keep read-only access to their history. */
export async function requireBoarder(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer.role !== "boarder") redirect("/admin/dashboard");
  return viewer;
}
