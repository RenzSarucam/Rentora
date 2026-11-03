"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormError, SubmitButton } from "@/components/app/form";
import { useActionForm } from "@/components/app/use-action-form";
import { updateBoarderNotes } from "./actions";
import { notesSchema } from "./schemas";

export function NotesForm({ memberId, notes }: { memberId: string; notes: string | null }) {
  const form = useForm({ resolver: zodResolver(notesSchema), defaultValues: { memberId, notes: notes ?? "" } });
  const { onSubmit, pending, error } = useActionForm(form, updateBoarderNotes, {
    onSuccess: () => form.reset(form.getValues()),
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-3">
      <FormError message={error} />
      <Field label="Private notes" hint="Only you and other admins see this." error={form.formState.errors.notes?.message}>
        {(p) => <Textarea {...p} rows={3} placeholder="School, work schedule, curfew arrangements…" {...form.register("notes")} />}
      </Field>
      <div>
        <SubmitButton pending={pending} variant="outline" size="sm" disabled={!form.formState.isDirty}>
          Save notes
        </SubmitButton>
      </div>
    </form>
  );
}
