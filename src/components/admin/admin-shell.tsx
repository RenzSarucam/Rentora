"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Wordmark } from "@/components/app/brand";
import { cn } from "@/lib/utils";
import { AdminNav } from "./admin-nav";

export function AdminShell({
  orgName,
  userName,
  userEmail,
  pendingPayments,
  openRequests,
  signOut,
  children,
}: {
  orgName: string;
  userName: string;
  userEmail: string;
  pendingPayments: number;
  openRequests: number;
  signOut: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isViewportPage = pathname === "/admin/dashboard" || pathname === "/admin/billing";
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [pathname]);

  const account = (
    <div className="mt-4 shrink-0 border-t border-border pt-3 lg:mt-3">
      <p className="truncate px-2.5 text-sm font-medium text-foreground">{userName}</p>
      <p className="truncate px-2.5 text-xs text-muted-foreground">{userEmail}</p>
      <div className="mt-2">{signOut}</div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-ground lg:fixed lg:inset-0 lg:grid lg:h-dvh lg:min-h-0 lg:grid-cols-[228px_minmax(0,1fr)] lg:grid-rows-[48px_minmax(0,1fr)] lg:overflow-hidden">
      {/* Sidebar: part of the tinted frame, no rule against the top bar. */}
      <aside className="hidden lg:row-span-2 lg:flex lg:min-h-0 lg:flex-col lg:overflow-hidden lg:px-3 lg:pt-3 lg:pb-2">
        <div className="mb-5 shrink-0 px-2.5">
          <Wordmark />
          <p className="mt-1 truncate text-xs text-muted-foreground" title={orgName}>
            {orgName}
          </p>
        </div>
        <AdminNav pendingPayments={pendingPayments} openRequests={openRequests} />
        {account}
      </aside>

      {/* Top bar (desktop): scope on the left. Mobile: menu, product, org. */}
      <header className="sticky top-0 z-20 flex h-12 items-center gap-3 bg-ground px-4 lg:static lg:px-2">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button type="button" className="-ml-1 inline-flex size-10 items-center justify-center rounded-md hover:bg-active lg:hidden" aria-label="Open menu">
              <Menu className="size-5" aria-hidden />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] bg-ground p-4">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <div className="mb-5 px-2.5">
              <Wordmark />
              <p className="mt-1 truncate text-xs text-muted-foreground">{orgName}</p>
            </div>
            <div className="flex h-[calc(100%-4rem)] flex-col">
              <AdminNav pendingPayments={pendingPayments} openRequests={openRequests} onNavigate={() => setOpen(false)} />
              {account}
            </div>
          </SheetContent>
        </Sheet>
        <span className="lg:hidden">
          <Wordmark />
        </span>
        <p className="hidden truncate text-sm text-muted-foreground lg:block">
          <span className="font-medium text-foreground">{orgName}</span> · Asia/Manila · PHP
        </p>
      </header>

      {/* The sheet: white, inset 8px from the right and bottom, hairline edge, no shadow. */}
      <main
        ref={mainRef}
        id="main"
        className={cn(
          "min-w-0 bg-background px-4 py-6 sm:px-6 lg:mr-2 lg:mb-2 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:rounded-2xl lg:border lg:border-border lg:px-8 lg:py-7",
          isViewportPage && "lg:overflow-hidden lg:py-5",
        )}
      >
        <div className={cn("mx-auto max-w-[1240px]", isViewportPage && "lg:h-full lg:min-h-0")}>{children}</div>
      </main>
    </div>
  );
}
