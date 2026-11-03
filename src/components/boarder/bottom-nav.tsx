"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, Home, ReceiptText, UserRound, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/boarder/home", label: "Home", icon: Home, match: ["/boarder/home", "/boarder/my-room", "/boarder/announcements"] },
  { href: "/boarder/bills", label: "Bills", icon: ReceiptText, match: ["/boarder/bills"] },
  { href: "/boarder/payment-history", label: "Payments", icon: CreditCard, match: ["/boarder/payment-history"] },
  { href: "/boarder/maintenance", label: "Repairs", icon: Wrench, match: ["/boarder/maintenance"] },
  { href: "/boarder/profile", label: "Me", icon: UserRound, match: ["/boarder/profile"] },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Boarder" className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background pb-safe">
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {ITEMS.map(({ href, label, icon: Icon, match }) => {
          const active = match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors active:bg-raised",
                  active && "text-foreground",
                )}
              >
                <span className={cn("flex h-7 w-12 items-center justify-center rounded-full transition-colors", active && "bg-teal-soft text-teal")}>
                  <Icon className="size-5" aria-hidden />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
