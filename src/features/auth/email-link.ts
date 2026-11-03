import { safeNextPath } from "../../lib/security/origin";

const EMAIL_TYPES = new Set(["invite", "recovery", "signup", "magiclink", "email", "email_change"]);

/** Default Supabase email links return sessions in a fragment, which servers cannot read. */
export function readEmailSession(fragment: string, next: string | null) {
  const params = new URLSearchParams(fragment.replace(/^#/, ""));
  if (params.has("error") || params.has("error_code")) return null;
  const type = params.get("type");
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  const tokenType = params.get("token_type");
  if (!type || !EMAIL_TYPES.has(type) || !accessToken || !refreshToken) return null;
  if (tokenType && tokenType.toLowerCase() !== "bearer") return null;
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    destination: type === "invite" || type === "recovery" ? "/auth/set-password" : safeNextPath(next, "/"),
  };
}
