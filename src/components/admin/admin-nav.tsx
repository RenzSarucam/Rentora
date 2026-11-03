"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BedDouble,
  ClipboardList,
  CreditCard,
  FileText,
  LayoutDashboard,
  Megaphone,
  PieChart,
  Settings,
  Users,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; count?: number };

export function AdminNav({ pendingPayments, openRequests, onNavigate }: { pendingPayments: number; openRequests: number; onNavigate?: () => void }) {
  const pathname = usePathname();
  const groups: { label?: string; items: Item[] }[] = [
    { items: [{ href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
    {
      label: "House",
      items: [
        { href: "/admin/rooms", label: "Rooms & beds", icon: BedDouble },
        { href: "/admin/boarders", label: "Boarders", icon: Users },
        { href: "/admin/assignments", label: "Assignments", icon: ClipboardList },
      ],
    },
    {
      label: "Money",
      items: [
        { href: "/admin/billing", label: "Billing", icon: FileText },
        { href: "/admin/payments", label: "Payments", icon: CreditCard, count: pendingPayments },
        { href: "/admin/reports", label: "Reports", icon: PieChart },
      ],
    },
    {
      label: "Day to day",
      items: [
        { href: "/admin/maintenance", label: "Maintenance", icon: Wrench, count: openRequests },
        { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
      ],
    },
    { items: [{ href: "/admin/settings", label: "Settings", icon: Settings }] },
  ];

  const link = (item: Item) => {
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    const Icon = item.icon;
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm text-muted-foreground transition-colors hover:bg-active/70 hover:text-foreground",
            active && "bg-active font-medium text-foreground",
          )}
        >
          <Icon className="size-4 shrink-0" aria-hidden />
          <span className="flex-1">{item.label}</span>
          {item.count ? (
            <span className="num rounded-full bg-primary px-1.5 text-[11px] leading-[18px] font-medium text-primary-foreground" aria-label={`${item.count} waiting`}>
              {item.count}
            </span>
          ) : null}
        </Link>
      </li>
    );
  };

  return (
    <nav aria-label="Admin" className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {groups.map((group, i) => (
        <div key={i} className={cn("shrink-0", i > 0 && "mt-6")}>
          {group.label && <p className="mb-1.5 px-2.5 text-xs text-muted-foreground">{group.label}</p>}
          <ul className="grid gap-0.5">{group.items.map(link)}</ul>
        </div>
      ))}
    </nav>
  );
}
