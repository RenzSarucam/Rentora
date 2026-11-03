"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, FormError, SubmitButton } from "@/components/app/form";
import { useActionForm } from "@/components/app/use-action-form";
import { manilaToday } from "@/lib/dates";
import { centavosToInput, formatPeso } from "@/lib/money";
import { PAYMENT_METHOD_LABELS, paymentMethods } from "@/lib/validation";
import { recordPayment } from "./actions";
import { recordPaymentSchema } from "./schemas";

export type PayableBoarder = { memberId: string; name: string; outstanding: number };

const selectClass = "h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm";

/**
 * Records a payment received in person (cash) or confirmed outside the app.
 * With `invoice`, the payment is applied to that invoice first.
 */
export function RecordPaymentDialog({
  boarders,
  invoice,
  variant = "default",
}: {
  boarders: PayableBoarder[];
  invoice?: { id: string; number: string; memberId: string; balance: number };
  variant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const [open, setOpen] = useState(false);
  const payable = boarders.filter((b) => b.outstanding > 0);
  const first = invoice?.memberId ?? payable[0]?.memberId ?? "";
  const defaults = () => ({
    memberId: first,
    amount: invoice ? centavosToInput(invoice.balance) : "",
    method: "cash" as const,
    reference: "",
    receivedOn: manilaToday(),
    notes: "",
    invoiceId: invoice?.id ?? "",
  });
  const form = useForm({ resolver: zodResolver(recordPaymentSchema), defaultValues: defaults() });
  const { onSubmit, pending, error } = useActionForm(form, recordPayment, {
    onSuccess: (data) => {
      setOpen(false);
      form.reset(defaults());
      toast("Receipt ready", { action: { label: "Open", onClick: () => window.open(`/receipts/${data.id}`, "_blank", "noopener") } });
    },
  });
  const errors = form.formState.errors;
  const memberId = useWatch({ control: form.control, name: "memberId" });
  const selected = boarders.find((b) => b.memberId === memberId);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) form.reset(defaults());
      }}
    >
      <DialogTrigger asChild>
        <Button variant={variant} disabled={!invoice && payable.length === 0} title={!invoice && payable.length === 0 ? "No boarder has an unpaid balance" : undefined}>
          {!invoice && <Plus aria-hidden />} Record payment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record a payment</DialogTitle>
          <DialogDescription>
            {invoice ? (
              <>
                Applied to <span className="font-mono">{invoice.number}</span> first, then to the boarder&apos;s oldest unpaid bills.
              </>
            ) : (
              "Applied to the boarder's oldest unpaid bills first. A receipt number is issued automatically."
            )}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <FormError message={error} />
          {!invoice && (
            <Field
              label="Boarder"
              error={errors.memberId?.message}
              hint={selected ? `Unpaid balance: ${formatPeso(selected.outstanding)}` : undefined}
            >
              {(p) => (
                <select {...p} className={selectClass} {...form.register("memberId")}>
                  {payable.map((b) => (
                    <option key={b.memberId} value={b.memberId}>
                      {b.name} · owes {formatPeso(b.outstanding)}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Amount (₱)" error={errors.amount?.message}>
              {(p) => <Input {...p} inputMode="decimal" placeholder="3,500" {...form.register("amount")} />}
            </Field>
            <Field label="Received on" error={errors.receivedOn?.message}>
              {(p) => <Input {...p} type="date" max={manilaToday()} {...form.register("receivedOn")} />}
            </Field>
            <Field label="Method" error={errors.method?.message}>
              {(p) => (
                <select {...p} className={selectClass} {...form.register("method")}>
                  {paymentMethods.map((m) => (
                    <option key={m} value={m}>
                      {PAYMENT_METHOD_LABELS[m]}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Reference (optional)" error={errors.reference?.message}>
              {(p) => <Input {...p} placeholder="GCash ref, OR no." {...form.register("reference")} />}
            </Field>
          </div>
          <Field label="Notes (optional)" error={errors.notes?.message}>
            {(p) => <Input {...p} {...form.register("notes")} />}
          </Field>
          <DialogFooter>
            <SubmitButton pending={pending}>Record payment</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
