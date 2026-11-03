"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ActionButton } from "@/components/app/action-button";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatPeso } from "@/lib/money";
import { PAYMENT_METHOD_LABELS } from "@/lib/validation";
import { approveSubmission, getProofUrl, rejectSubmission } from "./actions";
import type { PendingSubmission } from "./queries";
import { ReasonDialog } from "./reason-dialog";

type Method = keyof typeof PAYMENT_METHOD_LABELS;

/** Side-by-side check of a boarder's payment proof against what they typed. */
export function ReviewDialog({ submission }: { submission: PendingSubmission }) {
  const [open, setOpen] = useState(false);
  const [proof, setProof] = useState<{ url?: string; error?: string }>({});
  const [loading, startLoading] = useTransition();

  const loadProof = () =>
    startLoading(async () => {
      const result = await getProofUrl({ submissionId: submission.id });
      setProof(result.ok ? { url: result.data.url } : { error: result.error });
    });

  const exceeds = submission.amount > submission.invoiceBalance;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) loadProof();
        else setProof({});
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Review
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {formatPeso(submission.amount)} from {submission.boarder}
          </DialogTitle>
          <DialogDescription>Match the screenshot to the reference and amount before confirming.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 md:grid-cols-[1fr_260px]">
          <div className="flex min-h-64 items-center justify-center rounded-lg border border-border bg-raised p-2">
            {loading && <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Loading proof" />}
            {!loading && proof.error && <p className="text-sm text-negative">{proof.error}</p>}
            {!loading && proof.url && !submission.isPdf && (
              // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private storage
              <img src={proof.url} alt={`Payment proof from ${submission.boarder}`} className="max-h-[60dvh] w-auto rounded-md object-contain" />
            )}
            {!loading && proof.url && submission.isPdf && (
              <a href={proof.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-medium underline-offset-4 hover:underline">
                Open PDF proof <ExternalLink className="size-4" aria-hidden />
              </a>
            )}
          </div>
          <div className="grid content-start gap-4">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-sm">
              <dt className="text-muted-foreground">Amount</dt>
              <dd className="num text-right font-medium">{formatPeso(submission.amount)}</dd>
              <dt className="text-muted-foreground">Method</dt>
              <dd className="text-right">{PAYMENT_METHOD_LABELS[submission.method as Method] ?? submission.method}</dd>
              <dt className="text-muted-foreground">Reference</dt>
              <dd className="text-right font-mono break-all">{submission.reference}</dd>
              <dt className="text-muted-foreground">Paid on</dt>
              <dd className="text-right">{formatDate(submission.paidOn)}</dd>
              <dt className="text-muted-foreground">Invoice</dt>
              <dd className="text-right">
                <Link href={`/admin/billing/${submission.invoiceId}`} className="font-mono hover:underline">
                  {submission.invoiceNumber}
                </Link>
              </dd>
              <dt className="text-muted-foreground">Invoice balance</dt>
              <dd className="num text-right">{formatPeso(submission.invoiceBalance)}</dd>
              <dt className="text-muted-foreground">Submitted</dt>
              <dd className="text-right">{formatDateTime(submission.submittedAt)}</dd>
            </dl>
            {exceeds && (
              <p className="rounded-md bg-pill-warning-bg px-3 py-2 text-xs text-pill-warning-ink">
                More than this invoice&apos;s balance. The rest goes to the boarder&apos;s other unpaid bills.
              </p>
            )}
            <div className="grid gap-2">
              <ActionButton
                variant="default"
                action={approveSubmission}
                input={{ submissionId: submission.id }}
                className="w-full"
                confirm={{
                  title: `Confirm ${formatPeso(submission.amount)} from ${submission.boarder}?`,
                  description: "This posts the payment, issues a receipt and cannot be approved twice. Only confirm after you see the money in your account.",
                  confirmLabel: "Confirm payment",
                }}
              >
                Confirm payment
              </ActionButton>
              <ReasonDialog
                trigger="Reject"
                triggerVariant="ghost"
                title="Reject this payment?"
                description="The boarder sees your reason and can submit a corrected proof."
                fieldLabel="Reason for the boarder"
                placeholder="The amount on the screenshot is ₱3,000, not ₱3,500."
                submitLabel="Reject submission"
                destructive
                action={(note) => rejectSubmission({ submissionId: submission.id, note })}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
