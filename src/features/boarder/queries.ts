import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Viewer } from "@/lib/auth/session";
import { getAnnouncementInbox, type BoarderAnnouncement } from "@/features/announcements/boarder-inbox";

// Every query filters by the viewer's own member id. RLS enforces the same rule underneath.

export type InvoiceRow = {
  id: string;
  invoice_number: string;
  kind: "rent" | "deposit" | "other";
  period_month: string | null;
  issue_date: string;
  due_date: string;
  status: "open" | "partially_paid" | "paid" | "void";
  total_centavos: number;
  amount_paid_centavos: number;
  created_at: string;
};

const INVOICE_COLS = "id, invoice_number, kind, period_month, issue_date, due_date, status, total_centavos, amount_paid_centavos, created_at";

export { balanceOf, invoiceTitle, isPayable } from "./queries.shared";

export async function listInvoices(viewer: Viewer): Promise<InvoiceRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("invoices")
    .select(INVOICE_COLS)
    .eq("member_id", viewer.memberId)
    .order("due_date", { ascending: false })
    .order("invoice_number", { ascending: false })
    .returns<InvoiceRow[]>();
  return data ?? [];
}

export type InvoiceDetail = InvoiceRow & {
  notes: string | null;
  invoice_items: { id: string; kind: string; description: string; amount_centavos: number; created_at: string }[];
  payment_allocations: {
    id: string;
    amount_centavos: number;
    payments: { id: string; receipt_number: string; method: string; received_on: string; voided_at: string | null } | null;
  }[];
};

export async function getInvoice(viewer: Viewer, id: string): Promise<InvoiceDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("invoices")
    .select(
      `${INVOICE_COLS}, notes,
       invoice_items(id, kind, description, amount_centavos, created_at),
       payment_allocations(id, amount_centavos, payments(id, receipt_number, method, received_on, voided_at))`,
    )
    .eq("id", id)
    .eq("member_id", viewer.memberId)
    .maybeSingle<InvoiceDetail>();
  return data ?? null;
}

export type SubmissionRow = {
  id: string;
  invoice_id: string;
  amount_centavos: number;
  method: "gcash" | "maya" | "bank_transfer" | "other";
  reference_number: string;
  paid_on: string;
  status: "pending" | "approved" | "rejected";
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  invoices: { invoice_number: string } | null;
};

export async function listSubmissions(viewer: Viewer, limit = 50): Promise<SubmissionRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payment_submissions")
    .select("id, invoice_id, amount_centavos, method, reference_number, paid_on, status, review_note, reviewed_at, created_at, invoices(invoice_number)")
    .eq("member_id", viewer.memberId)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<SubmissionRow[]>();
  return data ?? [];
}

export type PaymentRow = {
  id: string;
  amount_centavos: number;
  method: "cash" | "gcash" | "maya" | "bank_transfer" | "other";
  reference_number: string | null;
  received_on: string;
  receipt_number: string;
  voided_at: string | null;
  created_at: string;
};

export async function listPayments(viewer: Viewer): Promise<PaymentRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("id, amount_centavos, method, reference_number, received_on, receipt_number, voided_at, created_at")
    .eq("member_id", viewer.memberId)
    .order("received_on", { ascending: false })
    .order("created_at", { ascending: false })
    .returns<PaymentRow[]>();
  return data ?? [];
}

export type AssignmentRow = {
  id: string;
  move_in_date: string;
  move_out_date: string | null;
  monthly_rent_centavos: number;
  end_reason: string | null;
  beds: {
    id: string;
    label: string;
    rooms: { id: string; code: string; floor: string | null; notes: string | null; capacity: number; properties: { name: string; address: string | null } | null } | null;
  } | null;
};

export async function listAssignments(viewer: Viewer): Promise<AssignmentRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("boarder_assignments")
    .select(
      "id, move_in_date, move_out_date, monthly_rent_centavos, end_reason, beds(id, label, rooms(id, code, floor, notes, capacity, properties(name, address)))",
    )
    .eq("member_id", viewer.memberId)
    .order("move_in_date", { ascending: false })
    .returns<AssignmentRow[]>();
  return data ?? [];
}

export type RequestRow = {
  id: string;
  title: string;
  description: string;
  priority: "low" | "normal" | "urgent";
  status: "open" | "in_progress" | "resolved" | "cancelled";
  photo_path: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  rooms: { code: string } | null;
};

const REQUEST_COLS = "id, title, description, priority, status, photo_path, created_at, updated_at, resolved_at, rooms(code)";

export async function listRequests(viewer: Viewer): Promise<RequestRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("maintenance_requests")
    .select(REQUEST_COLS)
    .eq("member_id", viewer.memberId)
    .order("created_at", { ascending: false })
    .returns<RequestRow[]>();
  return data ?? [];
}

