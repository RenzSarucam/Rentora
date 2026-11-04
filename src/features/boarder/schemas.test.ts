import { describe, expect, it } from "vitest";
import { commentSchema, maintenanceSchema, paymentProofSchema, profileSchema } from "./schemas";
import { balanceOf, invoiceTitle, isPayable } from "./queries.shared";

const valid = {
  invoiceId: "0d6f6b8e-2b7a-4b8e-9a6a-1c2d3e4f5a6b",
  amount: "1,750.50",
  method: "gcash",
  reference: "1009 2233 445",
  paidOn: "2026-10-30",
};

describe("payment proof validation", () => {
  it("accepts a normal GCash submission and converts pesos to centavos", () => {
    const r = paymentProofSchema.parse(valid);
    expect(r.amount).toBe(175050);
  });

  it("does not allow cash (cash is recorded by the landlord)", () => {
    expect(paymentProofSchema.safeParse({ ...valid, method: "cash" }).success).toBe(false);
  });
  it.each(["maya", "other"])("does not offer %s for new boarder submissions", (method) => {
    expect(paymentProofSchema.safeParse({ ...valid, method }).success).toBe(false);
  });
  it("accepts bank transfer with the same exact-centavo amount parsing", () => {
    expect(paymentProofSchema.parse({ ...valid, method: "bank_transfer", amount: "250.25" }).amount).toBe(25025);
  });

  it.each(["", "abc", "<script>", "ref;drop", "x".repeat(65)])("rejects reference %j", (reference) => {
    expect(paymentProofSchema.safeParse({ ...valid, reference }).success).toBe(false);
  });

  it("rejects zero, negative and malformed amounts and bad dates", () => {
    for (const amount of ["0", "-1", "1.234", "abc"]) expect(paymentProofSchema.safeParse({ ...valid, amount }).success).toBe(false);
    expect(paymentProofSchema.safeParse({ ...valid, paidOn: "2026-02-30" }).success).toBe(false);
    expect(paymentProofSchema.safeParse({ ...valid, invoiceId: "not-a-uuid" }).success).toBe(false);
  });
});

describe("maintenance, comment and profile validation", () => {
  it("requires a meaningful title and description", () => {
    expect(maintenanceSchema.safeParse({ title: "ok", description: "x", priority: "normal" }).success).toBe(false);
    expect(maintenanceSchema.safeParse({ title: "Leaking faucet", description: "Drips", priority: "urgent" }).success).toBe(true);
    expect(maintenanceSchema.safeParse({ title: "Leaking faucet", description: "Drips", priority: "low" }).success).toBe(false);
  });

  it("trims comments and rejects empty ones", () => {
    expect(commentSchema.safeParse({ requestId: valid.invoiceId, body: "   " }).success).toBe(false);
  });

  it("normalizes optional profile fields to null", () => {
    expect(profileSchema.parse({ fullName: "Ana Reyes", phone: "", emergencyName: "", emergencyPhone: "" })).toEqual({
      fullName: "Ana Reyes",
      phone: null,
      emergencyName: null,
      emergencyPhone: null,
    });
    expect(profileSchema.safeParse({ fullName: "Ana", phone: "call me" }).success).toBe(false);
  });
});

describe("invoice helpers", () => {
  it("computes balances and payability", () => {
    expect(balanceOf({ total_centavos: 350000, amount_paid_centavos: 100000 })).toBe(250000);
    expect(isPayable({ status: "partially_paid" })).toBe(true);
    expect(isPayable({ status: "void" })).toBe(false);
    expect(invoiceTitle({ kind: "rent", period_month: "2026-10-01" }, () => "October 2026")).toBe("Rent · October 2026");
    expect(invoiceTitle({ kind: "deposit", period_month: null }, () => "")).toBe("Security deposit");
  });
});
