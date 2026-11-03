"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/session";
import { formatMonth } from "@/lib/dates";
import { dbFail, ok, validationFail, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { addItemSchema, dueDateSchema, generateSchema, newChargeSchema, removeItemSchema, signedAmount, voidInvoiceSchema } from "./schemas";

function refresh(invoiceId?: string) {
  revalidatePath("/admin/billing");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/payments");
  if (invoiceId) revalidatePath(`/admin/billing/${invoiceId}`);
}

export async function generateInvoices(input: unknown): Promise<ActionResult<{ created: number }>> {
  const viewer = await requireStaff();
  const parsed = generateSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const { month, dueDate } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_monthly_invoices", { p_org: viewer.orgId, p_period: month, p_due: dueDate });
  if (error) return dbFail(error);
  const created = Number(data ?? 0);
  refresh();
  const label = formatMonth(month);
  return ok(
    { created },
    created === 0
      ? `No new invoices: everyone with a bed already has one for ${label}.`
      : `${created} rent invoice${created === 1 ? "" : "s"} created for ${label}.`,
  );
}

export async function createCharge(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireStaff();
  const parsed = newChargeSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const v = parsed.data;
  const items = v.items.map((i) => ({
    kind: i.kind,
    description: i.description,
    amount_centavos: signedAmount(i.kind, i.amount),
  }));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_invoice", {
    p_member: v.memberId,
    p_kind: v.kind,
    p_due: v.dueDate,
    p_items: items,
    p_notes: v.notes ?? "",
  });
  if (error) return dbFail(error);
  refresh();
  return ok({ id: data as string }, "Charge created.");
}

export async function addInvoiceItem(input: unknown): Promise<ActionResult<null>> {
  await requireStaff();
  const parsed = addItemSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_invoice_item", {
    p_invoice: v.invoiceId,
    p_kind: v.kind,
    p_description: v.description,
    p_amount_centavos: signedAmount(v.kind, v.amount),
  });
  if (error) return dbFail(error);
  refresh(v.invoiceId);
  return ok(null, v.kind === "discount" ? "Discount added." : "Line added.");
}

export async function removeInvoiceItem(input: unknown): Promise<ActionResult<null>> {
  await requireStaff();
  const parsed = removeItemSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_invoice_item", { p_item: parsed.data.itemId });
  if (error) return dbFail(error);
  refresh(parsed.data.invoiceId);
  return ok(null, "Line removed.");
}

export async function updateDueDate(input: unknown): Promise<ActionResult<null>> {
  await requireStaff();
  const parsed = dueDateSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .update({ due_date: parsed.data.dueDate })
    .eq("id", parsed.data.invoiceId)
    .in("status", ["open", "partially_paid"])
    .select("id");
  if (error) return dbFail(error);
  if (!data?.length) return { ok: false, error: "Only unpaid invoices can have their due date changed." };
  refresh(parsed.data.invoiceId);
  return ok(null, "Due date updated.");
}

export async function voidInvoice(input: unknown): Promise<ActionResult<null>> {
  await requireStaff();
  const parsed = voidInvoiceSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_invoice", { p_invoice: parsed.data.invoiceId, p_reason: parsed.data.reason });
  if (error) return dbFail(error);
  refresh(parsed.data.invoiceId);
  return ok(null, "Invoice voided.");
}
