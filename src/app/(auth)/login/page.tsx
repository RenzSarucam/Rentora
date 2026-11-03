import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/login-form";
import { getViewer, homeFor } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const viewer = await getViewer();
  if (viewer) redirect(homeFor(viewer));
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;

  return (
    <>
      <h1 className="text-[22px] font-semibold tracking-[-0.01em]">Sign in</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">Landlords and boarders use the same sign-in.</p>
      <LoginForm next={next} linkError={params.error === "link"} />
    </>
  );
}
