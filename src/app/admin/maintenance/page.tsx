import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { maintenanceStatus, StatusPill } from "@/components/app/status-pill";
import { ageLabel } from "@/features/maintenance/age";
import { LinkTabs } from "@/features/maintenance/link-tabs";
import { listRequests, type MaintenanceStatus } from "@/features/maintenance/queries";
import { manilaToday } from "@/lib/dates";

export const metadata: Metadata = { title: "Maintenance" };

const TABS: { key: string; label: string; statuses: MaintenanceStatus[] | null }[] = [
  { key: "open", label: "Open", statuses: ["open"] },
  { key: "in_progress", label: "In progress", statuses: ["in_progress"] },
  { key: "resolved", label: "Resolved", statuses: ["resolved"] },
  { key: "all", label: "All", statuses: null },
];

export default async function MaintenancePage({ searchParams }: PageProps<"/admin/maintenance">) {
  const params = await searchParams;
  const active = TABS.find((t) => t.key === params.status) ?? TABS[0];
  const requests = await listRequests();
  const today = manilaToday();
  const inTab = (statuses: MaintenanceStatus[] | null) => requests.filter((r) => !statuses || statuses.includes(r.status));
  const rows = inTab(active.statuses).sort(
    (a, b) => Number(b.priority === "urgent") - Number(a.priority === "urgent") || b.createdAt.localeCompare(a.createdAt),
  );
  const waiting = requests.filter((r) => r.status === "open" || r.status === "in_progress");
  const urgent = waiting.filter((r) => r.priority === "urgent").length;

  return (
    <>
      <PageHeader
        title="Maintenance"
        description={
          waiting.length
            ? `${waiting.length} request${waiting.length === 1 ? "" : "s"} waiting on you${urgent ? `, ${urgent} urgent` : ""}`
            : "Nothing waiting. Boarders file requests from their phones."
        }
      />
      <LinkTabs
        label="Filter by status"
        tabs={TABS.map((t) => ({
          href: t.key === "open" ? "/admin/maintenance" : `/admin/maintenance?status=${t.key}`,
          label: t.label,
          count: inTab(t.statuses).length,
          active: t.key === active.key,
        }))}
      />
      {rows.length === 0 ? (
        <EmptyState title={active.key === "all" ? "No requests yet" : `No ${active.label.toLowerCase()} requests`}>
          When a boarder reports a problem, it shows up here with their room and photo.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th scope="col" className="h-10 pr-3 font-medium">Request</th>
                <th scope="col" className="px-3 font-medium">Boarder</th>
                <th scope="col" className="px-3 font-medium">Room</th>
                <th scope="col" className="px-3 font-medium">Priority</th>
                <th scope="col" className="px-3 text-right font-medium">Age</th>
                <th scope="col" className="pl-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const s = maintenanceStatus(r.status);
                return (
                  <tr key={r.id} className="border-b border-rule hover:bg-raised/60">
                    <td className="py-3 pr-3">
                      <Link href={`/admin/maintenance/${r.id}`} className="font-medium hover:underline">
                        {r.title}
                      </Link>
                    </td>
                    <td className="px-3">{r.boarder}</td>
                    <td className="px-3 text-muted-foreground">{r.room ? `Room ${r.room}` : "—"}</td>
                    <td className="px-3">
                      {r.priority === "urgent" ? (
                        <StatusPill tone="negative">Urgent</StatusPill>
                      ) : (
                        <span className="text-muted-foreground">{r.priority === "low" ? "Low" : "Normal"}</span>
                      )}
                    </td>
                    <td className="num px-3 text-right text-muted-foreground">{ageLabel(r.createdAt, today)}</td>
                    <td className="pl-3">
                      <StatusPill tone={s.tone}>{s.label}</StatusPill>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
