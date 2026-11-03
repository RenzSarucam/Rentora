import { cn } from "@/lib/utils";

/** Rentora's mark: an arched boarding-house door with a teal latch. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-6", className)} aria-hidden>
      <rect width="24" height="24" rx="6" fill="#172a46" />
      <path d="M7.5 19V11a4.5 4.5 0 0 1 9 0v8" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M5.5 19h13" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="14" cy="14.5" r="1.3" fill="#5fb3c6" />
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
