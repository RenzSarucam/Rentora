"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatPeso, centavosToInput } from "@/lib/money";
import { getBoarderPaymentQR } from "@/features/settings/payment-actions";
import type { PaymentReceivingAccount, ReceivingMethod } from "@/features/settings/payment-receiving";

export function PaymentQRCard({ account, method, amount, disabled }: {
  account?: PaymentReceivingAccount; method: ReceivingMethod; amount: number | null; disabled: boolean;
}) {
  const [url, setUrl] = useState(account?.qrUrl ?? null);
  const [imageError, setImageError] = useState(false);
  const [busy, setBusy] = useState(false);
  const title = method === "gcash" ? "GCash" : account?.institutionName || "your bank";
  async function openQR(download: boolean) {
    setBusy(true);
    try {
      const result = await getBoarderPaymentQR({ method, download });
      if (!result.ok) { toast.error(result.error); return; }
      if (download) window.location.assign(result.data.url);
      else { setUrl(result.data.url); setImageError(false); }
    } catch { toast.error("Could not open the receiving QR. Try again."); }
    finally { setBusy(false); }
  }
  async function copy(value: string, label: string) {
    try { await navigator.clipboard.writeText(value); toast.success(`${label} copied.`); }
    catch { toast.error("Copy is unavailable. Enter the displayed details in your payment app."); }
  }
  if (!account) return (
    <div className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
      Your landlord has not added the {method === "gcash" ? "GCash" : "bank transfer"} receiving QR yet.
    </div>
  );
  return (
    <section aria-label={`${title} receiving details`} className="grid gap-4 rounded-xl border border-border bg-background p-4">
      <div>
        <p className="text-xs text-muted-foreground">Send to {title}</p>
        <p className="mt-1 break-words text-base font-semibold">{account.accountName}</p>
        {account.accountNumber && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="num break-all text-sm">{account.accountNumber}</span>
            <Button type="button" variant="outline" size="sm" disabled={disabled}
              onClick={() => void copy(account.accountNumber!, "Receiving number")}>Copy number</Button>
          </div>
        )}
      </div>
      <div className="rounded-lg border border-border bg-white p-3">
        {url && !imageError ? (
          // eslint-disable-next-line @next/next/no-img-element -- private signed original QR; no public image optimization cache
          <img src={url} alt={`${title} receiving QR code`} className="mx-auto max-h-[480px] w-full max-w-xs object-contain" onError={() => setImageError(true)} />
        ) : (
          <div className="grid gap-2 py-5 text-center text-sm">
            <p className="text-muted-foreground">Open a fresh copy of the receiving QR.</p>
            <Button type="button" variant="outline" disabled={busy || disabled} onClick={() => void openQR(false)}>Refresh QR</Button>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Amount to send</p>
          <p className="num mt-1 text-xl font-semibold">{amount !== null && amount > 0 ? formatPeso(amount) : "Enter an amount"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={disabled || amount === null || amount <= 0}
            onClick={() => amount !== null && void copy(centavosToInput(amount), "Amount")}>Copy amount</Button>
          <Button type="button" variant="outline" disabled={disabled || busy} onClick={() => void openQR(true)}>{busy ? "Opening…" : "Save QR"}</Button>
        </div>
      </div>
      <p className="text-sm leading-6 text-muted-foreground">
        Save or scan the QR, open {method === "gcash" ? "GCash" : "your banking app"}, then scan or upload the saved image.
        Enter the same amount and confirm the receiver. Your app shows any transfer fee before you confirm.
      </p>
      <a className="w-fit text-sm underline underline-offset-4" target="_blank" rel="noreferrer"
        href={method === "gcash"
          ? "https://help.gcash.com/hc/fil/articles/900005327223-Paano-mag-send-money-via-QR-Code"
          : "https://help.gcash.com/hc/fil/articles/360017566414-Paano-mag-transfer-sa-local-banks-or-e-wallets"}>
        {method === "gcash" ? "How to pay with GCash QR" : "How to transfer with a bank QR"}
      </a>
    </section>
  );
}
