import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { MemberStatus } from "@/lib/auth/session";

export type PendingBoarderDeletion = { id: string; display_name: string | null; status: string };

/** Caller must be an active owner; the RPC independently scopes the private jobs. */
export async function listPendingBoarderDeletions(): Promise<PendingBoarderDeletion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("boarder_deletion_jobs");
  if (error) throw new Error("Could not load pending boarder deletions");
  return (data ?? []) as PendingBoarderDeletion[];
}

type Profile = { full_name: string; email: string; phone: string | null };

type AssignmentEmbed = {
  id: string;
  bed_id: string;
  move_in_date: string;
  move_out_date: string | null;
  end_reason: string | null;
  monthly_rent_centavos: number;
  beds: { label: string; rooms: { id: string; code: string } | null } | null;
};

type InvoiceBalanceEmbed = { total_centavos: number; amount_paid_centavos: number; status: string };

type BoarderRow = {
  id: string;
  status: MemberStatus;
  created_at: string;
  profiles: Profile | null;
  boarder_assignments: AssignmentEmbed[];
  invoices: InvoiceBalanceEmbed[];
};

export type BoarderListItem = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: MemberStatus;
  bed: { roomId: string; roomCode: string; label: string } | null;
  outstanding: number;
};

function outstandingOf(invoices: InvoiceBalanceEmbed[]): number {
  return invoices
    .filter((i) => i.status === "open" || i.status === "partially_paid")
    .reduce((sum, i) => sum + (i.total_centavos - i.amount_paid_centavos), 0);
}

function currentBed(assignments: AssignmentEmbed[]) {
  const current = assignments.find((a) => a.move_out_date === null);
  if (!current?.beds?.rooms) return null;
  return { roomId: current.beds.rooms.id, roomCode: current.beds.rooms.code, label: current.beds.label };
}

/** All boarders in the caller's organization (RLS scopes the rows). */
export async function listBoarders(): Promise<BoarderListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_members")
    .select(
      `id, status, created_at, profiles(full_name, email, phone),
       boarder_assignments(id, bed_id, move_in_date, move_out_date, end_reason, monthly_rent_centavos, beds(label, rooms(id, code))),
       invoices(total_centavos, amount_paid_centavos, status)`,
    )
    .eq("role", "boarder")
    .order("created_at", { ascending: false })
    .returns<BoarderRow[]>();
  if (error) throw new Error("Could not load boarders");
  return data
    .map((row) => ({
      id: row.id,
      name: row.profiles?.full_name || row.profiles?.email || "Boarder",
      email: row.profiles?.email ?? "",
      phone: row.profiles?.phone ?? null,
      status: row.status,
      bed: currentBed(row.boarder_assignments),
      outstanding: outstandingOf(row.invoices),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type BoarderDetail = {
  id: string;
  userId: string;
  status: MemberStatus;
  notes: string | null;
  joinedAt: string;
  name: string;
  email: string;
  phone: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  current: (AssignmentView & { bedId: string }) | null;
  assignments: AssignmentView[];
  invoices: {
    id: string;
    number: string;
    kind: string;
    periodMonth: string | null;
    dueDate: string;
    total: number;
    paid: number;
    status: string;
  }[];
  payments: {
    id: string;
    receiptNumber: string;
    amount: number;
    method: string;
    receivedOn: string;
    voided: boolean;
  }[];
  outstanding: number;
  lastInvitedAt: string | null;
};

export type AssignmentView = {
  id: string;
  roomId: string | null;
  roomCode: string;
  bedLabel: string;
  rent: number;
  moveIn: string;
  moveOut: string | null;
  endReason: string | null;
};

type DetailRow = {
  id: string;
  user_id: string;
  status: MemberStatus;
  notes: string | null;
  created_at: string;
  profiles: (Profile & { emergency_contact_name: string | null; emergency_contact_phone: string | null }) | null;
  boarder_assignments: AssignmentEmbed[];
  invoices: {
    id: string;
    invoice_number: string;
    kind: string;
    period_month: string | null;
    due_date: string;
    total_centavos: number;
    amount_paid_centavos: number;
    status: string;
  }[];
  payments: {
    id: string;
    receipt_number: string;
    amount_centavos: number;
    method: string;
    received_on: string;
    voided_at: string | null;
  }[];
  invitations: { created_at: string }[];
};

export async function getBoarder(memberId: string): Promise<BoarderDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_members")
    .select(
      `id, user_id, status, notes, created_at,
       profiles(full_name, email, phone, emergency_contact_name, emergency_contact_phone),
       boarder_assignments(id, bed_id, move_in_date, move_out_date, end_reason, monthly_rent_centavos, beds(label, rooms(id, code))),
       invoices(id, invoice_number, kind, period_month, due_date, total_centavos, amount_paid_centavos, status),
       payments(id, receipt_number, amount_centavos, method, received_on, voided_at),
       invitations(created_at)`,
    )
    .eq("id", memberId)
    .eq("role", "boarder")
    .maybeSingle<DetailRow>();
  if (error || !data) return null;

  const assignments: (AssignmentView & { bedId: string })[] = data.boarder_assignments
    .map((a) => ({
      id: a.id,
      bedId: a.bed_id,
      roomId: a.beds?.rooms?.id ?? null,
      roomCode: a.beds?.rooms?.code ?? "—",
      bedLabel: a.beds?.label ?? "—",
      rent: a.monthly_rent_centavos,
      moveIn: a.move_in_date,
      moveOut: a.move_out_date,
      endReason: a.end_reason,
    }))
    .sort((a, b) => b.moveIn.localeCompare(a.moveIn));

  return {
    id: data.id,
    userId: data.user_id,
    status: data.status,
    notes: data.notes,
    joinedAt: data.created_at,
    name: data.profiles?.full_name || data.profiles?.email || "Boarder",
    email: data.profiles?.email ?? "",
    phone: data.profiles?.phone ?? null,
    emergencyName: data.profiles?.emergency_contact_name ?? null,
    emergencyPhone: data.profiles?.emergency_contact_phone ?? null,
    current: assignments.find((a) => a.moveOut === null) ?? null,
    assignments,
    invoices: data.invoices
      .map((i) => ({
        id: i.id,
        number: i.invoice_number,
        kind: i.kind,
        periodMonth: i.period_month,
        dueDate: i.due_date,
        total: i.total_centavos,
        paid: i.amount_paid_centavos,
        status: i.status,
      }))
      .sort((a, b) => b.dueDate.localeCompare(a.dueDate) || b.number.localeCompare(a.number)),
    payments: data.payments
      .map((p) => ({
        id: p.id,
        receiptNumber: p.receipt_number,
        amount: p.amount_centavos,
        method: p.method,
        receivedOn: p.received_on,
        voided: p.voided_at !== null,
      }))
      .sort((a, b) => b.receivedOn.localeCompare(a.receivedOn) || b.receiptNumber.localeCompare(a.receiptNumber)),
    outstanding: outstandingOf(data.invoices),
    lastInvitedAt: data.invitations.map((i) => i.created_at).sort().at(-1) ?? null,
  };
}
