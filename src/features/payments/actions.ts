"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/session";
import { manilaToday } from "@/lib/dates";
import { dbFail, fail, ok, validationFail, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { approveSchema, proofSchema, recordPaymentSchema, rejectSchema, voidPaymentSchema } from "./schemas";

function refresh() {
  revalidatePath("/admin/payments");
  revalidatePath("/admin/billing", "layout");
  revalidatePath("/admin/dashboard");
}

export async function recordPayment(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireStaff();
  const parsed = recordPaymentSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const v = parsed.data;
  if (v.receivedOn > manilaToday()) return fail("Payment date cannot be in the future.", { receivedOn: "Choose today or an earlier date." });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_payment", {
    p_member: v.memberId,
    p_amount_centavos: v.amount,
    p_method: v.method,
    p_reference: v.reference ?? "",
    p_received_on: v.receivedOn,
    p_notes: v.notes ?? "",
    p_invoice: v.invoiceId,
  });
  if (error) return dbFail(error);
  refresh();
  return ok({ id: data as string }, "Payment recorded. A receipt is ready.");
}

export async function approveSubmission(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireStaff();
  const parsed = approveSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("approve_payment_submission", {
    p_submission: parsed.data.submissionId,
    p_note: parsed.data.note ?? "",
  });
  if (error) return dbFail(error);
  refresh();
  return ok({ id: data as string }, "Payment confirmed and posted.");
}

export async function rejectSubmission(input: unknown): Promise<ActionResult<null>> {
  await requireStaff();
  const parsed = rejectSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_payment_submission", { p_submission: parsed.data.submissionId, p_note: parsed.data.note });
  if (error) return dbFail(error);
  refresh();
  return ok(null, "Submission rejected. The boarder will see your reason.");
}

export async function voidPayment(input: unknown): Promise<ActionResult<null>> {
  await requireStaff();
  const parsed = voidPaymentSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_payment", { p_payment: parsed.data.paymentId, p_reason: parsed.data.reason });
  if (error) return dbFail(error);
  refresh();
  return ok(null, "Payment voided. The invoices it paid are open again.");
}

/**
 * Short-lived link to a payment proof. Created with the staff member's own session so storage RLS
 * decides access; the private bucket is never exposed publicly.
 */
export async function getProofUrl(input: unknown): Promise<ActionResult<{ url: string }>> {
  await requireStaff();
  const parsed = proofSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const supabase = await createClient();
  const { data: sub } = await supabase
    .from("payment_submissions")
    .select("proof_path")
    .eq("id", parsed.data.submissionId)
    .maybeSingle<{ proof_path: string }>();
  if (!sub) return fail("Submission not found.");
  const { data, error } = await supabase.storage.from("payment-proofs").createSignedUrl(sub.proof_path, 60);
  if (error || !data) return fail("Could not open the proof file.");
  return ok({ url: data.signedUrl });
}
