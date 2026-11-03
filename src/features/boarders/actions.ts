"use server";

import { revalidatePath } from "next/cache";
import { requireStaff, type Viewer } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env";
import { dbFail, fail, ok, validationFail, type ActionResult } from "@/lib/errors";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { archiveSchema, inviteSchema, memberRefSchema, notesSchema, profileSchema } from "./schemas";

function refresh(memberId?: string) {
  revalidatePath("/admin/boarders");
  revalidatePath("/admin/assignments");
  revalidatePath("/admin/dashboard");
  if (memberId) revalidatePath(`/admin/boarders/${memberId}`);
}

const inviteRedirect = () => `${publicEnv().NEXT_PUBLIC_SITE_URL}/auth/confirm`;

function isEmailTaken(error: { code?: string; message?: string }) {
  return error.code === "email_exists" || /already (been )?registered/i.test(error.message ?? "");
}

/**
 * Removes an auth user created by a failed invite, but only when it is clearly our orphan:
 * unconfirmed, created moments ago, and not a member of any organization.
 */
async function removeOrphan(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const { data } = await admin.auth.admin.getUserById(userId);
  const user = data.user;
  if (!user || user.email_confirmed_at) return;
  if (Date.now() - Date.parse(user.created_at) > 5 * 60_000) return;
  const { count } = await admin.from("organization_members").select("id", { count: "exact", head: true }).eq("user_id", userId);
  if (count === 0) await admin.auth.admin.deleteUser(userId);
}

async function registerInvitation(
  admin: ReturnType<typeof createAdminClient>,
  viewer: Viewer,
  userId: string,
  values: { email: string; fullName: string; phone: string | null },
) {
  return admin.rpc("register_boarder_invitation", {
    p_org: viewer.orgId,
    p_user: userId,
    p_email: values.email,
    p_full_name: values.fullName,
    p_phone: values.phone ?? "",
    p_invited_by: viewer.userId,
  });
}

export async function inviteBoarder(input: unknown): Promise<ActionResult<{ id: string }>> {
  const viewer = await requireStaff();
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const v = parsed.data;

  if (!(await rateLimit(LIMITS.invite, viewer.userId))) {
    return fail("You have sent many invitations in the last hour. Try again later.");
  }

  // Already in this house? Point the landlord at Resend instead of creating anything.
  const supabase = await createClient();
  const { data: existing } = await supabase.from("profiles").select("id").eq("email", v.email).maybeSingle<{ id: string }>();
  if (existing) return fail("This person already has an account in your boarding house. Use Resend invite on their page if needed.");

  const admin = createAdminClient();
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(v.email, {
    data: { full_name: v.fullName },
    redirectTo: inviteRedirect(),
  });
  if (inviteError || !invited.user) {
    if (inviteError && isEmailTaken(inviteError)) {
      return fail("This email already has a Rentora account. Each login can belong to one boarding house.");
    }
    console.error("invite failed", inviteError?.code ?? "unknown");
    return fail("Could not send the invitation. Check the email address and try again.");
  }

  const { data: memberId, error } = await registerInvitation(admin, viewer, invited.user.id, v);
  if (error) {
    await removeOrphan(admin, invited.user.id);
    return dbFail(error);
  }
  refresh();
  return ok({ id: memberId as string }, `Invitation sent to ${v.email}. The link works once, within 24 hours.`);
}

type MemberLookup = { id: string; status: string; profiles: { email: string; full_name: string; phone: string | null } | null };

export async function resendInvite(input: unknown): Promise<ActionResult<null>> {
  const viewer = await requireStaff();
  const parsed = memberRefSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);

  // Authorize with the caller's own session (RLS) before touching the service-role client.
  const supabase = await createClient();
  const { data: member } = await supabase
    .from("organization_members")
    .select("id, status, profiles(email, full_name, phone)")
    .eq("id", parsed.data.memberId)
    .eq("organization_id", viewer.orgId)
    .eq("role", "boarder")
    .maybeSingle<MemberLookup>();
  if (!member?.profiles) return fail("Boarder not found.");
  if (member.status !== "invited") return fail("This boarder has already accepted their invitation.");

  if (!(await rateLimit(LIMITS.invite, viewer.userId))) {
    return fail("You have sent many invitations in the last hour. Try again later.");
  }

  const admin = createAdminClient();
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(member.profiles.email, {
    data: { full_name: member.profiles.full_name },
    redirectTo: inviteRedirect(),
  });
  if (inviteError || !invited.user) {
    return fail("Could not resend the invitation. If they already set a password, ask them to use “Forgot your password?” on the sign-in page.");
  }
  const { error } = await registerInvitation(admin, viewer, invited.user.id, {
    email: member.profiles.email,
    fullName: member.profiles.full_name,
    phone: member.profiles.phone,
  });
  if (error) return dbFail(error);
  refresh(member.id);
  return ok(null, "Invitation sent again.");
}

export async function updateBoarderProfile(input: unknown): Promise<ActionResult<null>> {
  await requireStaff();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { data: member } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("id", v.memberId)
    .eq("role", "boarder")
    .maybeSingle<{ user_id: string }>();
  if (!member) return fail("Boarder not found.");
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: v.fullName,
      phone: v.phone,
      emergency_contact_name: v.emergencyName,
      emergency_contact_phone: v.emergencyPhone,
    })
    .eq("id", member.user_id);
  if (error) return dbFail(error);
  refresh(v.memberId);
  return ok(null, "Profile saved.");
}

export async function updateBoarderNotes(input: unknown): Promise<ActionResult<null>> {
  await requireStaff();
  const parsed = notesSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase
    .from("organization_members")
    .update({ notes: parsed.data.notes })
    .eq("id", parsed.data.memberId)
    .eq("role", "boarder");
  if (error) return dbFail(error);
  refresh(parsed.data.memberId);
  return ok(null, "Notes saved.");
}

export async function setBoarderArchived(input: unknown): Promise<ActionResult<null>> {
  await requireStaff();
  const parsed = archiveSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_boarder_archived", { p_member: parsed.data.memberId, p_archived: parsed.data.archived });
  if (error) return dbFail(error);
  refresh(parsed.data.memberId);
  return ok(null, parsed.data.archived ? "Boarder archived. Their history is kept." : "Boarder restored.");
}
