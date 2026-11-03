"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, FormError, SubmitButton } from "@/components/app/form";
import { useActionForm } from "@/components/app/use-action-form";
import { addInvoiceItem, updateDueDate } from "./actions";
import { addItemSchema, dueDateSchema } from "./schemas";

const selectClass = "h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm";

export function AddItemDialog({ invoiceId }: { invoiceId: string }) {
  const [open, setOpen] = useState(false);
  const defaults = { invoiceId, kind: "fee" as const, description: "", amount: "" };
  const form = useForm({ resolver: zodResolver(addItemSchema), defaultValues: defaults });
  const { onSubmit, pending, error } = useActionForm(form, addInvoiceItem, {
    onSuccess: () => {
      setOpen(false);
      form.reset(defaults);
    },
  });
  const errors = form.formState.errors;
  const kind = useWatch({ control: form.control, name: "kind" });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus aria-hidden /> Fee or discount
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a line</DialogTitle>
          <DialogDescription>Fees add to the total; discounts reduce it. The rent line itself never changes.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <FormError message={error} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Type" error={errors.kind?.message}>
              {(p) => (
                <select {...p} className={selectClass} {...form.register("kind")}>
                  <option value="fee">Fee</option>
                  <option value="discount">Discount</option>
                  <option value="deposit">Deposit</option>
                  <option value="other">Other</option>
                </select>
              )}
            </Field>
            <Field label={kind === "discount" ? "Discount (₱)" : "Amount (₱)"} error={errors.amount?.message}>
              {(p) => <Input {...p} inputMode="decimal" placeholder="450.50" {...form.register("amount")} />}
            </Field>
          </div>
          <Field label="Description" error={errors.description?.message}>
            {(p) => (
              <Input
                {...p}
                placeholder={kind === "discount" ? "Early payment discount" : "Electricity, October (52 kWh)"}
                {...form.register("description")}
              />
            )}
          </Field>
          <DialogFooter>
            <SubmitButton pending={pending}>{kind === "discount" ? "Add discount" : "Add line"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DueDateDialog({ invoiceId, dueDate, issueDate }: { invoiceId: string; dueDate: string; issueDate: string }) {
  const [open, setOpen] = useState(false);
  const form = useForm({ resolver: zodResolver(dueDateSchema), defaultValues: { invoiceId, dueDate } });
  const { onSubmit, pending, error } = useActionForm(form, updateDueDate, { onSuccess: () => setOpen(false) });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          Change
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Change due date</DialogTitle>
          <DialogDescription>The boarder sees the new date right away.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <FormError message={error} />
          <Field label="Due date" error={form.formState.errors.dueDate?.message}>
            {(p) => <Input {...p} type="date" min={issueDate} {...form.register("dueDate")} />}
          </Field>
          <DialogFooter>
            <SubmitButton pending={pending}>Save</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
