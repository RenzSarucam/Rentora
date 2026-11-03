"use client";

import { useState } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BedDouble } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, FormError, SubmitButton } from "@/components/app/form";
import { useActionForm } from "@/components/app/use-action-form";
import { formatDate, manilaToday } from "@/lib/dates";
import { centavosToInput, formatPeso } from "@/lib/money";
import { assignBed, changeRent, endAssignment, transferBed } from "./actions";
import type { BedOption, BoarderOption } from "./queries";
import { assignSchema, endSchema, rentSchema, transferSchema } from "./schemas";

const selectClass = "h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm";

function BedSelect({
  beds,
  props,
  register,
  onPick,
}: {
  beds: BedOption[];
  props: Record<string, unknown>;
  register: UseFormRegisterReturn<"bedId">;
  onPick: (bed: BedOption | undefined) => void;
}) {
  const rooms = Array.from(new Set(beds.map((b) => b.roomCode)));
  return (
    <select
      {...props}
      {...register}
      onChange={(e) => {
        register.onChange(e);
        onPick(beds.find((b) => b.id === e.target.value));
      }}
      className={selectClass}
    >
      <option value="">Choose a vacant bed</option>
      {rooms.map((code) => (
        <optgroup key={code} label={`Room ${code}`}>
          {beds
            .filter((b) => b.roomCode === code)
            .map((b) => (
              <option key={b.id} value={b.id}>
                {b.label} · {formatPeso(b.rate)}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}

export function AssignDialog({
  boarders,
  beds,
  presetMemberId,
  variant = "default",
  label = "Assign bed",
}: {
  boarders: BoarderOption[];
  beds: BedOption[];
  presetMemberId?: string;
  variant?: "default" | "outline";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const defaults = { memberId: presetMemberId ?? "", bedId: "", moveIn: manilaToday(), rent: "" };
  const form = useForm({ resolver: zodResolver(assignSchema), defaultValues: defaults });
  const { onSubmit, pending, error } = useActionForm(form, assignBed, {
    onSuccess: () => {
      setOpen(false);
      form.reset({ ...defaults, moveIn: manilaToday() });
    },
  });
  const errors = form.formState.errors;
  const nothingToDo = beds.length === 0 || (!presetMemberId && boarders.length === 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} disabled={nothingToDo} title={nothingToDo ? "No vacant beds or unassigned boarders" : undefined}>
          <BedDouble aria-hidden /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign a bed</DialogTitle>
          <DialogDescription>Rent is fixed on the assignment, so later room rate changes do not affect this boarder.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <FormError message={error} />
          {!presetMemberId && (
            <Field label="Boarder" error={errors.memberId?.message}>
              {(p) => (
                <select {...p} {...form.register("memberId")} className={selectClass}>
                  <option value="">Choose a boarder</option>
                  {boarders.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}
          <Field label="Bed" error={errors.bedId?.message}>
            {(p) => (
              <BedSelect
                beds={beds}
                props={p}
                register={form.register("bedId")}
                onPick={(bed) => bed && form.setValue("rent", centavosToInput(bed.rate))}
              />
            )}
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Move-in date" error={errors.moveIn?.message}>
              {(p) => <Input {...p} type="date" {...form.register("moveIn")} />}
            </Field>
            <Field label="Monthly rent (₱)" error={errors.rent?.message}>
              {(p) => <Input {...p} inputMode="decimal" {...form.register("rent")} />}
            </Field>
          </div>
          <DialogFooter>
            <SubmitButton pending={pending}>Assign bed</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TransferDialog({ memberId, name, currentRent, beds }: { memberId: string; name: string; currentRent: number; beds: BedOption[] }) {
  const [open, setOpen] = useState(false);
  const defaults = { memberId, bedId: "", date: manilaToday(), rent: centavosToInput(currentRent) };
  const form = useForm({ resolver: zodResolver(transferSchema), defaultValues: defaults });
  const { onSubmit, pending, error } = useActionForm(form, transferBed, {
    onSuccess: () => {
      setOpen(false);
      form.reset(defaults);
    },
  });
  const errors = form.formState.errors;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" disabled={beds.length === 0}>
          Transfer
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Move {name} to another bed</DialogTitle>
          <DialogDescription>The current bed is closed on the transfer date and the new one starts the same day.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <FormError message={error} />
          <Field label="New bed" error={errors.bedId?.message}>
            {(p) => (
              <BedSelect beds={beds} props={p} register={form.register("bedId")} onPick={(bed) => bed && form.setValue("rent", centavosToInput(bed.rate))} />
            )}
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Transfer date" error={errors.date?.message}>
              {(p) => <Input {...p} type="date" {...form.register("date")} />}
            </Field>
            <Field label="New monthly rent (₱)" error={errors.rent?.message}>
              {(p) => <Input {...p} inputMode="decimal" {...form.register("rent")} />}
            </Field>
          </div>
          <DialogFooter>
            <SubmitButton pending={pending}>Transfer</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function MoveOutDialog({ assignmentId, name, moveIn }: { assignmentId: string; name: string; moveIn: string }) {
  const [open, setOpen] = useState(false);
  const defaults = { assignmentId, moveOut: manilaToday(), reason: "" };
  const form = useForm({ resolver: zodResolver(endSchema), defaultValues: defaults });
  const { onSubmit, pending, error } = useActionForm(form, endAssignment, { onSuccess: () => setOpen(false) });
  const errors = form.formState.errors;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          Move out
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record move-out for {name}</DialogTitle>
          <DialogDescription>
            Moved in {formatDate(moveIn)}. Unpaid invoices stay on their account; the bed becomes vacant.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <FormError message={error} />
          <Field label="Move-out date" error={errors.moveOut?.message}>
            {(p) => <Input {...p} type="date" min={moveIn} {...form.register("moveOut")} />}
          </Field>
          <Field label="Reason" hint="Optional, e.g. end of semester." error={errors.reason?.message}>
            {(p) => <Input {...p} {...form.register("reason")} />}
          </Field>
          <DialogFooter>
            <SubmitButton pending={pending}>Record move-out</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RentDialog({ assignmentId, rent, name }: { assignmentId: string; rent: number; name: string }) {
  const [open, setOpen] = useState(false);
  const form = useForm({ resolver: zodResolver(rentSchema), defaultValues: { assignmentId, rent: centavosToInput(rent) } });
  const { onSubmit, pending, error } = useActionForm(form, changeRent, { onSuccess: () => setOpen(false) });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          Change rent
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Change rent for {name}</DialogTitle>
          <DialogDescription>Applies to invoices generated from now on. Issued invoices keep their amounts.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <FormError message={error} />
          <Field label="Monthly rent (₱)" error={form.formState.errors.rent?.message}>
            {(p) => <Input {...p} inputMode="decimal" {...form.register("rent")} />}
          </Field>
          <DialogFooter>
            <SubmitButton pending={pending}>Save rent</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
