import { roomLabel } from "@/lib/room-label";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/app/status-pill";
import {
  balanceOf,
  isPayable,
  listAnnouncements,
  listAssignments,
  listInvoices,
  listSubmissions,
  recentNotices,
} from "@/features/boarder/queries";
import { Card, CardHeading, Empty, List } from "@/features/boarder/ui";
import { requireBoarder } from "@/lib/auth/session";
import { daysBetween, formatDate, formatDateTime, manilaToday } from "@/lib/dates";
import { formatPeso } from "@/lib/money";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Home" };

function greeting(now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", hour: "numeric", hour12: false }).format(now)) % 24;
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function BoarderHome() {
  const viewer = await requireBoarder();
  const today = manilaToday();
  const [invoices, submissions, assignments, notices, announcements] = await Promise.all([
    listInvoices(viewer),
    listSubmissions(viewer, 20),
    listAssignments(viewer),
    recentNotices(viewer),
    listAnnouncements(3),
  ]);

  const unpaid = invoices.filter(isPayable).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const balance = unpaid.reduce((s, i) => s + balanceOf(i), 0);
  const pending = submissions.filter((s) => s.status === "pending").reduce((s, x) => s + x.amount_centavos, 0);
  const next = unpaid[0];
  const overdue = next && next.due_date < today;
  const current = assignments.find((a) => a.move_out_date === null);
  const firstName = viewer.fullName.split(/\s+/)[0] || "there";

  return (
    <div className="grid gap-4">
      <div className="mt-2">
        <p className="text-[15px] text-muted-foreground">{greeting()},</p>
        <h1 className="text-[24px] leading-tight font-semibold tracking-[-0.01em]">{firstName}</h1>
      </div>

      <Card aria-labelledby="balance-label">
        <p id="balance-label" className="text-sm text-muted-foreground">
          Current balance
        </p>
        <p className="num mt-1 text-[38px] leading-none font-semibold tracking-[-0.02em]">{formatPeso(balance)}</p>
        {next ? (
          <p className={cn("mt-3 text-[15px]", overdue ? "font-medium text-negative" : "text-foreground")}>
            {overdue
              ? `Overdue since ${formatDate(next.due_date)} (${daysBetween(next.due_date, today)} days)`
              : next.due_date === today
                ? "Due today"
                : `Next due ${formatDate(next.due_date)}`}
          </p>
        ) : (
          <p className="mt-3 text-[15px] text-positive">You&apos;re all paid up.</p>
        )}
        {pending > 0 && (
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="num">{formatPeso(pending)}</span> sent and awaiting your landlord&apos;s review
          </p>
        )}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button asChild className="h-12 rounded-xl text-[15px]">
            <Link href={next ? `/boarder/bills/${next.id}` : "/boarder/bills"}>Pay a bill</Link>
          </Button>
          <Button asChild variant="outline" className="h-12 rounded-xl text-[15px]">
            <Link href="/boarder/maintenance/new">Report a problem</Link>
          </Button>
        </div>
      </Card>

      <Link href="/boarder/my-room" className="block rounded-[20px] bg-background p-5 active:opacity-80">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">My room</p>
            {current?.beds?.rooms ? (
              <>
                <p className="mt-0.5 text-lg font-semibold">
                  {roomLabel(current.beds.rooms.code)} · {current.beds.label}
                </p>
                <p className="num text-sm text-muted-foreground">{formatPeso(current.monthly_rent_centavos)} a month</p>
              </>
            ) : (
              <p className="mt-0.5 text-[15px]">No bed assigned yet</p>
            )}
          </div>
          <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
        </div>
      </Link>

      <Card>
        <CardHeading>Recent updates</CardHeading>
        {notices.length === 0 ? (
          <Empty>Nothing new. Bills, payment confirmations and repair updates will show here.</Empty>
        ) : (
          <List>
            {notices.map((n) => (
              <li key={n.id}>
                <Link href={n.href} className="flex min-h-14 gap-3 py-3 active:opacity-70">
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      n.tone === "positive" && "bg-positive",
                      n.tone === "negative" && "bg-negative",
                      n.tone === "accent" && "bg-teal",
                      n.tone === "neutral" && "bg-control",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] leading-snug">{n.title}</span>
                    {n.detail && <span className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground">{n.detail}</span>}
                    <span className="mt-0.5 block text-xs text-muted-foreground">{formatDateTime(n.at)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </List>
        )}
      </Card>

      <Card>
        <CardHeading
          action={
            announcements.length > 0 && (
              <Link href="/boarder/announcements" className="inline-flex min-h-11 items-center text-sm text-teal">
                See all
              </Link>
            )
          }
        >
          Announcements
        </CardHeading>
        {announcements.length === 0 ? (
          <Empty>No announcements from your boarding house yet.</Empty>
        ) : (
          <List>
            {announcements.map((a) => (
              <li key={a.id} className="py-3">
                <Link href={`/boarder/announcements/${a.id}`} className="block active:opacity-70">
                  <span className="flex items-center gap-2">
                    <span className="text-[15px] font-medium">{a.title}</span>
                    {a.isUnread ? <StatusPill tone="negative">Unread</StatusPill> : a.pinned && <StatusPill tone="accent">Pinned</StatusPill>}
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground">{a.body}</span>
                </Link>
              </li>
            ))}
          </List>
        )}
      </Card>
    </div>
  );
}
