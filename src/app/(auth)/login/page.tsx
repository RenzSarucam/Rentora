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
      <p className="mb-2 text-xs font-medium text-muted-foreground">Welcome back</p>
      <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.025em]">Sign in</h1>
      <p className="mt-2 mb-7 text-sm leading-6 text-muted-foreground">Use your landlord or boarder account to continue.</p>
      <LoginForm next={next} linkError={params.error === "link"} />
      <div className="mt-7 border-t border-border pt-5 text-xs leading-5 text-muted-foreground">
        <p className="font-medium text-foreground">New to your boarding house?</p>
        <p>Ask your landlord for an invitation to get started.</p>
      </div>
    </>
  );
}
