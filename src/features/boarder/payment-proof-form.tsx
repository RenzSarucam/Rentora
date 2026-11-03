"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Field, FormError, SubmitButton } from "@/components/app/form";
import type { FieldErrors } from "@/lib/errors";
import { centavosToInput, formatPeso } from "@/lib/money";
import { onlineMethods, PAYMENT_METHOD_LABELS } from "@/lib/validation";
import { cn } from "@/lib/utils";
import { submitPaymentProof } from "./actions";
import { FilePicker } from "./file-picker";
import { paymentProofSchema } from "./schemas";

export function PaymentProofForm({ invoiceId, payable, today }: { invoiceId: string; payable: number; today: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState(centavosToInput(payable));
  const [method, setMethod] = useState<(typeof onlineMethods)[number]>("gcash");
  const [reference, setReference] = useState("");
  const [paidOn, setPaidOn] = useState(today);
  const [proof, setProof] = useState<File | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const values = { invoiceId, amount, method, reference, paidOn };
    const parsed = paymentProofSchema.safeParse(values);
    const next: FieldErrors = {};
    if (!parsed.success) for (const i of parsed.error.issues) next[i.path.join(".")] ??= i.message;
    if (parsed.success && parsed.data.amount > payable) next.amount = `You can pay up to ${formatPeso(payable)} on this bill.`;
    if (!proof) next.proof = "Attach your payment screenshot or receipt.";
    setErrors(next);
    if (Object.keys(next).length || !proof) return;

    const form = new FormData();
    Object.entries(values).forEach(([k, v]) => form.set(k, v));
    form.set("proof", proof);
    startTransition(async () => {
      const result = await submitPaymentProof(form);
      if (result.ok) {
        toast.success(result.message ?? "Payment sent for review.");
        router.push("/boarder/payment-history");
        router.refresh();
      } else {
        setError(result.error);
        setErrors(result.fieldErrors ?? {});
      }
    });
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <p className="rounded-xl bg-raised px-3.5 py-3 text-sm text-muted-foreground">
        Pay through GCash, Maya or your bank first, then send the screenshot here. Your landlord checks it before the bill is marked paid.
      </p>
      <FormError message={error} />

      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">How did you pay?</legend>
        <div className="grid grid-cols-2 gap-2">
          {onlineMethods.map((m) => (
            <label
              key={m}
              className={cn(
                "flex h-12 cursor-pointer items-center justify-center rounded-xl border text-sm font-medium transition-colors has-focus-visible:outline-2 has-focus-visible:outline-ring",
                method === m ? "border-teal bg-teal-soft text-teal" : "border-border text-foreground active:bg-raised",
              )}
            >
              <input type="radio" name="method" value={m} checked={method === m} onChange={() => setMethod(m)} className="sr-only" />
              {PAYMENT_METHOD_LABELS[m]}
            </label>
          ))}
        </div>
        {errors.method && <p className="text-xs font-medium text-negative">{errors.method}</p>}
      </fieldset>

      <Field label="Amount paid (₱)" hint={`Up to ${formatPeso(payable)} on this bill`} error={errors.amount}>
        {(p) => <Input {...p} inputMode="decimal" className="h-12 rounded-xl text-base num" value={amount} onChange={(e) => setAmount(e.target.value)} />}
      </Field>
      <Field label="Reference number" hint="The transaction or reference no. on your receipt" error={errors.reference}>
        {(p) => (
          <Input
            {...p}
            autoCapitalize="characters"
            autoComplete="off"
            className="h-12 rounded-xl text-base"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        )}
      </Field>
      <Field label="Date paid" error={errors.paidOn}>
        {(p) => <Input {...p} type="date" max={today} className="h-12 rounded-xl text-base" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />}
      </Field>
      <FilePicker label="Proof of payment" accept="image/jpeg,image/png,image/webp,application/pdf" required error={errors.proof} onChange={setProof} />

      <SubmitButton pending={pending} className="h-12 w-full rounded-xl text-[15px]">
        Send for review
      </SubmitButton>
    </form>
  );
}
