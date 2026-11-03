"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getViewer, homeFor } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env";
import { fail, validationFail, type ActionResult } from "@/lib/errors";
import { clientIp, LIMITS, rateLimit } from "@/lib/rate-limit";
import { safeNextPath } from "@/lib/security/origin";
import { createClient } from "@/lib/supabase/server";
import { email, password } from "@/lib/validation";

const signInSchema = z.object({
  email,
  password: z.string().min(1, { message: "Enter your password." }).max(72),
  next: z.string().optional(),
});

export async function signIn(input: unknown): Promise<ActionResult<never>> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const { email: address, password: pass, next } = parsed.data;

  const ip = await clientIp();
  const allowed = (await rateLimit(LIMITS.login, ip, address)) && (await rateLimit({ ...LIMITS.login, max: 40 }, ip));
  if (!allowed) return fail("Too many sign-in attempts. Wait 15 minutes and try again.");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: address, password: pass });
  if (error) {
    if (error.code === "email_not_confirmed") return fail("Confirm your email first using the link we sent you.");
    // Same message for unknown email and wrong password: no account enumeration.
    return fail("Email or password is incorrect.");
  }

  const viewer = await getViewer();
  if (!viewer) {
    await supabase.auth.signOut();
    return fail("This account is not linked to a boarding house. Ask your landlord for an invitation.");
  }
  const home = homeFor(viewer);
  const target = safeNextPath(next, home);
  // Never send a boarder to an admin URL (or the reverse); the layouts would bounce them anyway.
  redirect(target.startsWith(home.split("/").slice(0, 2).join("/")) ? target : home);
}

const resetSchema = z.object({ email });

export async function requestPasswordReset(input: unknown): Promise<ActionResult<null>> {
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);

  const ip = await clientIp();
  const allowed = await rateLimit(LIMITS.passwordReset, ip, parsed.data.email);
  if (allowed) {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${publicEnv().NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/auth/set-password`,
    });
  }
  // Identical response whether or not the account exists, or the limit was hit.
  return { ok: true, data: null, message: "If an account uses that email, a reset link is on its way. It expires in 24 hours." };
}

const setPasswordSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "Passwords do not match.", path: ["confirm"] });

export async function setPassword(input: unknown): Promise<ActionResult<never>> {
  const parsed = setPasswordSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return fail("Your link has expired. Request a new one.");

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return fail("Choose a password you have not used here before.");
    if (error.code === "weak_password") return fail("That password is too weak. Try a longer one.");
    if (error.code === "reauthentication_needed") return fail("For your security, request a new reset link and try again.");
    return fail("Could not update your password. Please try again.");
  }
  // First password set from an invitation activates the membership. No-op otherwise.
  await supabase.rpc("accept_invitation");

  const viewer = await getViewer();
  redirect(viewer ? homeFor(viewer) : "/login");
}
