import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { maintenanceStatus, StatusPill } from "@/components/app/status-pill";
import { listRequests } from "@/features/boarder/queries";
import { Card, Empty, List, RowLink, ScreenTitle } from "@/features/boarder/ui";
import { requireBoarder } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Repairs" };

export default async function MaintenancePage() {
  const viewer = await requireBoarder();
  const requests = await listRequests(viewer);
  const active = requests.filter((r) => r.status === "open" || r.status === "in_progress");
  const closed = requests.filter((r) => !active.includes(r));

  const row = (r: (typeof requests)[number]) => {
    const s = maintenanceStatus(r.status);
    return (
      <li key={r.id}>
        <RowLink href={`/boarder/maintenance/${r.id}`} trailing={<StatusPill tone={s.tone}>{s.label}</StatusPill>}>
          <span className="block truncate text-[15px]">{r.title}</span>
          <span className="block text-sm text-muted-foreground">
            {formatDate(r.created_at.slice(0, 10))}
            {r.priority === "urgent" && <span className="text-negative"> · Urgent</span>}
          </span>
        </RowLink>
      </li>
    );
  };

  return (
    <>
      <ScreenTitle sub={active.length ? `${active.length} being worked on` : undefined}>Repairs</ScreenTitle>
      {viewer.status !== "archived" && (
        <Button asChild className="mb-4 h-12 w-full rounded-xl text-[15px]">
          <Link href="/boarder/maintenance/new">
            <Plus aria-hidden /> Report a problem
          </Link>
        </Button>
      )}
      <Card>
        {requests.length === 0 ? (
          <Empty>No repair requests. If something in your room breaks, report it here with a photo.</Empty>
        ) : (
          <List>
            {active.map(row)}
            {closed.map(row)}
          </List>
        )}
      </Card>
    </>
  );
}
