"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormError, SubmitButton } from "@/components/app/form";
import { useActionForm } from "@/components/app/use-action-form";
import { addMaintenanceComment } from "./actions";
import { commentSchema } from "./schemas";

export function CommentForm({ requestId }: { requestId: string }) {
  const form = useForm({ resolver: zodResolver(commentSchema), defaultValues: { requestId, body: "" } });
  const { onSubmit, pending, error } = useActionForm(form, addMaintenanceComment, {
    onSuccess: () => form.reset({ requestId, body: "" }),
  });
  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-3">
      <FormError message={error} />
      <Field label="Add a message" error={form.formState.errors.body?.message}>
        {(p) => <Textarea {...p} rows={3} className="rounded-xl text-base" placeholder="Any update for your landlord?" {...form.register("body")} />}
      </Field>
      <SubmitButton pending={pending} variant="outline" className="h-11 rounded-xl">
        Send message
      </SubmitButton>
    </form>
  );
}
