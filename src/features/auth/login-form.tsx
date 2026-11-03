"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Field, FormError, SubmitButton } from "@/components/app/form";
import { email } from "@/lib/validation";
import { signIn } from "./actions";

const schema = z.object({ email, password: z.string().min(1, { message: "Enter your password." }) });
type Values = z.input<typeof schema>;

export function LoginForm({ next, linkError }: { next?: string; linkError?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(linkError ? "That link is invalid or has expired. Request a new one." : null);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await signIn({ ...values, next });
      if (result && !result.ok) setError(result.error);
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <FormError message={error} />
      <Field label="Email" error={form.formState.errors.email?.message}>
        {(p) => <Input {...p} type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" spellCheck={false} autoCapitalize="none" className="h-12 rounded-md bg-background px-3" {...form.register("email")} />}
      </Field>
      <div className="relative">
        <Field label="Password" error={form.formState.errors.password?.message}>
          {(p) => (
            <div className="relative">
              <Input {...p} type={showPassword ? "text" : "password"} autoComplete="current-password" className="h-12 rounded-md bg-background pr-12 pl-3" {...form.register("password")} />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                aria-controls={p.id}
                className="absolute top-1 right-1 inline-flex size-10 items-center justify-center rounded-sm text-muted-foreground hover:bg-raised hover:text-foreground"
              >
                {showPassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
              </button>
            </div>
          )}
        </Field>
        <Link href="/forgot-password" className="absolute top-0 right-0 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Forgot your password?
        </Link>
      </div>
      <SubmitButton pending={pending} className="relative mt-1 h-12 w-full justify-center rounded-md px-12 text-[15px] [&>.animate-spin]:absolute [&>.animate-spin]:left-4">
        <span>Sign in</span><ArrowRight className="absolute top-1/2 right-4 size-4 -translate-y-1/2" aria-hidden />
      </SubmitButton>
    </form>
  );
}
