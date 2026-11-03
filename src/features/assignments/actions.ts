"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/session";
import { dbFail, fail, ok, validationFail, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { assignSchema, endSchema, rentSchema, transferSchema } from "./schemas";

function refresh(memberId?: string) {
  revalidatePath("/admin/assignments");
  revalidatePath("/admin/rooms", "layout");
  revalidatePath("/admin/boarders");
  revalidatePath("/admin/dashboard");
  if (memberId) revalidatePath(`/admin/boarders/${memberId}`);
}

export async function assignBed(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireStaff();
  const parsed = assignSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("assign_bed", {
    p_member: v.memberId,
    p_bed: v.bedId,
    p_move_in: v.moveIn,
    p_rent_centavos: v.rent,
  });
  if (error) return dbFail(error);
  refresh(v.memberId);
  return ok({ id: data as string }, "Bed assigned.");
}

export async function transferBed(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireStaff();
  const parsed = transferSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("transfer_bed", {
    p_member: v.memberId,
    p_new_bed: v.bedId,
    p_date: v.date,
    p_rent_centavos: v.rent,
  });
  if (error) return dbFail(error);
  refresh(v.memberId);
  return ok({ id: data as string }, "Boarder moved to the new bed.");
}

export async function endAssignment(input: unknown): Promise<ActionResult<null>> {
  await requireStaff();
  const parsed = endSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("boarder_assignments")
    .select("member_id, move_in_date")
    .eq("id", v.assignmentId)
    .maybeSingle<{ member_id: string; move_in_date: string }>();
  if (!row) return fail("Assignment not found.");
  if (v.moveOut < row.move_in_date) return fail("Move-out cannot be before the move-in date.", { moveOut: "Pick a date on or after move-in." });
  const { error } = await supabase.rpc("end_assignment", { p_assignment: v.assignmentId, p_move_out: v.moveOut, p_reason: v.reason ?? "" });
  if (error) return dbFail(error);
  refresh(row.member_id);
  return ok(null, "Move-out recorded. The bed is free.");
}

export async function changeRent(input: unknown): Promise<ActionResult<null>> {
  await requireStaff();
  const parsed = rentSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("boarder_assignments")
    .update({ monthly_rent_centavos: parsed.data.rent })
    .eq("id", parsed.data.assignmentId)
    .is("move_out_date", null)
    .select("member_id")
    .maybeSingle<{ member_id: string }>();
  if (error) return dbFail(error);
  if (!data) return fail("Only a current assignment's rent can be changed.");
  refresh(data.member_id);
  return ok(null, "Rent updated. Invoices already issued keep their amounts.");
}
