"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, FormError, SubmitButton } from "@/components/app/form";
import { useActionForm } from "@/components/app/use-action-form";
import { inviteBoarder } from "./actions";
import { inviteSchema } from "./schemas";

export function InviteDialog({ variant = "default" }: { variant?: "default" | "outline" }) {
  const [open, setOpen] = useState(false);
  const form = useForm({
    resolver: zodResolver(inviteSchema),
    defaultValues: { fullName: "", email: "", phone: "" },
  });
  const { onSubmit, pending, error } = useActionForm(form, inviteBoarder, {
    onSuccess: () => {
      setOpen(false);
      form.reset();
    },
  });
  const errors = form.formState.errors;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant}>
          <UserPlus aria-hidden /> Invite boarder
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite a boarder</DialogTitle>
          <DialogDescription>
            They get an email to set a password and open the boarder app. You can assign a bed right away.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <FormError message={error} />
          <Field label="Full name" error={errors.fullName?.message}>
            {(p) => <Input {...p} autoComplete="off" placeholder="Maria Santos" {...form.register("fullName")} />}
          </Field>
          <Field label="Email" error={errors.email?.message}>
            {(p) => <Input {...p} type="email" inputMode="email" autoComplete="off" {...form.register("email")} />}
          </Field>
          <Field label="Mobile number" hint="Optional." error={errors.phone?.message}>
            {(p) => <Input {...p} type="tel" inputMode="tel" placeholder="0917 123 4567" {...form.register("phone")} />}
          </Field>
          <DialogFooter>
            <SubmitButton pending={pending}>Send invitation</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
