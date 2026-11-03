import "server-only";
import { createClient } from "@/lib/supabase/server";

type Profile = { full_name: string; email: string } | null;
type MemberEmbed = { profiles: Profile } | null;
const nameOf = (m: MemberEmbed) => m?.profiles?.full_name || m?.profiles?.email || "Boarder";

export type PendingSubmission = {
  id: string;
  memberId: string;
  boarder: string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceBalance: number;
  amount: number;
  method: string;
  reference: string;
  paidOn: string;
  submittedAt: string;
  isPdf: boolean;
};

type SubmissionRow = {
  id: string;
  member_id: string;
  invoice_id: string;
  amount_centavos: number;
  method: string;
  reference_number: string;
  paid_on: string;
  proof_path: string;
  status: "pending" | "approved" | "rejected";
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  organization_members: MemberEmbed;
  invoices: { invoice_number: string; total_centavos: number; amount_paid_centavos: number } | null;
};

const SUBMISSION_SELECT = `id, member_id, invoice_id, amount_centavos, method, reference_number, paid_on, proof_path, status,
  review_note, reviewed_at, created_at,
  organization_members(profiles(full_name, email)),
  invoices(invoice_number, total_centavos, amount_paid_centavos)`;

export async function listPendingSubmissions(): Promise<PendingSubmission[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment_submissions")
    .select(SUBMISSION_SELECT)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .returns<SubmissionRow[]>();
  if (error) throw new Error("Could not load submissions");
  return data.map((s) => ({
    id: s.id,
    memberId: s.member_id,
    boarder: nameOf(s.organization_members),
    invoiceId: s.invoice_id,
    invoiceNumber: s.invoices?.invoice_number ?? "—",
    invoiceBalance: s.invoices ? Number(s.invoices.total_centavos) - Number(s.invoices.amount_paid_centavos) : 0,
    amount: Number(s.amount_centavos),
    method: s.method,
    reference: s.reference_number,
    paidOn: s.paid_on,
    submittedAt: s.created_at,
    isPdf: s.proof_path.toLowerCase().endsWith(".pdf"),
  }));
}

export type RejectedSubmission = {
  id: string;
  boarder: string;
  invoiceNumber: string;
  amount: number;
  method: string;
  reference: string;
  reviewedAt: string | null;
  note: string | null;
};

export async function listRecentRejections(limit = 20): Promise<RejectedSubmission[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payment_submissions")
    .select(SUBMISSION_SELECT)
    .eq("status", "rejected")
    .order("reviewed_at", { ascending: false })
    .limit(limit)
    .returns<SubmissionRow[]>();
  return (data ?? []).map((s) => ({
    id: s.id,
    boarder: nameOf(s.organization_members),
    invoiceNumber: s.invoices?.invoice_number ?? "—",
    amount: Number(s.amount_centavos),
    method: s.method,
    reference: s.reference_number,
    reviewedAt: s.reviewed_at,
    note: s.review_note,
  }));
}

export type PaymentListItem = {
  id: string;
  receiptNumber: string;
  boarder: string;
  method: string;
  reference: string;
  receivedOn: string;
  amount: number;
  voided: boolean;
  voidReason: string | null;
  online: boolean;
};

type PaymentRow = {
  id: string;
  receipt_number: string;
  amount_centavos: number;
  method: string;
  reference_number: string | null;
  received_on: string;
  voided_at: string | null;
  void_reason: string | null;
  submission_id: string | null;
  organization_members: MemberEmbed;
};

export async function listPayments(limit = 500): Promise<PaymentListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .select(
      "id, receipt_number, amount_centavos, method, reference_number, received_on, voided_at, void_reason, submission_id, organization_members(profiles(full_name, email))",
    )
    .order("received_on", { ascending: false })
    .order("receipt_number", { ascending: false })
    .limit(limit)
    .returns<PaymentRow[]>();
  if (error) throw new Error("Could not load payments");
  return data.map((p) => ({
    id: p.id,
    receiptNumber: p.receipt_number,
    boarder: nameOf(p.organization_members),
    method: p.method,
    reference: p.reference_number ?? "",
    receivedOn: p.received_on,
    amount: Number(p.amount_centavos),
    voided: Boolean(p.voided_at),
    voidReason: p.void_reason,
    online: Boolean(p.submission_id),
  }));
}

export type Receipt = {
  id: string;
  receiptNumber: string;
  amount: number;
  method: string;
  reference: string | null;
  receivedOn: string;
  createdAt: string;
  notes: string | null;
  voided: boolean;
  voidReason: string | null;
  online: boolean;
  boarder: { name: string; email: string };
  orgName: string;
  property: { name: string; address: string | null } | null;
  recordedBy: string | null;
  allocations: { invoiceNumber: string; label: string; amount: number }[];
};

type ReceiptRow = {
  id: string;
  receipt_number: string;
  amount_centavos: number;
  method: string;
  reference_number: string | null;
  received_on: string;
  created_at: string;
  notes: string | null;
  voided_at: string | null;
  void_reason: string | null;
  submission_id: string | null;
  recorded_by: string | null;
  organization_id: string;
  organizations: { name: string } | null;
  organization_members: MemberEmbed;
  payment_allocations: {
    amount_centavos: number;
    invoices: { invoice_number: string; kind: string; period_month: string | null } | null;
  }[];
};

/** Loads a payment as the signed-in user. RLS returns it only to the org's staff or the boarder who paid. */
export async function getReceipt(id: string): Promise<Receipt | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .select(
      `id, receipt_number, amount_centavos, method, reference_number, received_on, created_at, notes, voided_at, void_reason,
       submission_id, recorded_by, organization_id, organizations(name),
       organization_members(profiles(full_name, email)),
       payment_allocations(amount_centavos, invoices(invoice_number, kind, period_month))`,
    )
    .eq("id", id)
    .maybeSingle<ReceiptRow>();
  if (error || !data) return null;

  const [property, recorder] = await Promise.all([
    supabase
      .from("properties")
      .select("name, address")
      .eq("organization_id", data.organization_id)
      .is("archived_at", null)
      .order("created_at")
      .limit(1)
      .maybeSingle<{ name: string; address: string | null }>(),
    data.recorded_by
      ? supabase.from("profiles").select("full_name").eq("id", data.recorded_by).maybeSingle<{ full_name: string }>()
      : Promise.resolve({ data: null }),
  ]);

  return {
    id: data.id,
    receiptNumber: data.receipt_number,
    amount: Number(data.amount_centavos),
    method: data.method,
    reference: data.reference_number,
    receivedOn: data.received_on,
    createdAt: data.created_at,
    notes: data.notes,
    voided: Boolean(data.voided_at),
    voidReason: data.void_reason,
    online: Boolean(data.submission_id),
    boarder: {
      name: data.organization_members?.profiles?.full_name || "Boarder",
      email: data.organization_members?.profiles?.email ?? "",
    },
    orgName: data.organizations?.name ?? "",
    property: property.data ?? null,
    // Boarders cannot read staff profiles; the line is simply omitted for them.
    recordedBy: recorder.data?.full_name || null,
    allocations: data.payment_allocations.map((a) => ({
      invoiceNumber: a.invoices?.invoice_number ?? "—",
      label: a.invoices?.kind === "rent" && a.invoices.period_month ? "Rent" : a.invoices?.kind === "deposit" ? "Security deposit" : "Charges",
      amount: Number(a.amount_centavos),
    })),
  };
}
