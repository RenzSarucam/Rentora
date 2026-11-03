"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import type { ActionResult } from "@/lib/errors";

/**
 * Wires a react-hook-form instance to a server action.
 * The zod resolver validates on the client for fast feedback, but the action receives the RAW
 * input values (getValues) and parses them itself, so transforms (pesos -> centavos) run exactly once.
 */
export function useActionForm<V extends FieldValues, R, T extends FieldValues = V>(
  form: UseFormReturn<V, unknown, T>,
  action: (input: V) => Promise<ActionResult<R>>,
  opts: { onSuccess?: (data: R) => void } = {},
) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const onSubmit = form.handleSubmit(() => {
    setError(null);
    const raw = form.getValues();
    startTransition(async () => {
      const result = await action(raw);
      if (!result) return; // the action redirected
      if (result.ok) {
        if (result.message) toast.success(result.message);
        router.refresh();
        opts.onSuccess?.(result.data);
      } else {
        setError(result.error);
        for (const [key, message] of Object.entries(result.fieldErrors ?? {})) {
          form.setError(key as Path<V>, { message });
        }
      }
    });
  });

  return { onSubmit, pending, error, setError };
}
