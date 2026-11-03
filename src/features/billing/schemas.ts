import { z } from "zod";
import { isoDate, optionalText, pesoAmount, requiredText, uuid } from "@/lib/validation";

export const generateSchema = z
  .object({
    month: isoDate.refine((v) => v.endsWith("-01"), { message: "Choose a month." }),
    dueDate: isoDate,
  })
  .refine((v) => v.dueDate >= v.month, { message: "Due date must be in or after the billing month.", path: ["dueDate"] });

export const chargeItemKinds = ["deposit", "fee", "other", "discount"] as const;

export const CHARGE_ITEM_LABELS: Record<(typeof chargeItemKinds)[number], string> = {
  deposit: "Deposit",
  fee: "Fee",
  other: "Other",
  discount: "Discount",
};

const itemSchema = z.object({
  kind: z.enum(chargeItemKinds),
  description: requiredText("Description", 200),
  amount: pesoAmount(),
});

export const newChargeSchema = z.object({
  memberId: uuid,
  kind: z.enum(["deposit", "other"]),
  dueDate: isoDate,
  notes: optionalText(1000),
  items: z.array(itemSchema).min(1, { message: "Add at least one line." }).max(20, { message: "At most 20 lines." }),
});

/** Discounts are entered as positive pesos and stored negative. */
export function signedAmount(kind: string, centavos: number): number {
  return kind === "discount" ? -centavos : centavos;
}

export const addItemSchema = z.object({
  invoiceId: uuid,
  kind: z.enum(["fee", "discount", "deposit", "other"]),
  description: requiredText("Description", 200),
  amount: pesoAmount(),
});

export const dueDateSchema = z.object({ invoiceId: uuid, dueDate: isoDate });

export const voidInvoiceSchema = z.object({ invoiceId: uuid, reason: requiredText("Reason", 300, 3) });

export const removeItemSchema = z.object({ itemId: uuid, invoiceId: uuid });
