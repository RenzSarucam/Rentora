"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, FormError, SubmitButton } from "@/components/app/form";
import { useActionForm } from "@/components/app/use-action-form";
import { dueDateFor } from "@/lib/dates";
import { generateInvoices } from "./actions";
import { generateSchema } from "./schemas";

export function GenerateInvoicesDialog({
  months,
  defaultMonth,
  dueDay,
  billableCount,
}: {
  months: { value: string; label: string; generated: number }[];
  defaultMonth: string;
  dueDay: number;
  billableCount: number;
}) {
  const [open, setOpen] = useState(false);
  const defaults = { month: defaultMonth, dueDate: dueDateFor(defaultMonth, dueDay) };
  const form = useForm({ resolver: zodResolver(generateSchema), defaultValues: defaults });
  const { onSubmit, pending, error } = useActionForm(form, generateInvoices, { onSuccess: () => setOpen(false) });
  const month = useWatch({ control: form.control, name: "month" });
  const chosen = months.find((m) => m.value === month);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) form.reset(defaults);
      }}
    >
      <DialogTrigger asChild>
        <Button>Generate invoices</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate rent invoices</DialogTitle>
          <DialogDescription>
            One invoice per boarder with a bed, at the rent on their assignment. Safe to run again: anyone already billed for the month is skipped.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <FormError message={error} />
          <Field
            label="Billing month"
            error={form.formState.errors.month?.message}
            hint={chosen ? (chosen.generated ? `${chosen.generated} already billed for this month.` : `${billableCount} boarders with a bed today.`) : undefined}
          >
            {(p) => (
              <select
                {...p}
                className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                {...form.register("month", {
                  onChange: (e) => form.setValue("dueDate", dueDateFor(e.target.value, dueDay)),
                })}
              >
                {months.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Due date" error={form.formState.errors.dueDate?.message}>
            {(p) => <Input {...p} type="date" {...form.register("dueDate")} />}
          </Field>
          <DialogFooter>
            <SubmitButton pending={pending}>Generate</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
