"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
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
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <FormError message={error} />
      <Field label="Email" error={form.formState.errors.email?.message}>
        {(p) => <Input {...p} type="email" autoComplete="email" inputMode="email" className="h-11" {...form.register("email")} />}
      </Field>
      <Field label="Password" error={form.formState.errors.password?.message}>
        {(p) => <Input {...p} type="password" autoComplete="current-password" className="h-11" {...form.register("password")} />}
      </Field>
      <SubmitButton pending={pending} className="mt-1 h-11 w-full text-[15px]">
        Sign in
      </SubmitButton>
      <Link href="/forgot-password" className="justify-self-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
        Forgot your password?
      </Link>
    </form>
  );
}
