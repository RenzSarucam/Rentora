"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/session";
import { dbFail, ok, validationFail, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { uuid } from "@/lib/validation";
import { bedSchema, bedUpdateSchema, roomSchema, roomUpdateSchema } from "./schemas";

function refresh(roomId?: string) {
  revalidatePath("/admin/rooms");
  revalidatePath("/admin/dashboard");
  if (roomId) revalidatePath(`/admin/rooms/${roomId}`);
}

export async function createRoom(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireStaff();
  const parsed = roomSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_room", {
    p_property: v.propertyId,
    p_code: v.code,
    p_floor: v.floor ?? "",
    p_capacity: v.capacity,
    p_rate_centavos: v.rate,
    p_notes: v.notes ?? "",
  });
  if (error) return dbFail(error);
  refresh();
  return ok({ id: data as string }, `Room ${v.code} added with ${v.capacity} bed${v.capacity === 1 ? "" : "s"}.`);
}

export async function updateRoom(input: unknown): Promise<ActionResult<null>> {
  await requireStaff();
  const parsed = roomUpdateSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("rooms")
    .update({ code: v.code, floor: v.floor, capacity: v.capacity, monthly_rate_centavos: v.rate, notes: v.notes })
    .eq("id", v.id);
  if (error) return dbFail(error);
  refresh(v.id);
  return ok(null, "Room saved.");
}

const statusSchema = z.object({ id: uuid, status: z.enum(["active", "maintenance"]) });

export async function setRoomStatus(input: unknown): Promise<ActionResult<null>> {
  await requireStaff();
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("rooms").update({ status: parsed.data.status }).eq("id", parsed.data.id);
  if (error) return dbFail(error);
  refresh(parsed.data.id);
  return ok(null, parsed.data.status === "maintenance" ? "Room marked under maintenance." : "Room is available again.");
}

export async function archiveRoom(input: unknown): Promise<ActionResult<null>> {
  await requireStaff();
  const parsed = z.object({ id: uuid }).safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("rooms").update({ archived_at: new Date().toISOString() }).eq("id", parsed.data.id);
  if (error) return dbFail(error);
  refresh();
  return ok(null, "Room archived.");
}

export async function addBed(input: unknown): Promise<ActionResult<null>> {
  const viewer = await requireStaff();
  const parsed = bedSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("beds")
    .insert({ organization_id: viewer.orgId, room_id: v.roomId, label: v.label, monthly_rate_centavos: v.rate });
  if (error) return dbFail(error);
  refresh(v.roomId);
  return ok(null, `${v.label} added.`);
}

export async function updateBed(input: unknown): Promise<ActionResult<null>> {
  await requireStaff();
  const parsed = bedUpdateSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("beds")
    .update({ label: v.label, monthly_rate_centavos: v.rate })
    .eq("id", v.id)
    .select("room_id")
    .single<{ room_id: string }>();
  if (error) return dbFail(error);
  refresh(data.room_id);
  return ok(null, "Bed saved.");
}

export async function setBedStatus(input: unknown): Promise<ActionResult<null>> {
  await requireStaff();
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("beds")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id)
    .select("room_id")
    .single<{ room_id: string }>();
  if (error) return dbFail(error);
  refresh(data.room_id);
  return ok(null, parsed.data.status === "maintenance" ? "Bed marked under maintenance." : "Bed is available again.");
}

export async function archiveBed(input: unknown): Promise<ActionResult<null>> {
  await requireStaff();
  const parsed = z.object({ id: uuid }).safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("beds")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .select("room_id")
    .single<{ room_id: string }>();
  if (error) return dbFail(error);
  refresh(data.room_id);
  return ok(null, "Bed removed.");
}
