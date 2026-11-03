"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, FormError, SubmitButton } from "@/components/app/form";
import { useActionForm } from "@/components/app/use-action-form";
import { centavosToInput } from "@/lib/money";
import { addBed, updateBed } from "./actions";
import type { BedView } from "./queries";
import { bedSchema } from "./schemas";

export function BedFormDialog({ roomId, defaultRate, bed, disabled }: { roomId: string; defaultRate: number; bed?: BedView; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const form = useForm({
    resolver: zodResolver(bedSchema),
    defaultValues: { roomId, label: bed?.label ?? "", rate: centavosToInput(bed?.rate ?? defaultRate) },
  });
  const { onSubmit, pending, error } = useActionForm(
    form,
    (values) => (bed ? updateBed({ id: bed.id, label: values.label, rate: values.rate }) : addBed(values)),
    {
      onSuccess: () => {
        setOpen(false);
        if (!bed) form.reset({ roomId, label: "", rate: centavosToInput(defaultRate) });
      },
    },
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {bed ? (
          <Button variant="ghost" size="sm">
            Edit
          </Button>
        ) : (
          <Button variant="outline" disabled={disabled}>
            <Plus aria-hidden /> Add bed
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{bed ? `Edit ${bed.label}` : "Add a bed"}</DialogTitle>
          <DialogDescription>The rate is the default rent when someone is assigned to this bed.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <FormError message={error} />
          <Field label="Label" error={form.formState.errors.label?.message}>
            {(p) => <Input {...p} placeholder="Bed C (upper)" {...form.register("label")} />}
          </Field>
          <Field label="Monthly rate (₱)" error={form.formState.errors.rate?.message}>
            {(p) => <Input {...p} inputMode="decimal" {...form.register("rate")} />}
          </Field>
          <DialogFooter>
            <SubmitButton pending={pending}>{bed ? "Save bed" : "Add bed"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
