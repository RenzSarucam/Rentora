"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Field, FormError, SubmitButton } from "@/components/app/form";
import { email } from "@/lib/validation";
import { requestPasswordReset } from "./actions";

const schema = z.object({ email });
type Values = z.input<typeof schema>;

export function ForgotPasswordForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "" } });

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await requestPasswordReset(values);
      if (result.ok) setSent(result.message ?? "Check your email.");
      else setError(result.error);
    });
  });

  if (sent) {
    return (
      <p role="status" className="rounded-md bg-pill-positive-bg px-3 py-3 text-sm text-pill-positive-ink">
        {sent}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <FormError message={error} />
      <Field label="Email" error={form.formState.errors.email?.message}>
        {(p) => <Input {...p} type="email" autoComplete="email" inputMode="email" className="h-11" {...form.register("email")} />}
      </Field>
      <SubmitButton pending={pending} className="h-11 w-full text-[15px]">
        Send reset link
      </SubmitButton>
    </form>
  );
}
