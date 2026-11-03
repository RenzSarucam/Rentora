import { z } from "zod";
import { isoDate, optionalText, paymentMethod, pesoAmount, requiredText, uuid } from "@/lib/validation";

export const recordPaymentSchema = z.object({
  memberId: uuid,
  amount: pesoAmount(),
  method: paymentMethod,
  reference: optionalText(64),
  receivedOn: isoDate,
  notes: optionalText(500),
  invoiceId: z
    .union([uuid, z.literal("")])
    .optional()
    .transform((v) => (v ? v : null)),
});

export const approveSchema = z.object({ submissionId: uuid, note: optionalText(500) });
export const rejectSchema = z.object({ submissionId: uuid, note: requiredText("Reason", 500, 3) });
export const voidPaymentSchema = z.object({ paymentId: uuid, reason: requiredText("Reason", 300, 3) });
export const proofSchema = z.object({ submissionId: uuid });
