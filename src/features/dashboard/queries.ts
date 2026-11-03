import "server-only";
import { addMonths, manilaToday, monthStart } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

type InvoiceRow = {
  id: string;
  member_id: string;
  status: "open" | "partially_paid" | "paid" | "void";
  due_date: string;
  period_month: string | null;
  issue_date: string;
  total_centavos: number;
  amount_paid_centavos: number;
};
type PaymentRow = { amount_centavos: number; received_on: string };
type SubmissionRow = {
  id: string;
  amount_centavos: number;
  method: string;
  created_at: string;
  organization_members: { profiles: { full_name: string } | null } | null;
};
type RequestRow = {
  id: string;
  title: string;
  priority: "low" | "normal" | "urgent";
  status: string;
  created_at: string;
  rooms: { code: string } | null;
};
type AuditRow = { id: number; action: string; entity_type: string; created_at: string; actor_id: string | null };

export type MonthCollection = { month: string; collected: number };

export type DashboardData = {
  today: string;
  thisMonth: string;
  activeBoarders: number;
  invitedBoarders: number;
  billedThisMonth: number;
  collectedForThisMonth: number;
  collectedThisMonth: number;
  outstanding: number;
  overdue: { count: number; amount: number; boarders: number };
  thisMonthInvoiced: boolean;
  collections: MonthCollection[];
  pending: { id: string; name: string; amount: number; method: string; createdAt: string }[];
  pendingCount: number;
  requests: { id: string; title: string; room: string | null; urgent: boolean; status: string; createdAt: string }[];
  openRequestCount: number;
  activity: { id: number; action: string; createdAt: string; actor: string }[];
};

/** Everything on the dashboard, computed from rows the caller can see (RLS: their organization only). */
export async function getDashboard(): Promise<DashboardData> {
  const supabase = await createClient();
  const today = manilaToday();
  const thisMonth = monthStart(today);
  const sixMonthsAgo = addMonths(thisMonth, -5);

  const [members, invoices, payments, pending, requests, audit] = await Promise.all([
    supabase.from("organization_members").select("status").eq("role", "boarder").returns<{ status: string }[]>(),
    supabase
      .from("invoices")
      .select("id, member_id, status, due_date, period_month, issue_date, total_centavos, amount_paid_centavos")
      .neq("status", "void")
      .returns<InvoiceRow[]>(),
    supabase
      .from("payments")
      .select("amount_centavos, received_on")
      .is("voided_at", null)
      .gte("received_on", sixMonthsAgo)
      .returns<PaymentRow[]>(),
    supabase
      .from("payment_submissions")
      .select("id, amount_centavos, method, created_at, organization_members(profiles(full_name))", { count: "exact" })
      .eq("status", "pending")
      .order("created_at")
      .limit(5)
      .returns<SubmissionRow[]>(),
    supabase
      .from("maintenance_requests")
      .select("id, title, priority, status, created_at, rooms(code)", { count: "exact" })
      .in("status", ["open", "in_progress"])
      .order("priority", { ascending: false })
      .order("created_at")
      .limit(5)
      .returns<RequestRow[]>(),
    supabase.from("audit_logs").select("id, action, entity_type, created_at, actor_id").order("created_at", { ascending: false }).limit(8).returns<AuditRow[]>(),
  ]);

  const allInvoices = invoices.data ?? [];
  const unpaid = allInvoices.filter((i) => i.status === "open" || i.status === "partially_paid");
  const overdueRows = unpaid.filter((i) => i.due_date < today);
  const thisPeriod = allInvoices.filter((i) => i.period_month === thisMonth);

  const collections: MonthCollection[] = Array.from({ length: 6 }, (_, i) => {
    const month = addMonths(sixMonthsAgo, i);
    const next = addMonths(month, 1);
    const collected = (payments.data ?? []).filter((p) => p.received_on >= month && p.received_on < next).reduce((s, p) => s + p.amount_centavos, 0);
    return { month, collected };
  });

  const actorIds = [...new Set((audit.data ?? []).map((a) => a.actor_id).filter((x): x is string => Boolean(x)))];
  const actors = actorIds.length
    ? ((await supabase.from("profiles").select("id, full_name").in("id", actorIds).returns<{ id: string; full_name: string }[]>()).data ?? [])
    : [];
  const actorName = new Map(actors.map((a) => [a.id, a.full_name]));

  return {
    today,
    thisMonth,
    activeBoarders: (members.data ?? []).filter((m) => m.status === "active").length,
    invitedBoarders: (members.data ?? []).filter((m) => m.status === "invited").length,
    billedThisMonth: thisPeriod.reduce((s, i) => s + i.total_centavos, 0),
    collectedForThisMonth: thisPeriod.reduce((s, i) => s + i.amount_paid_centavos, 0),
    collectedThisMonth: collections[collections.length - 1].collected,
    outstanding: unpaid.reduce((s, i) => s + i.total_centavos - i.amount_paid_centavos, 0),
    overdue: {
      count: overdueRows.length,
      amount: overdueRows.reduce((s, i) => s + i.total_centavos - i.amount_paid_centavos, 0),
      boarders: new Set(overdueRows.map((i) => i.member_id)).size,
    },
    thisMonthInvoiced: thisPeriod.length > 0,
    collections,
    pending: (pending.data ?? []).map((p) => ({
      id: p.id,
      name: p.organization_members?.profiles?.full_name || "Boarder",
      amount: p.amount_centavos,
      method: p.method,
      createdAt: p.created_at,
    })),
    pendingCount: pending.count ?? 0,
    requests: (requests.data ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      room: r.rooms?.code ?? null,
      urgent: r.priority === "urgent",
      status: r.status,
      createdAt: r.created_at,
    })),
    openRequestCount: requests.count ?? 0,
    activity: (audit.data ?? []).map((a) => ({
      id: a.id,
      action: describeAction(a.action, a.entity_type),
      createdAt: a.created_at,
      actor: a.actor_id ? (actorName.get(a.actor_id) ?? "Someone") : "System",
    })),
  };
}

const ACTIONS: Record<string, string> = {
  "invoices.generated": "generated monthly invoices",
  "invoice.created": "created a charge",
  "invoice.item_added": "adjusted an invoice",
  "invoice.item_removed": "removed an invoice line",
  "invoice.voided": "voided an invoice",
  "payment.recorded": "recorded a payment",
  "payment.voided": "voided a payment",
  "payment_submission.created": "submitted payment proof",
  "payment_submission.approved": "approved a payment",
  "payment_submission.rejected": "rejected a payment proof",
  "assignment.created": "assigned a bed",
  "assignment.ended": "recorded a move-out",
  "assignment.transferred": "moved a boarder to another bed",
  "invitation.sent": "invited a boarder",
  "invitation.accepted": "accepted an invitation",
  "maintenance.status_changed": "updated a repair request",
  "maintenance_requests.insert": "reported a problem",
  "announcements.insert": "posted an announcement",
  "announcements.update": "edited an announcement",
  "rooms.insert": "added a room",
  "rooms.update": "updated a room",
  "beds.insert": "added a bed",
  "beds.update": "updated a bed",
  "organizations.update": "changed settings",
  "organization_members.update": "updated a boarder",
  "organization_members.insert": "added a member",
  "properties.insert": "added a property",
  "properties.update": "updated a property",
};

export function describeAction(action: string, entityType: string): string {
  return ACTIONS[action] ?? `changed ${entityType.replace(/_/g, " ")}`;
}
