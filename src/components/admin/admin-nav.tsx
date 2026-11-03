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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Item = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; count?: number };

export function AdminNav({ pendingPayments, openRequests, onNavigate, collapsed = false }: {
  pendingPayments: number;
  openRequests: number;
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
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
    const count = item.count ?? 0;
    const content = (
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex items-center rounded-md text-sm text-muted-foreground transition-colors hover:bg-active/70 hover:text-foreground",
          collapsed ? "h-10 w-10 justify-center" : "h-8 gap-2.5 px-2.5",
          active && "bg-active font-medium text-foreground",
        )}
      >
        <Icon className={cn("shrink-0", collapsed ? "size-5" : "size-4")} aria-hidden />
        <span className={collapsed ? "sr-only" : "flex-1"}>{item.label}</span>
        {count > 0 && (
          <span
            className={cn(
              "num rounded-full bg-negative font-medium text-white",
              collapsed ? "absolute top-0 right-0 min-w-4 px-1 text-center text-[9px] leading-4" : "px-1.5 text-[11px] leading-[18px]",
            )}
            aria-label={`${count} waiting`}
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </Link>
    );
    return (
      <li key={item.href}>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>{content}</TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {item.label}{count > 0 ? ` · ${count} waiting` : ""}
            </TooltipContent>
          </Tooltip>
        ) : content}
      </li>
    );
  };

  return (
    <nav aria-label="Admin" className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {groups.map((group, i) => (
        <div key={i} className={cn("shrink-0", i > 0 && (collapsed ? "mt-3" : "mt-6"))}>
          {group.label && !collapsed && <p className="mb-1.5 px-2.5 text-xs text-muted-foreground">{group.label}</p>}
          <ul className="grid gap-0.5">{group.items.map(link)}</ul>
        </div>
      ))}
    </nav>
  );
}
