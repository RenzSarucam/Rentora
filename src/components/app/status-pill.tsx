import { cn } from "@/lib/utils";

export type Tone = "positive" | "negative" | "warning" | "neutral" | "accent";

const TONES: Record<Tone, string> = {
  positive: "bg-pill-positive-bg text-pill-positive-ink",
  negative: "bg-pill-negative-bg text-pill-negative-ink",
  warning: "bg-pill-warning-bg text-pill-warning-ink",
  neutral: "bg-pill-neutral-bg text-pill-neutral-ink",
  accent: "bg-teal-soft text-teal",
};

export function StatusPill({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center rounded-full px-2.5 text-xs font-medium whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// Status vocabularies shared by admin and boarder screens.

export function invoiceStatus(status: string, dueDate: string, today: string): { label: string; tone: Tone } {
  if (status === "paid") return { label: "Paid", tone: "positive" };
  if (status === "void") return { label: "Void", tone: "neutral" };
  const overdue = dueDate < today;
  if (status === "partially_paid") return overdue ? { label: "Partly paid · overdue", tone: "negative" } : { label: "Partly paid", tone: "warning" };
  return overdue ? { label: "Overdue", tone: "negative" } : { label: "Unpaid", tone: "warning" };
}

export function submissionStatus(status: string): { label: string; tone: Tone } {
  if (status === "approved") return { label: "Confirmed", tone: "positive" };
  if (status === "rejected") return { label: "Rejected", tone: "negative" };
  return { label: "Awaiting review", tone: "warning" };
}

export function maintenanceStatus(status: string): { label: string; tone: Tone } {
  switch (status) {
    case "open":
      return { label: "Open", tone: "warning" };
    case "in_progress":
      return { label: "In progress", tone: "accent" };
    case "resolved":
      return { label: "Resolved", tone: "positive" };
    default:
      return { label: "Cancelled", tone: "neutral" };
  }
}
