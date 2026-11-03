"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormError, SubmitButton } from "@/components/app/form";
import { useActionForm } from "@/components/app/use-action-form";
import type { ActionResult } from "@/lib/errors";
import { requiredText } from "@/lib/validation";
import { cn } from "@/lib/utils";

const schema = z.object({ reason: requiredText("Reason", 500, 3) });

/** A dialog that asks for a written reason before running a destructive or reviewable action. */
export function ReasonDialog({
  trigger,
  triggerVariant = "outline",
  triggerSize,
  title,
  description,
  fieldLabel,
  placeholder,
  submitLabel,
  destructive,
  action,
  disabled,
}: {
  trigger: React.ReactNode;
  triggerVariant?: React.ComponentProps<typeof Button>["variant"];
  triggerSize?: React.ComponentProps<typeof Button>["size"];
  title: string;
  description: React.ReactNode;
  fieldLabel: string;
  placeholder?: string;
  submitLabel: string;
  destructive?: boolean;
  action: (reason: string) => Promise<ActionResult<unknown>>;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { reason: "" } });
  const { onSubmit, pending, error } = useActionForm(form, (values) => action(values.reason), {
    onSuccess: () => {
      setOpen(false);
      form.reset();
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size={triggerSize} disabled={disabled}>
          {trigger}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <FormError message={error} />
          <Field label={fieldLabel} error={form.formState.errors.reason?.message}>
            {(p) => <Textarea {...p} rows={3} placeholder={placeholder} {...form.register("reason")} />}
          </Field>
          <DialogFooter>
            <SubmitButton pending={pending} className={cn(destructive && "bg-negative text-white hover:bg-negative/90")}>
              {submitLabel}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
