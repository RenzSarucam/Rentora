import { roomLabel } from "@/lib/room-label";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/app/status-pill";
import { CollectionsChart } from "@/features/dashboard/collections-chart";
import { getDashboard } from "@/features/dashboard/queries";
import { BedCells, BedLegend } from "@/features/rooms/bed-map";
import { listRooms, occupancy } from "@/features/rooms/queries";
import { daysBetween, formatDateTime, formatMonth } from "@/lib/dates";
import { formatPeso, formatPesoShort } from "@/lib/money";
import { cn } from "@/lib/utils";
import { PAYMENT_METHOD_LABELS } from "@/lib/validation";

export const metadata: Metadata = { title: "Dashboard" };

function age(createdAt: string, today: string) {
  const days = daysBetween(createdAt.slice(0, 10), today);
  return days <= 0 ? "today" : days === 1 ? "1 day" : `${days} days`;
}

export default async function DashboardPage() {
  const [d, rooms] = await Promise.all([getDashboard(), listRooms()]);
  const occ = occupancy(rooms);
  const monthName = formatMonth(d.thisMonth).split(" ")[0];
  const collectedShare = d.billedThisMonth ? Math.min(1, d.collectedForThisMonth / d.billedThisMonth) : 0;

  const finding =
    rooms.length === 0
      ? "Set up your rooms and beds to get started."
      : d.overdue.count > 0
        ? `${formatPeso(d.overdue.amount)} is overdue from ${d.overdue.boarders} boarder${d.overdue.boarders === 1 ? "" : "s"}.`
        : !d.thisMonthInvoiced
          ? `${monthName} rent has not been billed yet.`
          : d.collectedForThisMonth >= d.billedThisMonth
            ? `All ${monthName} rent is in.`
            : `${formatPeso(d.billedThisMonth - d.collectedForThisMonth)} of ${monthName} rent is still to come in.`;

  const kpis = [
    { label: "Occupancy", value: `${Math.round(occ.rate * 100)}%`, note: `${occ.occupied} of ${occ.beds} beds occupied` },
    { label: "Available beds", value: String(occ.available), note: occ.unavailable ? `${occ.unavailable} under maintenance` : `in ${occ.rooms} rooms` },
    { label: "Active boarders", value: String(d.activeBoarders), note: d.invitedBoarders ? `${d.invitedBoarders} invited, not yet signed in` : "signed in to the app" },
    { label: `Collected in ${monthName}`, value: formatPesoShort(d.collectedThisMonth), note: "payments received this month" },
    {
      label: "Outstanding",
      value: formatPesoShort(d.outstanding),
      note: d.overdue.count ? `${formatPeso(d.overdue.amount)} overdue · ${d.overdue.count} invoice${d.overdue.count === 1 ? "" : "s"}` : "nothing overdue",
      negative: d.overdue.count > 0,
    },
  ];

  return (
    <div className="lg:flex lg:h-full lg:min-h-0 lg:flex-col">
      <PageHeader
        className="mb-4 shrink-0"
        title="Dashboard"
        description={finding}
        actions={
          rooms.length === 0 ? (
            <Button asChild>
              <Link href="/admin/rooms">Add rooms</Link>
            </Button>
          ) : !d.thisMonthInvoiced ? (
            <Button asChild>
              <Link href="/admin/billing">Bill {monthName} rent</Link>
            </Button>
          ) : (
            <Button asChild>
              <Link href="/admin/payments">Record a payment</Link>
            </Button>
          )
        }
      />

      {/* KPIs: one container split by dividers, label over value. */}
      <section aria-label="Key figures" className="mb-4 grid shrink-0 grid-cols-2 overflow-hidden rounded-lg border border-border md:grid-cols-5">
        {kpis.map((k, i) => (
          <div
            key={k.label}
            className={cn(
              "border-border p-4 md:border-l md:first:border-l-0 lg:p-3",
              i % 2 === 1 && "border-l",
              i >= 2 && "border-t md:border-t-0",
              i === kpis.length - 1 && "col-span-2 md:col-span-1",
            )}
          >
            <p className="text-sm text-muted-foreground">{k.label}</p>
            <p className="num mt-1 text-2xl font-normal tracking-[-0.01em]">{k.value}</p>
            <p className={cn("mt-1 text-xs text-muted-foreground", k.negative && "font-medium text-negative")}>{k.note}</p>
          </div>
        ))}
      </section>

      <div role="region" aria-label="Dashboard cards" tabIndex={0} className="grid gap-5 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_320px] lg:grid-rows-[minmax(min-content,3fr)_minmax(240px,2fr)] lg:overflow-y-auto lg:overscroll-contain xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* The screen's question: is this month's rent coming in? */}
        <section aria-labelledby="rent-heading" className="flex min-w-0 flex-col rounded-lg border border-border p-5 lg:min-h-[380px]">
          <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="rent-heading" className="text-base font-semibold">
                {formatMonth(d.thisMonth)} rent
              </h2>
              {d.thisMonthInvoiced ? (
                <p className="mt-2">
                  <span className="num text-[32px] leading-none font-normal tracking-[-0.02em]">{formatPeso(d.collectedForThisMonth)}</span>
                  <span className="num ml-2 text-sm text-muted-foreground">collected of {formatPeso(d.billedThisMonth)} billed</span>
                </p>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Not billed yet. Generate invoices to start tracking this month.</p>
              )}
            </div>
            <Link href="/admin/billing" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
              Open billing
            </Link>
          </div>
          {d.thisMonthInvoiced && (
            <div className="mt-3 shrink-0">
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-active"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(collectedShare * 100)}
                aria-label="Share of this month's rent collected"
              >
                <div className="h-full rounded-full bg-teal" style={{ width: `${collectedShare * 100}%` }} />
              </div>
              <div className="num mt-1.5 flex justify-between text-xs text-muted-foreground">
                <span>{Math.round(collectedShare * 100)}% collected</span>
                <span>{formatPeso(d.billedThisMonth - d.collectedForThisMonth)} to go</span>
              </div>
            </div>
          )}
          <h3 className="mt-6 mb-3 shrink-0 text-sm font-medium text-muted-foreground">Payments received, last 6 months</h3>
          <CollectionsChart
            data={d.collections.map((c) => ({
              month: c.month,
              label: formatMonth(c.month).slice(0, 3),
              collected: c.collected,
              current: c.month === d.thisMonth,
            }))}
          />
        </section>

        <div className="grid content-start gap-4 lg:min-h-0 lg:grid-rows-[minmax(0,1fr)_minmax(0,1fr)]">
          <section aria-labelledby="approvals-heading" className="flex min-h-0 flex-col">
            <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
              <h2 id="approvals-heading" className="text-base font-semibold">
                Payments to review <span className="num text-muted-foreground">{d.pendingCount}</span>
              </h2>
              {d.pendingCount > 0 && (
                <Link href="/admin/payments" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
                  Review all
                </Link>
              )}
            </div>
            <div role="region" aria-labelledby="approvals-heading" tabIndex={0} className="min-h-0 overflow-y-auto rounded-lg border border-border lg:flex-1">
              {d.pending.length === 0 ? (
                <p className="px-4 py-5 text-sm text-muted-foreground">No payment proofs waiting.</p>
              ) : (
                <ul>
                  {d.pending.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 border-b border-rule px-4 py-2.5 last:border-0">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {PAYMENT_METHOD_LABELS[p.method as keyof typeof PAYMENT_METHOD_LABELS] ?? p.method} · waiting {age(p.createdAt, d.today)}
                        </p>
                      </div>
                      <span className="num text-sm">{formatPeso(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section aria-labelledby="repairs-heading" className="flex min-h-0 flex-col">
            <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
              <h2 id="repairs-heading" className="text-base font-semibold">
                Open repairs <span className="num text-muted-foreground">{d.openRequestCount}</span>
              </h2>
              <Link href="/admin/maintenance" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
                View all
              </Link>
            </div>
            <div role="region" aria-labelledby="repairs-heading" tabIndex={0} className="min-h-0 overflow-y-auto rounded-lg border border-border lg:flex-1">
              {d.requests.length === 0 ? (
                <p className="px-4 py-5 text-sm text-muted-foreground">Nothing needs fixing right now.</p>
              ) : (
                <ul>
                  {d.requests.map((r) => (
                    <li key={r.id} className="border-b border-rule last:border-0">
                      <Link href={`/admin/maintenance/${r.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-raised/60">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{r.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {r.room ? `${roomLabel(r.room)} · ` : ""}
                            {age(r.createdAt, d.today)} old
                          </p>
                        </div>
                        {r.urgent ? <StatusPill tone="negative">Urgent</StatusPill> : r.status === "in_progress" ? <StatusPill tone="accent">In progress</StatusPill> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        <section aria-labelledby="house-heading" className="flex min-h-0 flex-col rounded-lg border border-border p-4">
          <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3">
            <h2 id="house-heading" className="text-base font-semibold">
              The house <span className="num text-sm font-normal text-muted-foreground">· {occ.rooms} room{occ.rooms === 1 ? "" : "s"}, {occ.beds} bed{occ.beds === 1 ? "" : "s"}</span>
            </h2>
            <BedLegend />
          </div>
          <div role="region" aria-label="Rooms and beds" tabIndex={0} className="min-h-0 overflow-y-auto lg:flex-1">
            {rooms.length === 0 ? (
              <EmptyState title="No rooms yet" action={<Button asChild variant="outline"><Link href="/admin/rooms">Add rooms</Link></Button>} />
            ) : (
              <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {rooms.map((room) => (
                  <li key={room.id} className="flex items-center gap-3">
                    <Link href={`/admin/rooms/${room.id}`} className="w-20 shrink-0 text-sm font-medium hover:underline">
                      {roomLabel(room.code)}
                    </Link>
                    <BedCells beds={room.beds} roomUnderMaintenance={room.status === "maintenance"} size="sm" />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section aria-labelledby="activity-heading" className="flex min-h-0 flex-col">
          <h2 id="activity-heading" className="mb-2 shrink-0 text-base font-semibold">
            Recent activity
          </h2>
          <div role="region" aria-labelledby="activity-heading" tabIndex={0} className="min-h-0 overflow-y-auto rounded-lg border border-border lg:flex-1">
            {d.activity.length === 0 ? (
              <p className="px-4 py-5 text-sm text-muted-foreground">Activity appears here as you and your boarders use Rentora.</p>
            ) : (
              <ul>
                {d.activity.map((a) => (
                  <li key={a.id} className="border-b border-rule px-4 py-2.5 last:border-0">
                    <p className="text-sm">
                      <span className="font-medium">{a.actor}</span> {a.action}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(a.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
