"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, FormError, SubmitButton } from "@/components/app/form";
import { useActionForm } from "@/components/app/use-action-form";
import { requestPasswordReset } from "@/features/auth/actions";
import { saveProperty, updateOrganization } from "./actions";
import type { OrgSettings, PropertyRow } from "./queries";
import { orgSchema, propertySchema } from "./schemas";

export function OrganizationForm({ org }: { org: OrgSettings }) {
  const form = useForm({ resolver: zodResolver(orgSchema), defaultValues: { name: org.name, defaultDueDay: org.defaultDueDay } });
  const { onSubmit, pending, error } = useActionForm(form, updateOrganization);
  return (
    <form onSubmit={onSubmit} noValidate className="grid max-w-md gap-4">
      <FormError message={error} />
      <Field label="Business name" hint="Shown to boarders and on receipts." error={form.formState.errors.name?.message}>
        {(p) => <Input {...p} className="h-10 bg-background" {...form.register("name")} />}
      </Field>
      <Field label="Rent due day" hint="Day of the month used as the default due date when you generate invoices." error={form.formState.errors.defaultDueDay?.message}>
        {(p) => <Input {...p} type="number" min={1} max={28} inputMode="numeric" className="h-10 w-28 bg-background" {...form.register("defaultDueDay")} />}
      </Field>
      <div>
        <SubmitButton pending={pending}>Save</SubmitButton>
      </div>
    </form>
  );
}

export function PropertyDialog({ property }: { property?: PropertyRow }) {
  const [open, setOpen] = useState(false);
  const defaults = { id: property?.id ?? "", name: property?.name ?? "", address: property?.address ?? "" };
  const form = useForm({ resolver: zodResolver(propertySchema), defaultValues: defaults });
  const { onSubmit, pending, error } = useActionForm(form, saveProperty, {
    onSuccess: () => {
      setOpen(false);
      if (!property) form.reset(defaults);
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {property ? (
          <Button variant="ghost" size="sm">
            Edit
          </Button>
        ) : (
          <Button variant="outline">
            <Plus aria-hidden /> Add property
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{property ? `Edit ${property.name}` : "Add a property"}</DialogTitle>
          <DialogDescription>For landlords with more than one building. Rooms belong to a property.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <FormError message={error} />
          <Field label="Name" error={form.formState.errors.name?.message}>
            {(p) => <Input {...p} placeholder="Dapitan annex" {...form.register("name")} />}
          </Field>
          <Field label="Address" error={form.formState.errors.address?.message}>
            {(p) => <Input {...p} placeholder="1234 Dapitan St., Sampaloc, Manila" {...form.register("address")} />}
          </Field>
          <DialogFooter>
            <SubmitButton pending={pending}>{property ? "Save" : "Add property"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PasswordResetButton({ email }: { email: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await requestPasswordReset({ email });
          if (result.ok) toast.success("Check your email for a link to set a new password.");
          else toast.error(result.error);
        })
      }
    >
      Send password reset link
    </Button>
  );
}
