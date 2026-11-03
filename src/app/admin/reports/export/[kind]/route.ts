import { NextResponse, type NextRequest } from "next/server";
import { getViewer, isStaff } from "@/lib/auth/session";
import { addMonths, manilaToday } from "@/lib/dates";
import { PAYMENT_METHOD_LABELS } from "@/lib/validation";
import { listRooms } from "@/features/rooms/queries";
import { balancesByBoarder, collectionsByMonth, overdueInvoices } from "@/features/reports/compute";
import { csvPesos, toCsv } from "@/features/reports/csv";
import { openInvoices, paymentsBetween, readRange } from "@/features/reports/queries";

const KINDS = ["occupancy", "collections", "outstanding", "overdue", "payments"] as const;
type Kind = (typeof KINDS)[number];

const method = (m: string) => PAYMENT_METHOD_LABELS[m as keyof typeof PAYMENT_METHOD_LABELS] ?? m;

async function build(kind: Kind, params: Record<string, string>): Promise<string> {
  const range = readRange(params);
  switch (kind) {
    case "occupancy": {
      const rooms = await listRooms();
      return toCsv(rooms, [
        { header: "Property", value: (r) => r.propertyName },
        { header: "Room", value: (r) => r.code },
        { header: "Floor", value: (r) => r.floor },
        { header: "Status", value: (r) => (r.status === "maintenance" ? "Under maintenance" : "Active") },
        { header: "Beds", value: (r) => r.beds.length },
        { header: "Occupied", value: (r) => r.beds.filter((b) => b.occupant).length },
        { header: "Rate per bed (PHP)", value: (r) => csvPesos(r.rate) },
      ]);
    }
    case "collections": {
      const payments = await paymentsBetween(addMonths(range.currentMonth, -(range.months - 1)), range.today);
      return toCsv(collectionsByMonth(payments, range.currentMonth, range.months), [
        { header: "Month", value: (m) => m.month.slice(0, 7) },
        { header: "Payments", value: (m) => m.count },
        { header: "Collected (PHP)", value: (m) => csvPesos(m.amount) },
      ]);
    }
    case "outstanding": {
      return toCsv(balancesByBoarder(await openInvoices(), range.today), [
        { header: "Boarder", value: (b) => b.boarder },
        { header: "Open invoices", value: (b) => b.invoices },
        { header: "Billed (PHP)", value: (b) => csvPesos(b.billed) },
        { header: "Paid (PHP)", value: (b) => csvPesos(b.paid) },
        { header: "Balance (PHP)", value: (b) => csvPesos(b.balance) },
        { header: "Oldest due", value: (b) => b.oldestDue },
      ]);
    }
    case "overdue": {
      return toCsv(overdueInvoices(await openInvoices(), range.today), [
        { header: "Invoice", value: (o) => o.invoiceNumber },
        { header: "Boarder", value: (o) => o.boarder },
        { header: "Due date", value: (o) => o.dueDate },
        { header: "Days late", value: (o) => o.daysOverdue },
        { header: "Total (PHP)", value: (o) => csvPesos(o.total) },
        { header: "Paid (PHP)", value: (o) => csvPesos(o.paid) },
        { header: "Balance (PHP)", value: (o) => csvPesos(o.balance) },
      ]);
    }
    case "payments": {
      return toCsv(await paymentsBetween(range.from, range.to), [
        { header: "Received", value: (p) => p.receivedOn },
        { header: "Receipt", value: (p) => p.receiptNumber },
        { header: "Boarder", value: (p) => p.boarder },
        { header: "Method", value: (p) => method(p.method) },
        { header: "Reference", value: (p) => p.reference },
        { header: "Amount (PHP)", value: (p) => csvPesos(p.amount) },
      ]);
    }
  }
}

export async function GET(request: NextRequest, { params }: RouteContext<"/admin/reports/export/[kind]">) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!isStaff(viewer)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { kind } = await params;
  if (!KINDS.includes(kind as Kind)) return NextResponse.json({ error: "Unknown report" }, { status: 404 });

  const query = Object.fromEntries(request.nextUrl.searchParams.entries());
  let csv: string;
  try {
    csv = await build(kind as Kind, query);
  } catch {
    return NextResponse.json({ error: "Could not build the report" }, { status: 500 });
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rentora-${kind}-${manilaToday()}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
