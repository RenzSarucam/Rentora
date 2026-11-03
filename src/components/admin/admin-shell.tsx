"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Wordmark } from "@/components/app/brand";
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

  const account = (
    <div className="mt-4 border-t border-border pt-3">
      <p className="truncate px-2.5 text-sm font-medium text-foreground">{userName}</p>
      <p className="truncate px-2.5 text-xs text-muted-foreground">{userEmail}</p>
      <div className="mt-2">{signOut}</div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-ground lg:grid lg:grid-cols-[228px_1fr] lg:grid-rows-[48px_1fr]">
      {/* Sidebar: part of the tinted frame, no rule against the top bar. */}
      <aside className="hidden lg:row-span-2 lg:flex lg:flex-col lg:px-3 lg:pt-3 lg:pb-4">
        <div className="mb-5 px-2.5">
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
        id="main"
        className="min-w-0 bg-background px-4 py-6 sm:px-6 lg:mr-2 lg:mb-2 lg:rounded-2xl lg:border lg:border-border lg:px-8 lg:py-7"
      >
        <div className="mx-auto max-w-[1240px]">{children}</div>
      </main>
    </div>
  );
}
