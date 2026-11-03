"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormError, SubmitButton } from "@/components/app/form";
import { useActionForm } from "@/components/app/use-action-form";
import { requestPasswordReset } from "@/features/auth/actions";
import { updateMyProfile } from "./actions";
import type { ProfileRow } from "./queries";
import { profileSchema } from "./schemas";

export function ProfileForm({ profile }: { profile: ProfileRow }) {
  const form = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: profile.full_name,
      phone: profile.phone ?? "",
      emergencyName: profile.emergency_contact_name ?? "",
      emergencyPhone: profile.emergency_contact_phone ?? "",
    },
  });
  const { onSubmit, pending, error } = useActionForm(form, updateMyProfile);
  const e = form.formState.errors;
  const input = "h-12 rounded-xl text-base";

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <FormError message={error} />
      <Field label="Full name" error={e.fullName?.message}>
        {(p) => <Input {...p} autoComplete="name" className={input} {...form.register("fullName")} />}
      </Field>
      <Field label="Mobile number" error={e.phone?.message}>
        {(p) => <Input {...p} type="tel" autoComplete="tel" inputMode="tel" placeholder="0917 123 4567" className={input} {...form.register("phone")} />}
      </Field>
      <Field label="Emergency contact" error={e.emergencyName?.message}>
        {(p) => <Input {...p} placeholder="Name and relationship" className={input} {...form.register("emergencyName")} />}
      </Field>
      <Field label="Emergency contact number" error={e.emergencyPhone?.message}>
        {(p) => <Input {...p} type="tel" inputMode="tel" className={input} {...form.register("emergencyPhone")} />}
      </Field>
      <SubmitButton pending={pending} className="h-12 w-full rounded-xl text-[15px]">
        Save profile
      </SubmitButton>
    </form>
  );
}

export function ChangePasswordButton({ email }: { email: string }) {
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  return (
    <div>
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full rounded-xl"
        disabled={pending || sent}
        onClick={() =>
          startTransition(async () => {
            const result = await requestPasswordReset({ email });
            if (result.ok) {
              setSent(true);
              toast.success("Check your email for a link to set a new password.");
            } else toast.error(result.error);
          })
        }
      >
        {sent ? "Reset link sent" : "Change password"}
      </Button>
      <p className="mt-1.5 text-xs text-muted-foreground">We email a secure link to {email}.</p>
    </div>
  );
}
