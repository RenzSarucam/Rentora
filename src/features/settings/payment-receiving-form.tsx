"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Field, FormError, SubmitButton } from "@/components/app/form";
import { Input } from "@/components/ui/input";
import type { FieldErrors } from "@/lib/errors";
import type { PaymentReceivingAccount, ReceivingMethod } from "./payment-receiving";
import { saveReceivingAccount } from "./payment-actions";

export function PaymentReceivingForm({ method, account }: { method: ReceivingMethod; account?: PaymentReceivingAccount }) {
  const [preview, setPreview] = useState(account?.qrUrl ?? null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const localURL = useRef<string | null>(null);
  const router = useRouter();
  const title = method === "gcash" ? "GCash" : "Bank transfer";
  useEffect(() => () => { if (localURL.current) URL.revokeObjectURL(localURL.current); }, []);

  return (
    <form className="grid min-w-0 gap-4" onSubmit={(event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      form.set("method", method);
      setError(null); setErrors({});
      startTransition(async () => {
        const result = await saveReceivingAccount(form);
        if (!result.ok) { setError(result.error); setErrors(result.fieldErrors ?? {}); return; }
        toast.success(result.message);
        router.refresh();
      });
    }}>
      <h3 className="text-sm font-semibold">{title}</h3>
      <FormError message={error} />
      <Field label="Receiving account name" hint="Use the name shown by your QR." error={errors.accountName}>
        {(props) => <Input {...props} name="accountName" defaultValue={account?.accountName ?? ""} maxLength={120} disabled={pending} />}
      </Field>
      {method === "bank_transfer" && (
        <Field label="Receiving bank" error={errors.institutionName}>
          {(props) => <Input {...props} name="institutionName" defaultValue={account?.institutionName ?? ""} maxLength={100} disabled={pending} />}
        </Field>
      )}
      <Field label={method === "gcash" ? "Receiving mobile number (optional)" : "Receiving account number (optional)"}
        hint="Boarders can copy this if they enter the transfer details manually." error={errors.accountNumber}>
        {(props) => <Input {...props} name="accountNumber" autoComplete="off" defaultValue={account?.accountNumber ?? ""} maxLength={40} disabled={pending} />}
      </Field>
      <Field label={account ? "Replace QR image (optional)" : "Receiving QR image"}
        hint="Original JPG or PNG, up to 4 MB. The image is kept unchanged and shared only with your house members." error={errors.qr}>
        {(props) => <Input {...props} type="file" name="qr" accept="image/jpeg,image/png" disabled={pending} className="h-auto min-h-10 py-2"
          onChange={(event) => {
            if (localURL.current) URL.revokeObjectURL(localURL.current);
            const file = event.target.files?.[0];
            localURL.current = file ? URL.createObjectURL(file) : null;
            setPreview(localURL.current ?? account?.qrUrl ?? null);
          }} />}
      </Field>
      {preview && (
        <div className="rounded-md border border-border bg-white p-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- authenticated signed URL or local original-image preview */}
          <img src={preview} alt={`${title} receiving QR preview`} className="mx-auto max-h-80 max-w-full object-contain" />
        </div>
      )}
      <div><SubmitButton pending={pending} variant="outline">Save {title} QR</SubmitButton></div>
    </form>
  );
}
