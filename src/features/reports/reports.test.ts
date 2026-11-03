import { describe, expect, it } from "vitest";
import { agingSummary, balancesByBoarder, collectionsByMonth, overdueInvoices, totalsByMethod, type OpenInvoice, type PaymentRecord } from "./compute";
import { csvCell, csvPesos, toCsv } from "./csv";

const pay = (receivedOn: string, amount: number, method = "cash"): PaymentRecord => ({
  id: receivedOn + amount,
  receiptNumber: "OR-1",
  receivedOn,
  amount,
  method,
  reference: null,
  boarder: "Ana Cruz",
});

describe("collections", () => {
  it("buckets by month with zero months kept and totals matching the rows", () => {
    const payments = [pay("2026-10-02", 350000), pay("2026-10-30", 150000, "gcash"), pay("2026-08-15", 100000), pay("2026-03-01", 999)];
    const months = collectionsByMonth(payments, "2026-10-01", 3);
    expect(months).toEqual([
      { month: "2026-08-01", amount: 100000, count: 1 },
      { month: "2026-09-01", amount: 0, count: 0 },
      { month: "2026-10-01", amount: 500000, count: 2 },
    ]);
    expect(totalsByMethod(payments.slice(0, 3))).toEqual([
      { method: "cash", amount: 450000, count: 2 },
      { method: "gcash", amount: 150000, count: 1 },
    ]);
  });
});

describe("balances and aging", () => {
  const inv = (id: string, memberId: string, dueDate: string, total: number, paid = 0): OpenInvoice => ({
    id,
    invoiceNumber: id,
    memberId,
    boarder: memberId === "m1" ? "Ana Cruz" : "Ben Reyes",
    dueDate,
    total,
    paid,
  });
  const today = "2026-10-31";
  const invoices = [
    inv("a", "m1", "2026-10-05", 350000, 100000), // 26 days
    inv("b", "m1", "2026-08-05", 350000), // 87 days
    inv("c", "m2", "2026-11-05", 300000), // not yet due
    inv("d", "m2", "2026-06-01", 50000), // 152 days
  ];

  it("sums balances per boarder and finds the oldest due date", () => {
    const rows = balancesByBoarder(invoices, today);
    expect(rows[0]).toMatchObject({ memberId: "m1", invoices: 2, billed: 700000, paid: 100000, balance: 600000, oldestDue: "2026-08-05", overdue: true });
    expect(rows[1]).toMatchObject({ memberId: "m2", balance: 350000, oldestDue: "2026-06-01" });
  });

  it("ages overdue invoices into buckets and ignores those not yet due", () => {
    const overdue = overdueInvoices(invoices, today);
    expect(overdue.map((o) => [o.id, o.daysOverdue, o.bucket])).toEqual([
      ["d", 152, "90+"],
      ["b", 87, "61-90"],
      ["a", 26, "1-30"],
    ]);
    const summary = agingSummary(overdue);
    expect(summary.map((s) => [s.key, s.count, s.amount])).toEqual([
      ["1-30", 1, 250000],
      ["31-60", 0, 0],
      ["61-90", 1, 350000],
      ["90+", 1, 50000],
    ]);
  });

  it("an invoice due today is not overdue", () => {
    expect(overdueInvoices([inv("x", "m1", today, 100)], today)).toEqual([]);
  });
});

describe("CSV export", () => {
  it("neutralizes spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(\"http://evil\")")).toBe(`"'=HYPERLINK(""http://evil"")"`);
    expect(csvCell("+639171234567")).toBe("'+639171234567");
    expect(csvCell("-2+3")).toBe("'-2+3");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("\tcmd")).toBe("'\tcmd");
  });

  it("quotes commas, quotes and newlines", () => {
    expect(csvCell("Cruz, Ana")).toBe('"Cruz, Ana"');
    expect(csvCell('6" bed')).toBe('"6"" bed"');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
    expect(csvCell(null)).toBe("");
  });

  it("writes a BOM, a header row and CRLF rows; amounts are plain pesos", () => {
    const csv = toCsv([{ name: "Niña", amount: 350050 }], [
      { header: "Boarder", value: (r) => r.name },
      { header: "Amount (PHP)", value: (r) => csvPesos(r.amount) },
    ]);
    expect(csv).toBe("﻿Boarder,Amount (PHP)\r\nNiña,3500.50\r\n");
    expect(csvPesos(-5000)).toBe("-50.00");
  });
});
