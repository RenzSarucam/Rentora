import Link from "next/link";
import { cn } from "@/lib/utils";

export type LinkTab = { href: string; label: string; count?: number; active: boolean };

/** Underline tabs on a full-width rule; each tab is a real link, so filters survive reloads and sharing. */
export function LinkTabs({ tabs, label }: { tabs: LinkTab[]; label: string }) {
  return (
    <nav aria-label={label} className="mb-5 border-b border-border">
      <ul className="-mb-px flex gap-6 overflow-x-auto">
        {tabs.map((tab) => (
          <li key={tab.href}>
            <Link
              href={tab.href}
              aria-current={tab.active ? "page" : undefined}
              className={cn(
                "inline-flex h-10 items-center gap-1.5 border-b-2 border-transparent text-sm whitespace-nowrap text-muted-foreground hover:text-foreground",
                tab.active && "border-foreground font-medium text-foreground",
              )}
            >
              {tab.label}
              {tab.count !== undefined && <span className="num text-muted-foreground">{tab.count}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
