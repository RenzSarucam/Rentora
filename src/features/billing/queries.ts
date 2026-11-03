import "server-only";
import { invoiceStatus, type Tone } from "@/components/app/status-pill";
import { formatMonth, manilaToday } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

type Profile = { full_name: string; email: string } | null;
type MemberEmbed = { id: string; profiles: Profile } | null;

const nameOf = (m: MemberEmbed) => m?.profiles?.full_name || m?.profiles?.email || "Boarder";

export type InvoiceKind = "rent" | "deposit" | "other";
export type InvoiceStatus = "open" | "partially_paid" | "paid" | "void";

export type InvoiceListItem = {
  id: string;
  number: string;
  memberId: string;
  boarder: string;
  kind: InvoiceKind;
  period: string | null;
  periodLabel: string;
  issueDate: string;
  dueDate: string;
  total: number;
  paid: number;
  balance: number;
  status: InvoiceStatus;
  overdue: boolean;
  statusLabel: string;
  statusTone: Tone;
};

type InvoiceRow = {
  id: string;
  invoice_number: string;
  member_id: string;
  kind: InvoiceKind;
  period_month: string | null;
  issue_date: string;
  due_date: string;
  status: InvoiceStatus;
  total_centavos: number;
  amount_paid_centavos: number;
  organization_members: MemberEmbed;
};

const KIND_LABEL: Record<InvoiceKind, string> = { rent: "Rent", deposit: "Security deposit", other: "Other charges" };

function toListItem(row: InvoiceRow, today: string): InvoiceListItem {
  const s = invoiceStatus(row.status, row.due_date, today);
  const open = row.status === "open" || row.status === "partially_paid";
  return {
    id: row.id,
    number: row.invoice_number,
    memberId: row.member_id,
    boarder: nameOf(row.organization_members),
    kind: row.kind,
    period: row.period_month,
    periodLabel: row.kind === "rent" && row.period_month ? `Rent · ${formatMonth(row.period_month)}` : KIND_LABEL[row.kind],
    issueDate: row.issue_date,
    dueDate: row.due_date,
    total: Number(row.total_centavos),
    paid: Number(row.amount_paid_centavos),
    balance: row.status === "void" ? 0 : Number(row.total_centavos) - Number(row.amount_paid_centavos),
    status: row.status,
    overdue: open && row.due_date < today,
    statusLabel: s.label,
    statusTone: s.tone,
  };
}

const INVOICE_SELECT = `id, invoice_number, member_id, kind, period_month, issue_date, due_date, status,
  total_centavos, amount_paid_centavos, organization_members(id, profiles(full_name, email))`;

export async function listInvoices(): Promise<InvoiceListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(INVOICE_SELECT)
    .order("issue_date", { ascending: false })
    .order("invoice_number", { ascending: false })
    .limit(1000)
    .returns<InvoiceRow[]>();
  if (error) throw new Error("Could not load invoices");
  const today = manilaToday();
  return data.map((r) => toListItem(r, today));
}

/** Rent billed and collected for one period, from the invoices themselves. */
export function periodSummary(invoices: InvoiceListItem[], period: string) {
  const rent = invoices.filter((i) => i.kind === "rent" && i.period === period && i.status !== "void");
  return {
    count: rent.length,
    billed: rent.reduce((s, i) => s + i.total, 0),
    collected: rent.reduce((s, i) => s + i.paid, 0),
  };
}

export async function getOrgBilling(): Promise<{ name: string; defaultDueDay: number }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("name, default_due_day")
    .maybeSingle<{ name: string; default_due_day: number }>();
  return { name: data?.name ?? "", defaultDueDay: data?.default_due_day ?? 5 };
}

