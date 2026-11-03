import { daysBetween, manilaToday } from "@/lib/dates";

/** "Today", "1 day", "12 days" — age of a request in Manila calendar days. */
export function ageLabel(timestamp: string, today = manilaToday()): string {
  const days = daysBetween(manilaToday(new Date(timestamp)), today);
  if (days <= 0) return "Today";
  return days === 1 ? "1 day" : `${days} days`;
}
