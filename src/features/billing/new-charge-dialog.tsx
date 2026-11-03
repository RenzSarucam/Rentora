"use client";

import { useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, FormError, SubmitButton } from "@/components/app/form";
import { useActionForm } from "@/components/app/use-action-form";
import { manilaToday } from "@/lib/dates";
import { parsePesoToCentavos, formatPeso } from "@/lib/money";
import { createCharge } from "./actions";
import type { BoarderOption } from "./queries";
import { CHARGE_ITEM_LABELS, chargeItemKinds, newChargeSchema, signedAmount } from "./schemas";

const selectClass = "h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm";

/** One-off charges outside monthly rent: security deposits, repairs, utilities. */
export function NewChargeDialog({ boarders }: { boarders: BoarderOption[] }) {
  const [open, setOpen] = useState(false);
  const defaults = () => ({
    memberId: boarders[0]?.memberId ?? "",
    kind: "deposit" as "deposit" | "other",
    dueDate: manilaToday(),
    notes: "",
    items: [{ kind: "deposit" as (typeof chargeItemKinds)[number], description: "Security deposit", amount: "" }],
  });
  const form = useForm({ resolver: zodResolver(newChargeSchema), defaultValues: defaults() });
  const items = useFieldArray({ control: form.control, name: "items" });
  const { onSubmit, pending, error } = useActionForm(form, createCharge, {
    onSuccess: () => {
      setOpen(false);
      form.reset(defaults());
    },
  });
  const errors = form.formState.errors;
  const watched = useWatch({ control: form.control, name: "items" });
  const total = watched.reduce((sum, i) => sum + signedAmount(i.kind, parsePesoToCentavos(String(i.amount ?? "")) ?? 0), 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) form.reset(defaults());
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" disabled={boarders.length === 0}>
          <Plus aria-hidden /> New charge
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New charge</DialogTitle>
          <DialogDescription>A separate invoice for a deposit or one-off charge. Monthly rent is billed with Generate invoices.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <FormError message={error} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Boarder" error={errors.memberId?.message} className="sm:col-span-1">
              {(p) => (
                <select {...p} className={selectClass} {...form.register("memberId")}>
                  {boarders.map((b) => (
                    <option key={b.memberId} value={b.memberId}>
                      {b.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Type" error={errors.kind?.message}>
              {(p) => (
                <select {...p} className={selectClass} {...form.register("kind")}>
                  <option value="deposit">Security deposit</option>
                  <option value="other">Other charges</option>
                </select>
              )}
            </Field>
            <Field label="Due date" error={errors.dueDate?.message}>
              {(p) => <Input {...p} type="date" {...form.register("dueDate")} />}
            </Field>
          </div>

          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">Lines</legend>
            {items.fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-[110px_1fr_120px_36px] items-start gap-2">
                <select aria-label={`Line ${index + 1} type`} className={selectClass} {...form.register(`items.${index}.kind`)}>
                  {chargeItemKinds.map((k) => (
                    <option key={k} value={k}>
                      {CHARGE_ITEM_LABELS[k]}
                    </option>
                  ))}
                </select>
                <div>
                  <Input
                    aria-label={`Line ${index + 1} description`}
                    aria-invalid={errors.items?.[index]?.description ? true : undefined}
                    placeholder="Description"
                    {...form.register(`items.${index}.description`)}
                  />
                  {errors.items?.[index]?.description && <p className="mt-1 text-xs text-negative">{errors.items[index]?.description?.message}</p>}
                </div>
                <div>
                  <Input
                    aria-label={`Line ${index + 1} amount in pesos`}
                    aria-invalid={errors.items?.[index]?.amount ? true : undefined}
                    inputMode="decimal"
                    placeholder="₱"
                    className="text-right num"
                    {...form.register(`items.${index}.amount`)}
                  />
                  {errors.items?.[index]?.amount && <p className="mt-1 text-xs text-negative">{errors.items[index]?.amount?.message}</p>}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove line ${index + 1}`}
                  disabled={items.fields.length === 1}
                  onClick={() => items.remove(index)}
                >
                  <X aria-hidden />
                </Button>
              </div>
            ))}
            {errors.items?.message && <p className="text-xs text-negative">{errors.items.message}</p>}
            <div className="flex items-center justify-between pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={items.fields.length >= 20}
                onClick={() => items.append({ kind: "fee", description: "", amount: "" })}
              >
                <Plus aria-hidden /> Add line
              </Button>
              <p className="text-sm">
                Total <span className="num ml-2 font-semibold">{formatPeso(Math.max(total, 0))}</span>
              </p>
            </div>
            <p className="text-xs text-muted-foreground">Enter discounts as positive amounts; they are subtracted.</p>
          </fieldset>

          <Field label="Note on the invoice (optional)" error={errors.notes?.message}>
            {(p) => <Input {...p} {...form.register("notes")} />}
          </Field>
          <DialogFooter>
            <SubmitButton pending={pending}>Create charge</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
