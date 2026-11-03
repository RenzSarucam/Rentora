import { z } from "zod";
import { isoDate, onlineMethods, optionalText, pesoAmount, phone, requiredText, uuid } from "@/lib/validation";

export const paymentProofSchema = z.object({
  invoiceId: uuid,
  amount: pesoAmount(),
  method: z.enum(onlineMethods, { message: "Choose how you paid." }),
  reference: z
    .string()
    .trim()
    .min(4, { message: "Enter the reference number from your receipt." })
    .max(64, { message: "Reference is too long." })
    .regex(/^[A-Za-z0-9][A-Za-z0-9 -]*$/, { message: "Use letters, numbers, spaces and dashes only." }),
  paidOn: isoDate,
});

export const maintenanceSchema = z.object({
  title: requiredText("Title", 120, 3),
  description: requiredText("Description", 2000),
  priority: z.enum(["normal", "urgent"], { message: "Choose a priority." }),
});

export const commentSchema = z.object({
  requestId: uuid,
  body: requiredText("Message", 2000),
});

export const profileSchema = z.object({
  fullName: requiredText("Name", 120, 2),
  phone,
  emergencyName: optionalText(120),
  emergencyPhone: phone,
});
