"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Menu, UserRound } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BrandMark, Wordmark } from "@/components/app/brand";
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pathname = usePathname();
  const isViewportPage = pathname === "/admin/dashboard" || pathname === "/admin/billing";
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className={cn(
      "min-h-dvh bg-ground lg:fixed lg:inset-0 lg:grid lg:h-dvh lg:min-h-0 lg:grid-rows-[48px_minmax(0,1fr)] lg:overflow-hidden",
      sidebarOpen ? "lg:grid-cols-[228px_minmax(0,1fr)]" : "lg:grid-cols-[64px_minmax(0,1fr)]",
    )}>
      {/* Sidebar: part of the tinted frame, no rule against the top bar. */}
      <aside id="admin-sidebar" aria-label="Sidebar" className="hidden lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:flex lg:min-h-0 lg:flex-col lg:overflow-hidden lg:px-3 lg:pt-3 lg:pb-2">
        <div className={cn("shrink-0", sidebarOpen ? "mb-5 px-2.5" : "mb-7 flex h-6 items-center justify-center")}>
          {sidebarOpen ? (
            <>
              <Wordmark />
              <p className="mt-1 truncate text-xs text-muted-foreground" title={orgName}>
                {orgName}
              </p>
            </>
          ) : (
            <span role="img" aria-label="Rentora"><BrandMark /></span>
          )}
        </div>
        <div id="admin-sidebar-navigation" className="flex min-h-0 flex-1 flex-col">
          <AdminNav pendingPayments={pendingPayments} openRequests={openRequests} collapsed={!sidebarOpen} />
        </div>
      </aside>

      {/* Straddle the sidebar/content corner without scrolling with either panel. */}
      <button
        type="button"
        onClick={() => setSidebarOpen((visible) => !visible)}
        aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
        title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
        aria-expanded={sidebarOpen}
        aria-controls="admin-sidebar-navigation"
        className="hidden size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:bg-active hover:text-foreground lg:col-start-2 lg:row-start-2 lg:z-30 lg:inline-flex lg:self-start lg:justify-self-start"
      >
        {sidebarOpen ? <ChevronLeft className="size-4" aria-hidden /> : <ChevronRight className="size-4" aria-hidden />}
      </button>

      {/* Scope on the left, account controls on the right. */}
      <header className="sticky top-0 z-20 flex h-12 items-center gap-3 bg-ground px-4 lg:static lg:col-start-2 lg:row-start-1 lg:px-2">
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
            </div>
          </SheetContent>
        </Sheet>
        <span className="lg:hidden">
          <Wordmark />
        </span>
        <p className="hidden min-w-0 truncate text-sm text-muted-foreground lg:block">
          <span className="font-medium text-foreground">{orgName}</span> · Asia/Manila · PHP
        </p>
        <div className="ml-auto hidden shrink-0 items-center gap-3 lg:flex">
          <div className="max-w-56 text-right">
            <p className="truncate text-sm font-medium text-foreground" title={userName}>{userName}</p>
            <p className="truncate text-xs text-muted-foreground" title={userEmail}>{userEmail}</p>
          </div>
          <div className="shrink-0 border-l border-border pl-3">{signOut}</div>
        </div>
        <div className="ml-auto lg:hidden">
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" aria-label="Open account" className="inline-flex size-10 items-center justify-center rounded-md hover:bg-active">
                <UserRound className="size-5" aria-hidden />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" aria-label="Account" className="w-64 border border-border bg-background p-3 shadow-none ring-0">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground" title={userName}>{userName}</p>
                <p className="truncate text-xs text-muted-foreground" title={userEmail}>{userEmail}</p>
              </div>
              <div className="border-t border-border pt-2">{signOut}</div>
            </PopoverContent>
          </Popover>
        </div>
      </header>

      {/* The sheet: white, inset 8px from the right and bottom, hairline edge, no shadow. */}
      <main
        ref={mainRef}
        id="main"
        className={cn(
          "min-w-0 bg-background px-4 py-6 sm:px-6 lg:col-start-2 lg:row-start-2 lg:mr-2 lg:mb-2 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:rounded-2xl lg:border lg:border-border lg:px-8 lg:py-7",
          isViewportPage && "lg:overflow-hidden lg:py-5",
        )}
      >
        <div className={cn("mx-auto max-w-[1240px]", isViewportPage && "lg:h-full lg:min-h-0")}>{children}</div>
      </main>
    </div>
  );
}
