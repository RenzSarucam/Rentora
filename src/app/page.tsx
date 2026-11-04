import { getViewer, homeFor } from "@/lib/auth/session";
import { EmailLinkSession } from "@/features/auth/email-link-session";

export default async function Index() {
  const viewer = await getViewer();
  // Supabase can fall back to its Site URL. The browser must read an email
  // session fragment before a server redirect has a chance to discard it.
  return <EmailLinkSession fallback={viewer ? homeFor(viewer) : "/login"} />;
}
