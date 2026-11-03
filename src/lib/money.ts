// All amounts are integer centavos. Conversion happens only at the edges (forms and display).

const php = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 });
const phpWhole = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });

export const MAX_CENTAVOS = 100_000_000; // ₱1,000,000.00 per line, matches the database checks

/** ₱3,500.00 */
export function formatPeso(centavos: number | bigint | null | undefined): string {
  if (centavos === null || centavos === undefined) return "—";
  return php.format(Number(centavos) / 100);
}

/** ₱3,500 when whole, ₱3,500.50 otherwise. For headline figures. */
export function formatPesoShort(centavos: number | bigint): string {
  const n = Number(centavos);
  return n % 100 === 0 ? phpWhole.format(n / 100) : php.format(n / 100);
}

/**
 * Parses what a person types ("3,500", "₱3500.5", "3500.50") into centavos without floating point error.
 * Returns null for anything that is not a plain non-negative amount with at most two decimals.
 */
export function parsePesoToCentavos(input: string | number): number | null {
  const raw = String(input).trim().replace(/[₱,\s]/g, "").replace(/^PHP/i, "");
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return null;
  const [whole, frac = ""] = raw.split(".");
  if (whole.length > 9) return null;
  const centavos = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return Number.isSafeInteger(centavos) ? centavos : null;
}

/** For prefilling inputs: 350000 -> "3500.00" */
export function centavosToInput(centavos: number | null | undefined): string {
  if (centavos === null || centavos === undefined) return "";
  return (centavos / 100).toFixed(2);
}
