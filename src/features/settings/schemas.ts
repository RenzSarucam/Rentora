import { z } from "zod";
import { optionalText, requiredText, uuid } from "@/lib/validation";

export const orgSchema = z.object({
  name: requiredText("Business name", 120, 2),
  defaultDueDay: z.coerce
    .number({ message: "Enter a day of the month." })
    .int()
    .min(1, { message: "Use a day from 1 to 28." })
    .max(28, { message: "Use a day from 1 to 28 so every month has it." }),
});

export const propertySchema = z.object({
  id: uuid.optional().or(z.literal("").transform(() => undefined)),
  name: requiredText("Property name", 120),
  address: optionalText(300),
});

export const receivingAccountSchema = z.object({
  method: z.enum(["gcash", "bank_transfer"]),
  accountName: requiredText("Account name", 120, 2),
  institutionName: optionalText(100),
  accountNumber: z.string().trim().max(40).refine((value) => !value || /^[A-Za-z0-9+ -]{4,40}$/.test(value), {
    message: "Enter the receiving mobile or account number, or leave it blank when using QR.",
  }).transform((value) => value || null),
}).refine((value) => value.method !== "bank_transfer" || !!value.institutionName, {
  path: ["institutionName"], message: "Enter the receiving bank name.",
});
