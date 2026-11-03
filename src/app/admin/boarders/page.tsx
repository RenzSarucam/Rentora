import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { BoardersTable } from "@/features/boarders/boarders-table";
import { InviteDialog } from "@/features/boarders/invite-dialog";
import { listBoarders } from "@/features/boarders/queries";
import { formatPeso } from "@/lib/money";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Boarders" };

export default async function BoardersPage({ searchParams }: PageProps<"/admin/boarders">) {
  const { view } = await searchParams;
  const archivedView = view === "archived";
  const all = await listBoarders();
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
