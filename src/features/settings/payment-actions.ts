"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireBoarder, requireStaff } from "@/lib/auth/session";
import { dbFail, fail, ok, validationFail, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkUpload, storagePath } from "@/lib/uploads";
import { formToObject } from "@/lib/validation";
import { receivingAccountSchema } from "./schemas";

async function cleanupUnreferencedQR(supabase: Awaited<ReturnType<typeof createClient>>, path: string) {
  const { count, error } = await supabase.from("payment_receiving_accounts").select("id", { count: "exact", head: true }).eq("qr_path", path);
  if (error || count !== 0) return;
  try {
    const result = await createAdminClient().storage.from("payment-qrs").remove([path]);
    if (result.error) console.error("receiving QR orphan cleanup failed", result.error.statusCode ?? "unknown");
  } catch { console.error("receiving QR orphan cleanup interrupted"); }
}

export async function saveReceivingAccount(form: FormData): Promise<ActionResult<null>> {
  const viewer = await requireStaff();
  if (viewer.role !== "owner") return fail("Only the owner can change payment receiving details.");
  const parsed = receivingAccountSchema.safeParse(formToObject(form));
  if (!parsed.success) return validationFail(parsed.error);
  const supabase = await createClient();
  const v = parsed.data;
  const current = await supabase.from("payment_receiving_accounts").select("id,qr_path")
    .eq("organization_id", viewer.orgId).eq("method", v.method).maybeSingle<{ id: string; qr_path: string }>();
  if (current.error) return dbFail(current.error);
  let path = current.data?.qr_path;
  let uploaded: string | null = null;
  const file = form.get("qr");
  if (file instanceof Blob && file.size > 0) {
    const check = await checkUpload(file, ["image/jpeg", "image/png"]);
    if (!check.ok) return fail(check.error, { qr: check.error });
    path = storagePath(viewer.orgId, viewer.memberId, check.type.ext);
    // Preserve the original QR bytes. No image resizing or regeneration.
    const upload = await supabase.storage.from("payment-qrs").upload(path, check.bytes, { contentType: check.type.mime, upsert: false });
    if (upload.error) return fail("Could not upload the QR image. Try again.");
    uploaded = path;
  }
  if (!path) return fail("Choose the original QR image.", { qr: "Upload a JPG or PNG QR image." });
  const values = { account_name: v.accountName, institution_name: v.method === "gcash" ? "GCash" : v.institutionName,
    account_number: v.accountNumber, qr_path: path };
  const saved = current.data
    ? await supabase.from("payment_receiving_accounts").update(values).eq("id", current.data.id).select("id").single()
    : await supabase.from("payment_receiving_accounts").insert({ ...values, organization_id: viewer.orgId, method: v.method }).select("id").single();
  if (saved.error) {
    if (uploaded) await cleanupUnreferencedQR(supabase, uploaded);
    return dbFail(saved.error);
  }
  if (uploaded && current.data?.qr_path && current.data.qr_path !== uploaded) await cleanupUnreferencedQR(supabase, current.data.qr_path);
  revalidatePath("/admin/settings");
  revalidatePath("/boarder/bills", "layout");
  return ok(null, "Receiving details and QR saved. Boarders can now use them on their bills.");
}

const qrSchema = z.object({ method: z.enum(["gcash", "bank_transfer"]), download: z.boolean().default(false) });
export async function getBoarderPaymentQR(input: unknown): Promise<ActionResult<{ url: string }>> {
  const viewer = await requireBoarder();
  const parsed = qrSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  if (viewer.status === "archived") return fail("Your stay has ended. Contact your landlord about payment.");
  const supabase = await createClient();
  const { data, error } = await supabase.from("payment_receiving_accounts").select("qr_path")
    .eq("organization_id", viewer.orgId).eq("method", parsed.data.method).maybeSingle<{ qr_path: string }>();
  if (error) return dbFail(error);
  if (!data) return fail("Your landlord has not added this receiving QR yet.");
  const extension = data.qr_path.endsWith(".png") ? "png" : "jpg";
  const signed = await supabase.storage.from("payment-qrs").createSignedUrl(data.qr_path, 60,
    parsed.data.download ? { download: `${parsed.data.method === "gcash" ? "gcash" : "bank"}-receiving-qr.${extension}` } : undefined);
  if (signed.error || !signed.data) return fail("Could not open the QR image. Try again.");
  return ok({ url: signed.data.signedUrl });
}