export type UpdateRow = { id: string; body: string; status_to: RequestRow["status"] | null; author_id: string | null; created_at: string };

export async function getRequest(viewer: Viewer, id: string): Promise<{ request: RequestRow; updates: UpdateRow[]; photoUrl: string | null } | null> {
  const supabase = await createClient();
  const { data: request } = await supabase
    .from("maintenance_requests")
    .select(REQUEST_COLS)
    .eq("id", id)
    .eq("member_id", viewer.memberId)
    .maybeSingle<RequestRow>();
  if (!request) return null;
  const [{ data: updates }, signed] = await Promise.all([
    supabase
      .from("maintenance_updates")
      .select("id, body, status_to, author_id, created_at")
      .eq("request_id", id)
      .order("created_at")
      .returns<UpdateRow[]>(),
    request.photo_path
      ? supabase.storage.from("maintenance-photos").createSignedUrl(request.photo_path, 60)
      : Promise.resolve({ data: null }),
  ]);
  return { request, updates: updates ?? [], photoUrl: signed.data?.signedUrl ?? null };
}

export type AnnouncementRow = BoarderAnnouncement;

export async function listAnnouncements(limit = 50): Promise<AnnouncementRow[]> {
  const { announcements } = await getAnnouncementInbox();
  return announcements.slice(0, limit);
}

export type ProfileRow = {
  full_name: string;
  email: string;
  phone: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
};

export async function getProfile(viewer: Viewer): Promise<ProfileRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("full_name, email, phone, emergency_contact_name, emergency_contact_phone")
    .eq("id", viewer.userId)
    .maybeSingle<ProfileRow>();
  return data ?? null;
}

export type Notice = { id: string; at: string; title: string; detail?: string; href: string; tone: "positive" | "negative" | "neutral" | "accent" };

/** Latest events that concern the boarder: reviewed payments, maintenance status changes, new invoices. */
export async function recentNotices(viewer: Viewer, limit = 5): Promise<Notice[]> {
  const supabase = await createClient();
  const [subs, invoices, updates] = await Promise.all([
    supabase
      .from("payment_submissions")
      .select("id, amount_centavos, status, review_note, reviewed_at")
      .eq("member_id", viewer.memberId)
      .neq("status", "pending")
      .order("reviewed_at", { ascending: false })
      .limit(limit)
      .returns<{ id: string; amount_centavos: number; status: string; review_note: string | null; reviewed_at: string }[]>(),
    supabase
      .from("invoices")
      .select("id, kind, period_month, total_centavos, created_at, status")
      .eq("member_id", viewer.memberId)
      .neq("status", "void")
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<{ id: string; kind: InvoiceRow["kind"]; period_month: string | null; total_centavos: number; created_at: string }[]>(),
    supabase
      .from("maintenance_updates")
      .select("id, request_id, status_to, body, created_at, maintenance_requests!inner(title, member_id)")
      .eq("maintenance_requests.member_id", viewer.memberId)
      .not("status_to", "is", null)
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<{ id: string; request_id: string; status_to: string; body: string; created_at: string; maintenance_requests: { title: string } | null }[]>(),
  ]);

  const peso = (c: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(c / 100);
  const month = (d: string) => new Intl.DateTimeFormat("en-PH", { timeZone: "UTC", month: "long" }).format(new Date(`${d}T00:00:00Z`));
  const notices: Notice[] = [
    ...(subs.data ?? []).map<Notice>((s) => ({
      id: `s-${s.id}`,
      at: s.reviewed_at,
      title: s.status === "approved" ? `Payment of ${peso(s.amount_centavos)} confirmed` : `Payment of ${peso(s.amount_centavos)} was not accepted`,
      detail: s.review_note ?? undefined,
      href: "/boarder/payment-history",
      tone: s.status === "approved" ? "positive" : "negative",
    })),
    ...(invoices.data ?? []).map<Notice>((i) => ({
      id: `i-${i.id}`,
      at: i.created_at,
      title:
        i.kind === "rent" && i.period_month
          ? `New bill: ${month(i.period_month)} rent, ${peso(i.total_centavos)}`
          : `New bill: ${i.kind === "deposit" ? "security deposit" : "charges"}, ${peso(i.total_centavos)}`,
      href: `/boarder/bills/${i.id}`,
      tone: "neutral",
    })),
    ...(updates.data ?? []).map<Notice>((u) => ({
      id: `m-${u.id}`,
      at: u.created_at,
      title: `${u.maintenance_requests?.title ?? "Repair request"}: ${u.status_to.replace("_", " ")}`,
      detail: u.body,
      href: `/boarder/maintenance/${u.request_id}`,
      tone: u.status_to === "resolved" ? "positive" : "accent",
    })),
  ];
  return notices.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}
