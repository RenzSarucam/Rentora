"use client";

import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FormError, SubmitButton } from "@/components/app/form";
import { formatPeso } from "@/lib/money";
import { deleteBoarder } from "./deletion-actions";

type Props = { memberId: string; name: string; email: string; invoices: number; payments: number; outstanding: number; hasBed: boolean };

export function DeleteBoarderDialog({ memberId, name, email, invoices, payments, outstanding, hasBed }: Props) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [acknowledge, setAcknowledge] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const checkboxId = useId();
  const confirmed = acknowledge && confirmation.trim().toLowerCase() === email.toLowerCase();
  const changeOpen = (next: boolean) => {
    if (pending) return;
    setOpen(next);
    if (!next) { setConfirmation(""); setAcknowledge(false); setError(null); }
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="text-negative hover:text-negative">Delete boarder permanently</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Delete {name} permanently?</DialogTitle>
          <DialogDescription>Their login and linked records will be removed. This cannot be undone.</DialogDescription>
        </DialogHeader>
        <form className="grid min-w-0 gap-4" onSubmit={(event) => {
          event.preventDefault();
          if (!confirmed || pending) return;
          setError(null);
          startTransition(async () => {
            const result = await deleteBoarder({ memberId, confirmationEmail: confirmation, acknowledge });
            if (!result.ok) setError(result.error);
          });
        }}>
          <FormError message={error} />
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 rounded-md border border-border p-4 text-sm">
            <dt>Invoices</dt><dd className="num text-right">{invoices}</dd>
            <dt>Payments and receipts</dt><dd className="num text-right">{payments}</dd>
            <dt>Unpaid balance removed</dt><dd className="num text-right">{formatPeso(outstanding)}</dd>
          </dl>
          <p className="text-sm text-muted-foreground">
            Profile, invitations, bed history, invoice items, payment proofs, repair requests and photos, and announcement read receipts are included.
            {hasBed && " Their current bed will become vacant."} Collection and balance reports will change. An Activity entry records the deletion.
          </p>
          <Field label="Type the boarder's email to confirm" hint={<span className="break-all">{email}</span>}>
            {(props) => <Input {...props} value={confirmation} onChange={(event) => setConfirmation(event.target.value)}
              type="email" autoComplete="off" autoCapitalize="none" spellCheck={false} disabled={pending} />}
          </Field>
          <div className="flex items-start gap-2.5">
            <input id={checkboxId} type="checkbox" className="mt-1 size-4 shrink-0 accent-foreground" checked={acknowledge}
              onChange={(event) => setAcknowledge(event.target.checked)} disabled={pending} />
            <label htmlFor={checkboxId} className="text-sm leading-5">I understand that this permanently deletes the boarder and their financial history.</label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => changeOpen(false)}>Cancel</Button>
            <SubmitButton pending={pending} disabled={!confirmed} className="bg-negative text-white hover:bg-negative/90">Delete permanently</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
