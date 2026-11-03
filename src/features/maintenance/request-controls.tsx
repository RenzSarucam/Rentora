"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormError, SubmitButton } from "@/components/app/form";
import { useActionForm } from "@/components/app/use-action-form";
import { addMaintenanceComment, changeMaintenanceStatus } from "./actions";
import { commentSchema, statusChangeSchema } from "./schemas";
import type { MaintenanceStatus } from "./queries";

const LABELS: Record<MaintenanceStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  cancelled: "Cancelled",
};

export function StatusChangeForm({ requestId, current }: { requestId: string; current: MaintenanceStatus }) {
  const next: MaintenanceStatus = current === "open" ? "in_progress" : current === "in_progress" ? "resolved" : "open";
  const form = useForm({
    resolver: zodResolver(statusChangeSchema),
    defaultValues: { requestId, status: next, note: "" },
  });
  const { onSubmit, pending, error } = useActionForm(form, changeMaintenanceStatus, {
    onSuccess: () => form.reset({ requestId, status: next, note: "" }),
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-3">
      <FormError message={error} />
      <Field label="Move to" error={form.formState.errors.status?.message}>
        {(p) => (
          <select {...p} {...form.register("status")} className="h-9 rounded-md border border-input bg-background px-2.5 text-sm">
            {(Object.keys(LABELS) as MaintenanceStatus[])
              .filter((s) => s !== current)
              .map((s) => (
                <option key={s} value={s}>
                  {LABELS[s]}
                </option>
              ))}
          </select>
        )}
      </Field>
      <Field label="Note to the boarder (optional)" error={form.formState.errors.note?.message}>
        {(p) => <Textarea {...p} rows={2} placeholder="Plumber booked for Saturday morning." {...form.register("note")} />}
      </Field>
      <SubmitButton pending={pending}>Update status</SubmitButton>
    </form>
  );
}

export function CommentForm({ requestId }: { requestId: string }) {
  const form = useForm({ resolver: zodResolver(commentSchema), defaultValues: { requestId, body: "" } });
  const { onSubmit, pending, error } = useActionForm(form, addMaintenanceComment, {
    onSuccess: () => form.reset({ requestId, body: "" }),
  });
  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-3">
      <FormError message={error} />
      <Field label="Add an update" error={form.formState.errors.body?.message}>
        {(p) => <Textarea {...p} rows={3} placeholder="Parts ordered, arriving Tuesday." {...form.register("body")} />}
      </Field>
      <div>
        <SubmitButton pending={pending} variant="outline">
          Post update
        </SubmitButton>
      </div>
    </form>
  );
}