export type InvoiceDetail = InvoiceListItem & {
  notes: string | null;
  voidReason: string | null;
  items: { id: string; kind: string; description: string; amount: number }[];
  allocations: {
    id: string;
    amount: number;
    paymentId: string;
    receiptNumber: string;
    receivedOn: string;
    method: string;
    voided: boolean;
  }[];
  pendingSubmissions: { id: string; amount: number; method: string; reference: string; paidOn: string }[];
};

type DetailRow = InvoiceRow & {
  notes: string | null;
  void_reason: string | null;
  invoice_items: { id: string; kind: string; description: string; amount_centavos: number; created_at: string }[];
  payment_allocations: {
    id: string;
    amount_centavos: number;
    payments: { id: string; receipt_number: string; received_on: string; method: string; voided_at: string | null } | null;
  }[];
  payment_submissions: { id: string; amount_centavos: number; method: string; reference_number: string; paid_on: string; status: string }[];
};

export async function getInvoice(id: string): Promise<InvoiceDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(
      `${INVOICE_SELECT}, notes, void_reason,
       invoice_items(id, kind, description, amount_centavos, created_at),
       payment_allocations(id, amount_centavos, payments(id, receipt_number, received_on, method, voided_at)),
       payment_submissions(id, amount_centavos, method, reference_number, paid_on, status)`,
    )
    .eq("id", id)
    .maybeSingle<DetailRow>();
  if (error || !data) return null;
  return {
    ...toListItem(data, manilaToday()),
    notes: data.notes,
    voidReason: data.void_reason,
    items: [...data.invoice_items]
      .sort((a, b) => (a.kind === "rent" ? -1 : b.kind === "rent" ? 1 : a.created_at.localeCompare(b.created_at)))
      .map((i) => ({ id: i.id, kind: i.kind, description: i.description, amount: Number(i.amount_centavos) })),
    allocations: data.payment_allocations
      .filter((a) => a.payments)
      .map((a) => ({
        id: a.id,
        amount: Number(a.amount_centavos),
        paymentId: a.payments!.id,
        receiptNumber: a.payments!.receipt_number,
        receivedOn: a.payments!.received_on,
        method: a.payments!.method,
        voided: Boolean(a.payments!.voided_at),
      }))
      .sort((a, b) => a.receivedOn.localeCompare(b.receivedOn)),
    pendingSubmissions: data.payment_submissions
      .filter((s) => s.status === "pending")
      .map((s) => ({ id: s.id, amount: Number(s.amount_centavos), method: s.method, reference: s.reference_number, paidOn: s.paid_on })),
  };
}

export type BoarderOption = { memberId: string; name: string; outstanding: number };

/** Current boarders with their unpaid balance, for charge and payment pickers. */
export async function listBoarderOptions(): Promise<BoarderOption[]> {
  const supabase = await createClient();
  const [members, invoices] = await Promise.all([
    supabase
      .from("organization_members")
      .select("id, status, profiles(full_name, email)")
      .eq("role", "boarder")
      .neq("status", "archived")
      .returns<{ id: string; status: string; profiles: Profile }[]>(),
    supabase
      .from("invoices")
      .select("member_id, total_centavos, amount_paid_centavos")
      .in("status", ["open", "partially_paid"])
      .returns<{ member_id: string; total_centavos: number; amount_paid_centavos: number }[]>(),
  ]);
  const owed = new Map<string, number>();
  for (const i of invoices.data ?? []) {
    owed.set(i.member_id, (owed.get(i.member_id) ?? 0) + Number(i.total_centavos) - Number(i.amount_paid_centavos));
  }
  return (members.data ?? [])
    .map((m) => ({ memberId: m.id, name: m.profiles?.full_name || m.profiles?.email || "Boarder", outstanding: owed.get(m.id) ?? 0 }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Boarders who would receive a rent invoice today (current bed, rent above zero). */
export async function countBillableAssignments(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("boarder_assignments")
    .select("id", { count: "exact", head: true })
    .is("move_out_date", null)
    .gt("monthly_rent_centavos", 0);
  return count ?? 0;
}
