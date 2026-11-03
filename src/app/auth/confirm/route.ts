import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/security/origin";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_TYPES: EmailOtpType[] = ["invite", "recovery", "email", "signup", "email_change"];

/**
 * Landing point for links in invitation, recovery and confirmation emails.
 * Email templates link here with ?token_hash=...&type=...&next=... (see supabase/templates).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const code = searchParams.get("code");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(searchParams.get("next"), "/");

  if (tokenHash && type && ALLOWED_TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      const destination = type === "invite" || type === "recovery" ? "/auth/set-password" : next;
      return new NextResponse(null, { status: 303, headers: { Location: destination } });
    }
  } else if (code && !tokenHash && !searchParams.has("error")) {
    // Password recovery initiated with the SSR client can return a PKCE code.
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return new NextResponse(null, { status: 303, headers: { Location: "/auth/set-password" } });
    }
  } else if (!tokenHash && !code && !type && !searchParams.has("error") && !searchParams.has("error_code")) {
    // Default invitation emails carry #access_token after Supabase verifies them.
    // A relative redirect preserves that fragment for the browser to exchange for cookies.
    const query = new URLSearchParams({ next });
    return new NextResponse(null, { status: 303, headers: { Location: `/auth/callback?${query}` } });
  }
  return new NextResponse(null, { status: 303, headers: { Location: "/login?error=link" } });
}
