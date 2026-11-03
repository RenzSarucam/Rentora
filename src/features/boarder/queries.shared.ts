// Pure invoice helpers, safe to import anywhere (and testable without a server).

type Money = { total_centavos: number; amount_paid_centavos: number };

export const balanceOf = (i: Money) => i.total_centavos - i.amount_paid_centavos;
export const isPayable = (i: { status: string }) => i.status === "open" || i.status === "partially_paid";

export function invoiceTitle(i: { kind: string; period_month: string | null }, formatMonth: (d: string) => string): string {
  if (i.kind === "rent" && i.period_month) return `Rent · ${formatMonth(i.period_month)}`;
  if (i.kind === "deposit") return "Security deposit";
  return "Other charges";
}
