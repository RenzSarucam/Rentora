import { cn } from "@/lib/utils";
import { BRAND_INK, BRAND_MARK_PATH, BRAND_VIEW_BOX } from "@/lib/brand-artwork";

/** Rentora's mark: a boarding house with an R-shaped doorway and window. */
export function BrandMark({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <svg viewBox={BRAND_VIEW_BOX} className={cn("rentora-brand-mark size-6 shrink-0", className)} aria-hidden>
      <path d={BRAND_MARK_PATH} fill={BRAND_INK} fillRule="evenodd" clipRule="evenodd" />
      {children}
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em] text-foreground", className)}>
      <BrandMark />
      Rentora
    </span>
  );
}
