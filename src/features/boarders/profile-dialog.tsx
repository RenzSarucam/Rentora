"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, FormError, SubmitButton } from "@/components/app/form";
import { useActionForm } from "@/components/app/use-action-form";
import { updateBoarderProfile } from "./actions";
import { profileSchema } from "./schemas";

type Props = {
  memberId: string;
  fullName: string;
  phone: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
};

export function ProfileDialog({ memberId, fullName, phone, emergencyName, emergencyPhone }: Props) {
  const [open, setOpen] = useState(false);
  const form = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      memberId,
      fullName,
      phone: phone ?? "",
      emergencyName: emergencyName ?? "",
      emergencyPhone: emergencyPhone ?? "",
    },
  });
  const { onSubmit, pending, error } = useActionForm(form, updateBoarderProfile, { onSuccess: () => setOpen(false) });
  const errors = form.formState.errors;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>The email is their sign-in and cannot be changed here.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <FormError message={error} />
          <Field label="Full name" error={errors.fullName?.message}>
            {(p) => <Input {...p} {...form.register("fullName")} />}
          </Field>
          <Field label="Mobile number" error={errors.phone?.message}>
            {(p) => <Input {...p} type="tel" inputMode="tel" {...form.register("phone")} />}
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Emergency contact" error={errors.emergencyName?.message}>
              {(p) => <Input {...p} placeholder="Name" {...form.register("emergencyName")} />}
            </Field>
            <Field label="Their number" error={errors.emergencyPhone?.message}>
              {(p) => <Input {...p} type="tel" inputMode="tel" {...form.register("emergencyPhone")} />}
            </Field>
          </div>
          <DialogFooter>
            <SubmitButton pending={pending}>Save profile</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
