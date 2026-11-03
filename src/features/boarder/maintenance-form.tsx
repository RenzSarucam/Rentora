"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormError, SubmitButton } from "@/components/app/form";
import type { FieldErrors } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { createMaintenanceRequest } from "./actions";
import { FilePicker } from "./file-picker";
import { maintenanceSchema } from "./schemas";

export function MaintenanceForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"normal" | "urgent">("normal");
  const [photo, setPhoto] = useState<File | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const values = { title, description, priority };
    const parsed = maintenanceSchema.safeParse(values);
    const next: FieldErrors = {};
    if (!parsed.success) for (const i of parsed.error.issues) next[i.path.join(".")] ??= i.message;
    setErrors(next);
    if (Object.keys(next).length) return;

    const form = new FormData();
    Object.entries(values).forEach(([k, v]) => form.set(k, v));
    if (photo) form.set("photo", photo);
    startTransition(async () => {
      const result = await createMaintenanceRequest(form);
      if (result.ok) {
        toast.success(result.message ?? "Request sent.");
        router.push(`/boarder/maintenance/${result.data.id}`);
        router.refresh();
      } else {
        setError(result.error);
        setErrors(result.fieldErrors ?? {});
      }
    });
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <FormError message={error} />
      <Field label="What needs fixing?" error={errors.title}>
        {(p) => <Input {...p} placeholder="e.g. Leaking faucet in the CR" className="h-12 rounded-xl text-base" value={title} onChange={(e) => setTitle(e.target.value)} />}
      </Field>
      <Field label="Details" error={errors.description}>
        {(p) => (
          <Textarea
            {...p}
            rows={4}
            placeholder="Where it is, since when, and anything the caretaker should know."
            className="rounded-xl text-base"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        )}
      </Field>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">How urgent is it?</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["normal", "Can wait a few days"],
              ["urgent", "Urgent · safety or no water/power"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={cn(
                "flex min-h-12 cursor-pointer items-center justify-center rounded-xl border px-3 py-2 text-center text-sm font-medium has-focus-visible:outline-2 has-focus-visible:outline-ring",
                priority === value ? "border-teal bg-teal-soft text-teal" : "border-border active:bg-raised",
              )}
            >
              <input type="radio" name="priority" value={value} checked={priority === value} onChange={() => setPriority(value)} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <FilePicker label="Photo" accept="image/jpeg,image/png,image/webp" error={errors.photo} onChange={setPhoto} />
      <SubmitButton pending={pending} className="h-12 w-full rounded-xl text-[15px]">
        Send request
      </SubmitButton>
    </form>
  );
}
