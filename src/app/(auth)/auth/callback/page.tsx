import type { Metadata } from "next";
import { EmailLinkSession } from "@/features/auth/email-link-session";

export const metadata: Metadata = { title: "Confirming sign-in" };

export default function AuthCallbackPage() {
  return <EmailLinkSession />;
}
