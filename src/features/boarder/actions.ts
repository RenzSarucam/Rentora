"use server";

import { revalidatePath } from "next/cache";
import { requireBoarder } from "@/lib/auth/session";
import { dbFail, fail, ok, validationFail, type ActionResult } from "@/lib/errors";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { checkUpload, storagePath, type DetectedType } from "@/lib/uploads";
import { formToObject } from "@/lib/validation";
import { commentSchema, maintenanceSchema, paymentProofSchema, profileSchema } from "./schemas";

const ARCHIVED = "Your stay has ended, so this can no longer be changed. Contact your landlord.";

/** Removes a just-uploaded file whose database row could not be created. Exact path only. */
async function removeOrphan(bucket: string, path: string) {
  try {
    await createAdminClient().storage.from(bucket).remove([path]);
  } catch {
    console.error("orphan upload cleanup failed");
  }
}

async function upload(bucket: string, orgId: string, memberId: string, file: unknown, allowed: DetectedType["mime"][]) {
  const check = await checkUpload(file, allowed);
  if (!check.ok) return { error: check.error } as const;
  const path = storagePath(orgId, memberId, check.type.ext);
  const supabase = await createClient();
  const { error } = await supabase.storage.from(bucket).upload(path, check.bytes, { contentType: check.type.mime, upsert: false });
  if (error) return { error: "Upload failed. Please try again." } as const;
  return { path } as const;
}

export async function submitPaymentProof(form: FormData): Promise<ActionResult<{ id: string }>> {
  const viewer = await requireBoarder();
  if (viewer.status === "archived") return fail(ARCHIVED);
  const parsed = paymentProofSchema.safeParse(formToObject(form));
  if (!parsed.success) return validationFail(parsed.error);
  if (!(await rateLimit(LIMITS.paymentSubmission, viewer.userId))) {
    return fail("Too many submissions in the last hour. Please wait and try again.");
  }

  const uploaded = await upload("payment-proofs", viewer.orgId, viewer.memberId, form.get("proof"), [
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
  ]);
  if ("error" in uploaded) return fail(uploaded.error ?? "Upload failed.", { proof: uploaded.error ?? "Upload failed." });

  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_payment", {
    p_invoice: v.invoiceId,
    p_amount_centavos: v.amount,
    p_method: v.method,
    p_reference: v.reference,
    p_paid_on: v.paidOn,
    p_proof_path: uploaded.path,
  });
  if (error) {
    await removeOrphan("payment-proofs", uploaded.path);
    return dbFail(error);
  }
  revalidatePath("/boarder/home");
  revalidatePath("/boarder/bills");
  revalidatePath(`/boarder/bills/${v.invoiceId}`);
  revalidatePath("/boarder/payment-history");
  return ok({ id: data as string }, "Payment sent for review. We'll let you know once it is confirmed.");
}

export async function createMaintenanceRequest(form: FormData): Promise<ActionResult<{ id: string }>> {
  const viewer = await requireBoarder();
  if (viewer.status === "archived") return fail(ARCHIVED);
  const parsed = maintenanceSchema.safeParse(formToObject(form));
  if (!parsed.success) return validationFail(parsed.error);
  if (!(await rateLimit(LIMITS.maintenance, viewer.userId))) {
    return fail("Too many requests in the last hour. Please wait and try again.");
  }

  let photoPath: string | null = null;
  const photo = form.get("photo");
  if (photo instanceof Blob && photo.size > 0) {
    const uploaded = await upload("maintenance-photos", viewer.orgId, viewer.memberId, photo, ["image/jpeg", "image/png", "image/webp"]);
    if ("error" in uploaded) return fail(uploaded.error ?? "Upload failed.", { photo: uploaded.error ?? "Upload failed." });
    photoPath = uploaded.path;
  }

  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("maintenance_requests")
    .insert({ member_id: viewer.memberId, title: v.title, description: v.description, priority: v.priority, photo_path: photoPath })
    .select("id")
    .single<{ id: string }>();
  if (error) {
    if (photoPath) await removeOrphan("maintenance-photos", photoPath);
    return dbFail(error);
  }
  revalidatePath("/boarder/maintenance");
  revalidatePath("/boarder/home");
  return ok({ id: data.id }, "Request sent. You can follow its progress here.");
}

export async function addMaintenanceComment(input: unknown): Promise<ActionResult<null>> {
  const viewer = await requireBoarder();
  if (viewer.status === "archived") return fail(ARCHIVED);
  const parsed = commentSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("maintenance_updates").insert({ request_id: parsed.data.requestId, body: parsed.data.body });
  if (error) return dbFail(error);
  revalidatePath(`/boarder/maintenance/${parsed.data.requestId}`);
  return ok(null, "Message added.");
}

export async function updateMyProfile(input: unknown): Promise<ActionResult<null>> {
  const viewer = await requireBoarder();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: v.fullName, phone: v.phone, emergency_contact_name: v.emergencyName, emergency_contact_phone: v.emergencyPhone })
    .eq("id", viewer.userId);
  if (error) return dbFail(error);
  revalidatePath("/boarder/profile");
  revalidatePath("/boarder/home");
  return ok(null, "Profile saved.");
}
