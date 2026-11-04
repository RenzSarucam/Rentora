"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Field, FormError, SubmitButton } from "@/components/app/form";
import type { FieldErrors } from "@/lib/errors";
import { centavosToInput, formatPeso, parsePesoToCentavos } from "@/lib/money";
import { onlineMethods, PAYMENT_METHOD_LABELS } from "@/lib/validation";
import { cn } from "@/lib/utils";
import { submitPaymentProof } from "./actions";
import { FilePicker } from "./file-picker";
import { paymentProofSchema } from "./schemas";
import { PaymentQRCard } from "./payment-qr-card";
import type { PaymentReceivingAccount } from "@/features/settings/payment-receiving";

export function PaymentProofForm({ invoiceId, payable, today, receivingAccounts }: {
  invoiceId: string; payable: number; today: string; receivingAccounts: PaymentReceivingAccount[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState(centavosToInput(payable));
  const [method, setMethod] = useState<(typeof onlineMethods)[number]>("gcash");
  const [reference, setReference] = useState("");
  const [paidOn, setPaidOn] = useState(today);
  const [proof, setProof] = useState<File | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const enteredAmount = parsePesoToCentavos(amount);
  const validAmount = enteredAmount !== null && enteredAmount > 0 && enteredAmount <= payable;
  const amountError = amount.trim() && !validAmount
    ? `Enter an amount greater than ₱0 and up to ${formatPeso(payable)}.` : undefined;
  const receivingAccount = receivingAccounts.find((account) => account.method === method);

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
        Choose GCash or bank transfer, pay using the receiving QR, then send your proof here. Your landlord approves the payment before it is credited to your bill.
      </p>
      <FormError message={error} />

      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">Payment method</legend>
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

      <Field label="Amount to pay (₱)" hint={`Up to ${formatPeso(payable)} on this bill. You can make a partial payment.`} error={errors.amount ?? amountError}>
        {(p) => <Input {...p} inputMode="decimal" className="h-12 rounded-xl text-base num" value={amount} onChange={(e) => setAmount(e.target.value)} />}
      </Field>
      <PaymentQRCard key={`${method}-${receivingAccount?.qrUrl ?? "missing"}`} method={method} account={receivingAccount}
        amount={validAmount ? enteredAmount : null} disabled={pending} />
      <div className="border-t border-border pt-4">
        <h3 className="text-base font-semibold">After paying, send your proof</h3>
        <p className="mt-1 text-sm text-muted-foreground">Use the actual amount and reference on your receipt.</p>
      </div>
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
