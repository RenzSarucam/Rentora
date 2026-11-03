"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Field, FormError, SubmitButton } from "@/components/app/form";
import { password } from "@/lib/validation";
import { setPassword } from "./actions";

const schema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "Passwords do not match.", path: ["confirm"] });
type Values = z.input<typeof schema>;

export function SetPasswordForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { password: "", confirm: "" } });

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await setPassword(values);
      if (result && !result.ok) setError(result.error);
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <FormError message={error} />
      <Field
        label="New password"
        hint="At least 10 characters with upper- and lowercase letters and a number."
        error={form.formState.errors.password?.message}
      >
        {(p) => <Input {...p} type="password" autoComplete="new-password" className="h-11" {...form.register("password")} />}
      </Field>
      <Field label="Confirm password" error={form.formState.errors.confirm?.message}>
        {(p) => <Input {...p} type="password" autoComplete="new-password" className="h-11" {...form.register("confirm")} />}
      </Field>
      <SubmitButton pending={pending} className="h-11 w-full text-[15px]">
        Save password
      </SubmitButton>
    </form>
  );
}
