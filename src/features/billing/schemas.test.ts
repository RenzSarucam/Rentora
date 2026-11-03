import { describe, expect, it } from "vitest";
import { addItemSchema, generateSchema, newChargeSchema, signedAmount } from "./schemas";
import { recordPaymentSchema } from "../payments/schemas";

const id = "4b0c2b5e-7d0a-4c1e-9a5e-2b1f0c3d4e5f";

describe("billing schemas", () => {
  it("parses pesos once into centavos and signs discounts", () => {
    const item = addItemSchema.parse({ invoiceId: id, kind: "discount", description: "Early bird", amount: "100.50" });
    expect(item.amount).toBe(10050);
    expect(signedAmount(item.kind, item.amount)).toBe(-10050);
    expect(signedAmount("fee", 10050)).toBe(10050);
  });

  it("requires a month start and a due date in or after it", () => {
    expect(generateSchema.safeParse({ month: "2026-11-01", dueDate: "2026-11-05" }).success).toBe(true);
    expect(generateSchema.safeParse({ month: "2026-11-15", dueDate: "2026-11-20" }).success).toBe(false);
    expect(generateSchema.safeParse({ month: "2026-11-01", dueDate: "2026-10-31" }).success).toBe(false);
  });

  it("limits a charge to 1-20 valid lines", () => {
    const base = { memberId: id, kind: "deposit", dueDate: "2026-11-05", notes: "" };
    expect(newChargeSchema.safeParse({ ...base, items: [] }).success).toBe(false);
    expect(newChargeSchema.safeParse({ ...base, items: [{ kind: "deposit", description: "Deposit", amount: "-5" }] }).success).toBe(false);
    const ok = newChargeSchema.parse({ ...base, items: [{ kind: "deposit", description: "Deposit", amount: "3,500" }] });
    expect(ok.items[0].amount).toBe(350000);
  });

  it("treats an empty invoice choice as none when recording a payment", () => {
    const v = recordPaymentSchema.parse({ memberId: id, amount: "500", method: "cash", reference: "", receivedOn: "2026-10-31", notes: "", invoiceId: "" });
    expect(v).toMatchObject({ amount: 50000, invoiceId: null, reference: null });
    expect(recordPaymentSchema.safeParse({ memberId: id, amount: "500", method: "bitcoin", receivedOn: "2026-10-31" }).success).toBe(false);
  });
});
