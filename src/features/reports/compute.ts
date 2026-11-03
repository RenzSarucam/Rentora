import { addMonths, daysBetween, monthStart } from "@/lib/dates";

// Pure report arithmetic. Every total is summed from the rows it summarizes.

export type PaymentRecord = {
  id: string;
  receiptNumber: string;
  receivedOn: string;
  amount: number;
  method: string;
  reference: string | null;
  boarder: string;
};

export type OpenInvoice = {
  id: string;
  invoiceNumber: string;
  memberId: string;
  boarder: string;
  dueDate: string;
  total: number;
  paid: number;
};

export type MonthTotal = { month: string; amount: number; count: number };

/** Collections per calendar month for the `months` months ending at `currentMonth`, oldest first, zeros included. */
export function collectionsByMonth(payments: PaymentRecord[], currentMonth: string, months: number): MonthTotal[] {
  const buckets = new Map<string, MonthTotal>();
  for (let i = months - 1; i >= 0; i--) {
    const m = addMonths(currentMonth, -i);
    buckets.set(m, { month: m, amount: 0, count: 0 });
  }
  for (const p of payments) {
    const b = buckets.get(monthStart(p.receivedOn));
    if (b) {
      b.amount += p.amount;
      b.count += 1;
    }
  }
  return [...buckets.values()];
}

export function totalsByMethod(payments: PaymentRecord[]): { method: string; amount: number; count: number }[] {
  const map = new Map<string, { method: string; amount: number; count: number }>();
  for (const p of payments) {
    const row = map.get(p.method) ?? { method: p.method, amount: 0, count: 0 };
    row.amount += p.amount;
    row.count += 1;
    map.set(p.method, row);
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount);
}

export type BoarderBalance = {
  memberId: string;
  boarder: string;
  invoices: number;
  billed: number;
  paid: number;
  balance: number;
  oldestDue: string;
  overdue: boolean;
};

export function balancesByBoarder(invoices: OpenInvoice[], today: string): BoarderBalance[] {
  const map = new Map<string, BoarderBalance>();
  for (const inv of invoices) {
    const row =
      map.get(inv.memberId) ??
      ({ memberId: inv.memberId, boarder: inv.boarder, invoices: 0, billed: 0, paid: 0, balance: 0, oldestDue: inv.dueDate, overdue: false } as BoarderBalance);
    row.invoices += 1;
    row.billed += inv.total;
    row.paid += inv.paid;
    row.balance += inv.total - inv.paid;
    if (inv.dueDate < row.oldestDue) row.oldestDue = inv.dueDate;
    row.overdue = row.oldestDue < today;
    map.set(inv.memberId, row);
  }
  return [...map.values()].sort((a, b) => b.balance - a.balance || a.boarder.localeCompare(b.boarder));
}

export const AGING_BUCKETS = [
  { key: "1-30", label: "1–30 days", min: 1, max: 30 },
  { key: "31-60", label: "31–60 days", min: 31, max: 60 },
  { key: "61-90", label: "61–90 days", min: 61, max: 90 },
  { key: "90+", label: "Over 90 days", min: 91, max: Infinity },
] as const;

export type OverdueInvoice = OpenInvoice & { daysOverdue: number; balance: number; bucket: (typeof AGING_BUCKETS)[number]["key"] };

export function overdueInvoices(invoices: OpenInvoice[], today: string): OverdueInvoice[] {
  return invoices
    .map((inv) => ({ ...inv, daysOverdue: daysBetween(inv.dueDate, today), balance: inv.total - inv.paid }))
    .filter((inv) => inv.daysOverdue >= 1 && inv.balance > 0)
    .map((inv) => ({ ...inv, bucket: AGING_BUCKETS.find((b) => inv.daysOverdue >= b.min && inv.daysOverdue <= b.max)!.key }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue);
}

export function agingSummary(overdue: OverdueInvoice[]) {
  return AGING_BUCKETS.map((b) => {
    const rows = overdue.filter((o) => o.bucket === b.key);
    return { ...b, count: rows.length, amount: rows.reduce((s, r) => s + r.balance, 0) };
  });
}

export const sum = <T>(rows: T[], pick: (row: T) => number) => rows.reduce((s, r) => s + pick(r), 0);
