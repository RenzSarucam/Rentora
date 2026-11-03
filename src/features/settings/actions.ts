"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/session";
import { dbFail, fail, ok, validationFail, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { uuid } from "@/lib/validation";
import { orgSchema, propertySchema } from "./schemas";

export async function updateOrganization(input: unknown): Promise<ActionResult<null>> {
  const viewer = await requireStaff();
  const parsed = orgSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ name: parsed.data.name, default_due_day: parsed.data.defaultDueDay })
    .eq("id", viewer.orgId);
  if (error) return dbFail(error);
  revalidatePath("/admin", "layout");
  return ok(null, "Settings saved.");
}

export async function saveProperty(input: unknown): Promise<ActionResult<null>> {
  const viewer = await requireStaff();
  const parsed = propertySchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const { id, name, address } = parsed.data;
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("properties").update({ name, address }).eq("id", id)
    : await supabase.from("properties").insert({ organization_id: viewer.orgId, name, address });
  if (error) return dbFail(error);
  revalidatePath("/admin/settings");
  revalidatePath("/admin/rooms");
  return ok(null, id ? "Property saved." : `${name} added. You can now add rooms to it.`);
}

export async function archiveProperty(input: unknown): Promise<ActionResult<null>> {
  await requireStaff();
  const parsed = z.object({ id: uuid }).safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const supabase = await createClient();
  const { count } = await supabase
    .from("rooms")
    .select("id", { count: "exact", head: true })
    .eq("property_id", parsed.data.id)
    .is("archived_at", null);
  if ((count ?? 0) > 0) return fail("Archive this property's rooms first.");
  const { count: remaining } = await supabase.from("properties").select("id", { count: "exact", head: true }).is("archived_at", null);
  if ((remaining ?? 0) <= 1) return fail("Keep at least one property.");
  const { error } = await supabase.from("properties").update({ archived_at: new Date().toISOString() }).eq("id", parsed.data.id);
  if (error) return dbFail(error);
  revalidatePath("/admin/settings");
  revalidatePath("/admin/rooms");
  return ok(null, "Property archived.");
}
