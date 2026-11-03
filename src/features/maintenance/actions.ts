"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/session";
import { dbFail, ok, validationFail, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { commentSchema, statusChangeSchema } from "./schemas";

function refresh(id: string) {
  revalidatePath("/admin/maintenance");
  revalidatePath(`/admin/maintenance/${id}`);
  revalidatePath("/admin/dashboard");
}

export async function changeMaintenanceStatus(input: unknown): Promise<ActionResult<null>> {
  await requireStaff();
  const parsed = statusChangeSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_maintenance_status", {
    p_request: v.requestId,
    p_status: v.status,
    p_note: v.note ?? "",
  });
  if (error) return dbFail(error);
  refresh(v.requestId);
  return ok(null, "Status updated. The boarder sees it on their request.");
}

export async function addMaintenanceComment(input: unknown): Promise<ActionResult<null>> {
  await requireStaff();
  const parsed = commentSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase
    .from("maintenance_updates")
    .insert({ request_id: parsed.data.requestId, body: parsed.data.body });
  if (error) return dbFail(error);
  refresh(parsed.data.requestId);
  return ok(null, "Update posted.");
}
