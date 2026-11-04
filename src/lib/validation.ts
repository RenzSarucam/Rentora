import { z } from "zod";
import { MAX_CENTAVOS, parsePesoToCentavos } from "@/lib/money";
import { isIsoDate } from "@/lib/dates";

// Shared building blocks. Every server action re-validates with these, whatever the client did.

export const uuid = z.uuid({ message: "Invalid reference." });

export const isoDate = z.string().refine(isIsoDate, { message: "Enter a valid date." });

const trimmed = (max: number) => z.string().trim().max(max, { message: `Keep it under ${max} characters.` });

export const requiredText = (label: string, max: number, min = 1) =>
  trimmed(max).min(min, { message: min > 1 ? `${label} needs at least ${min} characters.` : `${label} is required.` });

export const optionalText = (max: number) =>
  trimmed(max)
    .optional()
    .transform((v) => (v ? v : null));

/** Accepts "3,500.00" or 3500 (pesos) and yields integer centavos. */
export const pesoAmount = (opts: { allowZero?: boolean } = {}) =>
  z.union([z.string(), z.number()]).transform((value, ctx) => {
    const centavos = parsePesoToCentavos(value);
    if (centavos === null) {
      ctx.addIssue({ code: "custom", message: "Enter an amount like 3500 or 3,500.50." });
      return z.NEVER;
    }
    if (!opts.allowZero && centavos === 0) {
      ctx.addIssue({ code: "custom", message: "Amount must be more than ₱0." });
      return z.NEVER;
    }
    if (centavos > MAX_CENTAVOS) {
      ctx.addIssue({ code: "custom", message: "Amount is too large." });
      return z.NEVER;
    }
    return centavos;
  });

export const phone = z
  .string()
  .trim()
  .max(32)
  .refine((v) => v === "" || /^[+\d][\d\s-]{6,}$/.test(v), { message: "Enter a valid phone number, e.g. 0917 123 4567." })
  .optional()
  .transform((v) => (v ? v : null));

export const email = z.string().trim().toLowerCase().pipe(z.email({ message: "Enter a valid email address." }));

export const password = z
  .string()
  .min(10, { message: "Use at least 10 characters." })
  .max(72, { message: "Use at most 72 characters." })
  .refine((v) => /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v), {
    message: "Use upper- and lowercase letters and at least one number.",
  });

export const paymentMethods = ["cash", "gcash", "maya", "bank_transfer", "other"] as const;
export const paymentMethod = z.enum(paymentMethods);
export const onlineMethods = ["gcash", "bank_transfer"] as const;

export const PAYMENT_METHOD_LABELS: Record<(typeof paymentMethods)[number], string> = {
  cash: "Cash",
  gcash: "GCash",
  maya: "Maya",
  bank_transfer: "Bank transfer",
  other: "Other",
};

/** Turns FormData into a plain object for zod, keeping File values. */
export function formToObject(form: FormData): Record<string, FormDataEntryValue> {
  const out: Record<string, FormDataEntryValue> = {};
  form.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}
