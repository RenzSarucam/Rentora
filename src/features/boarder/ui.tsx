import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** The boarder app's one surface: a white card with a soft 20px radius on the warm ground. */
export function Card({ children, className, ...props }: React.ComponentProps<"section">) {
  return (
    <section className={cn("rounded-[20px] bg-background p-5", className)} {...props}>
      {children}
    </section>
  );
}

export function ScreenTitle({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="mt-2 mb-5">
      <h1 className="text-[24px] leading-tight font-semibold tracking-[-0.01em]">{children}</h1>
      {sub && <p className="mt-1 text-[15px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

/** A full-width tappable row (≥56px) inside a card list. */
export function RowLink({ href, children, trailing }: { href: string; children: React.ReactNode; trailing?: React.ReactNode }) {
  return (
    <Link href={href} className="flex min-h-14 items-center gap-3 py-3 active:opacity-70">
      <div className="min-w-0 flex-1">{children}</div>
      {trailing}
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}

export function List({ children }: { children: React.ReactNode }) {
  return <ul className="divide-y divide-rule">{children}</ul>;
}

export function CardHeading({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold">{children}</h2>
      {action}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;
}
