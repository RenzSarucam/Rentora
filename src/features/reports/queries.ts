import "server-only";
import { addMonths, isIsoDate, manilaToday, monthStart } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import type { OpenInvoice, PaymentRecord } from "./compute";

type Profiled = { organization_members: { profiles: { full_name: string; email: string } | null } | null };
const nameOf = (r: Profiled) => r.organization_members?.profiles?.full_name || r.organization_members?.profiles?.email || "Boarder";

type PaymentRow = Profiled & {
  id: string;
  receipt_number: string;
  received_on: string;
  amount_centavos: number;
  method: string;
  reference_number: string | null;
};

/** Confirmed (not voided) payments received between two Manila dates, inclusive. */
export async function paymentsBetween(from: string, to: string): Promise<PaymentRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .select("id, receipt_number, received_on, amount_centavos, method, reference_number, organization_members(profiles(full_name, email))")
    .is("voided_at", null)
    .gte("received_on", from)
    .lte("received_on", to)
    .order("received_on", { ascending: false })
    .order("receipt_number", { ascending: false })
    .limit(5000)
    .returns<PaymentRow[]>();
  if (error) throw new Error("Could not load payments");
  return data.map((r) => ({
    id: r.id,
    receiptNumber: r.receipt_number,
    receivedOn: r.received_on,
    amount: Number(r.amount_centavos),
    method: r.method,
    reference: r.reference_number,
    boarder: nameOf(r),
  }));
}

type InvoiceRow = Profiled & {
  id: string;
  invoice_number: string;
  member_id: string;
  due_date: string;
  total_centavos: number;
  amount_paid_centavos: number;
};

/** Every invoice still awaiting payment. */
export async function openInvoices(): Promise<OpenInvoice[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("id, invoice_number, member_id, due_date, total_centavos, amount_paid_centavos, organization_members(profiles(full_name, email))")
    .in("status", ["open", "partially_paid"])
    .order("due_date")
    .limit(5000)
    .returns<InvoiceRow[]>();
  if (error) throw new Error("Could not load invoices");
  return data.map((r) => ({
    id: r.id,
    invoiceNumber: r.invoice_number,
    memberId: r.member_id,
    boarder: nameOf(r),
    dueDate: r.due_date,
    total: Number(r.total_centavos),
    paid: Number(r.amount_paid_centavos),
  }));
}

export type ReportRange = { from: string; to: string; months: 6 | 12; currentMonth: string; today: string };

/** Reads ?from=&to=&months= with safe defaults: this month to date, 6 months of collections. */
export function readRange(params: Record<string, string | string[] | undefined>): ReportRange {
  const today = manilaToday();
  const currentMonth = monthStart(today);
  const pick = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : "");
  let from = isIsoDate(pick("from")) ? pick("from") : currentMonth;
  let to = isIsoDate(pick("to")) ? pick("to") : today;
  if (from > to) [from, to] = [to, from];
  // Keep a single query bounded.
  if (from < addMonths(monthStart(to), -36)) from = addMonths(monthStart(to), -36);
  const months = pick("months") === "12" ? 12 : 6;
  return { from, to, months, currentMonth, today };
}
