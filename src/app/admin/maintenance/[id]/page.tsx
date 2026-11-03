import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, SectionHeader } from "@/components/app/page-header";
import { maintenanceStatus, StatusPill } from "@/components/app/status-pill";
import { ageLabel } from "@/features/maintenance/age";
import { getRequest } from "@/features/maintenance/queries";
import { CommentForm, StatusChangeForm } from "@/features/maintenance/request-controls";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { uuid } from "@/lib/validation";

export const metadata: Metadata = { title: "Maintenance request" };

export default async function MaintenanceRequestPage({ params }: PageProps<"/admin/maintenance/[id]">) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const req = await getRequest(id);
  if (!req) notFound();
  const s = maintenanceStatus(req.status);
  const closed = req.status === "resolved" || req.status === "cancelled";

  return (
    <>
      <PageHeader
        back={{ href: "/admin/maintenance", label: "Maintenance" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {req.title}
            <StatusPill tone={s.tone}>{s.label}</StatusPill>
            {req.priority === "urgent" && <StatusPill tone="negative">Urgent</StatusPill>}
          </span>
        }
        description={`${req.room ? `Room ${req.room}` : "No room on file"} · filed by ${req.boarder} ${ageLabel(req.createdAt).toLowerCase() === "today" ? "today" : `${ageLabel(req.createdAt)} ago`}`}
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="grid content-start gap-8">
          <section aria-labelledby="details-heading">
            <SectionHeader title={<span id="details-heading">What the boarder reported</span>} />
            <p className="text-[15px] leading-relaxed whitespace-pre-line">{req.description}</p>
            {req.photoUrl && (
              <a href={req.photoUrl} target="_blank" rel="noopener noreferrer" className="mt-4 block w-fit">
                {/* Signed URL from private storage; expires in 60 seconds. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={req.photoUrl} alt={`Photo attached to: ${req.title}`} className="max-h-96 rounded-lg border border-border object-contain" />
              </a>
            )}
          </section>

          <section aria-labelledby="timeline-heading">
            <SectionHeader title={<span id="timeline-heading">Timeline</span>} />
            <ol className="grid gap-0">
              <li className="relative border-l border-border pb-5 pl-5">
                <span className="absolute top-1.5 -left-[4.5px] size-2 rounded-full bg-control" aria-hidden />
                <p className="text-sm">
                  <span className="font-medium">{req.boarder}</span> filed the request
                </p>
                <p className="text-xs text-muted-foreground">{formatDateTime(req.createdAt)}</p>
              </li>
              {req.timeline.map((u) => (
                <li key={u.id} className="relative border-l border-border pb-5 pl-5 last:pb-0">
                  <span className={cn("absolute top-1.5 -left-[4.5px] size-2 rounded-full", u.statusTo ? "bg-teal" : "bg-control")} aria-hidden />
                  <p className="text-sm">
                    <span className="font-medium">{u.author}</span>
                    {u.statusTo && <span className="text-muted-foreground"> set status to {maintenanceStatus(u.statusTo).label.toLowerCase()}</span>}
                  </p>
                  <p className="mt-0.5 text-sm whitespace-pre-line">{u.body}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(u.createdAt)}</p>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="comment-heading">
            <h2 id="comment-heading" className="sr-only">Add an update</h2>
            <CommentForm requestId={req.id} />
          </section>
        </div>

        <aside className="grid content-start gap-6">
          <div className="rounded-lg border border-border p-5">
            <h2 className="mb-3 text-sm font-semibold">{closed ? "Reopen or change" : "Move it forward"}</h2>
            <StatusChangeForm requestId={req.id} current={req.status} />
          </div>
          <dl className="grid grid-cols-2 gap-y-3 text-sm">
            <dt className="text-muted-foreground">Boarder</dt>
            <dd className="text-right">
              <Link href={`/admin/boarders/${req.memberId}`} className="hover:underline">
                {req.boarder}
              </Link>
            </dd>
            <dt className="text-muted-foreground">Phone</dt>
            <dd className="text-right">
              {req.boarderPhone ? (
                <a href={`tel:${req.boarderPhone.replace(/\s/g, "")}`} className="num hover:underline">
                  {req.boarderPhone}
                </a>
              ) : (
                "—"
              )}
            </dd>
            <dt className="text-muted-foreground">Filed</dt>
            <dd className="text-right">{formatDateTime(req.createdAt)}</dd>
            <dt className="text-muted-foreground">Resolved</dt>
            <dd className="text-right">{formatDateTime(req.resolvedAt)}</dd>
          </dl>
        </aside>
      </div>
    </>
  );
}
