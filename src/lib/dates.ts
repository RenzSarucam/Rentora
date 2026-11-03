export const TIMEZONE = "Asia/Manila";

/** Today's calendar date in Manila as YYYY-MM-DD, regardless of the server's timezone. */
export function manilaToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** First day of the Manila month containing `date` (YYYY-MM-DD). */
export function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

export function addMonths(isoMonthStart: string, months: number): string {
  const [y, m] = isoMonthStart.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + months, 1));
  return d.toISOString().slice(0, 10);
}

/** Due date in a month: the given day, clamped to the month's length. */
export function dueDateFor(isoMonthStart: string, day: number): string {
  const [y, m] = isoMonthStart.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${isoMonthStart.slice(0, 7)}-${String(Math.min(day, last)).padStart(2, "0")}`;
}

const dateFmt = new Intl.DateTimeFormat("en-PH", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
const monthFmt = new Intl.DateTimeFormat("en-PH", { timeZone: "UTC", month: "long", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("en-PH", {
  timeZone: TIMEZONE,
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** "Oct 5, 2026" for a calendar date (YYYY-MM-DD). */
export function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  return dateFmt.format(new Date(`${isoDate.slice(0, 10)}T00:00:00Z`));
}

/** "October 2026" */
export function formatMonth(isoDate: string): string {
  return monthFmt.format(new Date(`${isoDate.slice(0, 10)}T00:00:00Z`));
}

/** "Oct 5, 3:40 PM" in Manila time, for timestamps. */
export function formatDateTime(timestamp: string | null | undefined): string {
  if (!timestamp) return "—";
  return dateTimeFmt.format(new Date(timestamp));
}

/** Whole days from `from` to `to` (both YYYY-MM-DD). Positive when `to` is later. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
