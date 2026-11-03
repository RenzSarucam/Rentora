import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SetPasswordForm } from "@/features/auth/set-password-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Choose a password" };

export default async function SetPasswordPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login?error=link");

  return (
    <>
      <h1 className="text-[22px] font-semibold tracking-[-0.01em]">Choose a password</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        For <span className="font-medium text-foreground">{data.user.email}</span>
      </p>
      <SetPasswordForm />
    </>
  );
}
