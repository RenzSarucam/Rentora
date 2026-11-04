import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { BoardersTable } from "@/features/boarders/boarders-table";
import { ActionButton } from "@/components/app/action-button";
import { finishBoarderDeletion } from "@/features/boarders/deletion-actions";
import { InviteDialog } from "@/features/boarders/invite-dialog";
import { listBoarders, listPendingBoarderDeletions } from "@/features/boarders/queries";
import { requireStaff } from "@/lib/auth/session";
import { formatPeso } from "@/lib/money";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Boarders" };

export default async function BoardersPage({ searchParams }: PageProps<"/admin/boarders">) {
  const viewer = await requireStaff();
  const { view, deletion } = await searchParams;
  const archivedView = view === "archived";
  const [all, pendingDeletions] = await Promise.all([listBoarders(), viewer.role === "owner" ? listPendingBoarderDeletions() : Promise.resolve([])]);
  const current = all.filter((b) => b.status !== "archived");
  const archived = all.filter((b) => b.status === "archived");
  const shown = archivedView ? archived : current;

  const invited = current.filter((b) => b.status === "invited").length;
  const withoutBed = current.filter((b) => !b.bed).length;
  const owed = current.reduce((s, b) => s + b.outstanding, 0);

  const tabs = [
    { href: "/admin/boarders", label: "Current", count: current.length, active: !archivedView },
    { href: "/admin/boarders?view=archived", label: "Archived", count: archived.length, active: archivedView },
  ];

  return (
    <>
      <PageHeader
        title="Boarders"
        description={
          current.length
            ? [
                `${current.length} current`,
                invited ? `${invited} yet to accept their invite` : null,
                withoutBed ? `${withoutBed} without a bed` : null,
                owed ? `${formatPeso(owed)} unpaid` : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : "Invite your boarders so they can see their bills and send payment proofs."
        }
        actions={<InviteDialog />}
      />

      {deletion === "complete" && <p role="status" className="mb-5 rounded-lg border border-border p-4 text-sm">Boarder, login and linked data permanently deleted.</p>}
      {pendingDeletions.length > 0 && (
        <section aria-labelledby="pending-deletion-title" className="mb-5 rounded-lg border border-border p-4">
          <h2 id="pending-deletion-title" className="text-sm font-medium">Finish boarder deletion</h2>
          <p className="mt-1 text-sm text-muted-foreground">Their app records are removed. Complete the remaining file and login cleanup.</p>
          <ul className="mt-3 divide-y divide-border">
            {pendingDeletions.map((job) => (
              <li key={job.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="min-w-0 break-words text-sm">{job.display_name || "Boarder"}</span>
                <ActionButton action={finishBoarderDeletion} input={{ jobId: job.id }}>Finish deletion</ActionButton>
              </li>
            ))}
          </ul>
        </section>
      )}

      <nav aria-label="Boarder lists" className="mb-5 flex gap-6 border-b border-border">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={t.active ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 border-transparent pb-2.5 text-sm text-muted-foreground hover:text-foreground",
              t.active && "border-foreground font-medium text-foreground",
            )}
          >
            {t.label} <span className="num text-muted-foreground">{t.count}</span>
          </Link>
        ))}
      </nav>

      <BoardersTable
        boarders={shown}
        emptyMessage={
          archivedView ? "No archived boarders. Boarders you archive after move-out appear here with their history." : "No boarders yet. Use Invite boarder to add your first one."
        }
      />
    </>
  );
}
