import type { Metadata } from "next";
import { roomLabel } from "@/lib/room-label";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { maintenanceStatus, StatusPill } from "@/components/app/status-pill";
import { CommentForm } from "@/features/boarder/comment-form";
import { getRequest } from "@/features/boarder/queries";
import { Card, CardHeading } from "@/features/boarder/ui";
import { requireBoarder } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/dates";
import { uuid } from "@/lib/validation";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Repair request" };

export default async function MaintenanceDetailPage({ params }: PageProps<"/boarder/maintenance/[id]">) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const viewer = await requireBoarder();
  const found = await getRequest(viewer, id);
  if (!found) notFound();
  const { request, updates, photoUrl } = found;
  const s = maintenanceStatus(request.status);
  const open = request.status === "open" || request.status === "in_progress";

  return (
    <div className="grid gap-4">
      <Link href="/boarder/maintenance" className="mt-1 inline-flex min-h-11 items-center gap-1 self-start text-sm text-muted-foreground">
        <ChevronLeft className="size-4" aria-hidden /> Repairs
      </Link>

      <Card>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-[22px] leading-tight font-semibold">{request.title}</h1>
          <StatusPill tone={s.tone}>{s.label}</StatusPill>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {request.rooms ? `${roomLabel(request.rooms.code)} · ` : ""}
          {formatDateTime(request.created_at)}
          {request.priority === "urgent" && <span className="text-negative"> · Urgent</span>}
        </p>
        <p className="mt-4 text-[15px] whitespace-pre-line">{request.description}</p>
        {photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private storage
          <img src={photoUrl} alt={`Photo for: ${request.title}`} className="mt-4 max-h-80 w-full rounded-xl bg-raised object-contain" />
        )}
      </Card>

      <Card>
        <CardHeading>Progress</CardHeading>
        <ol className="grid gap-4">
          <li className="flex gap-3">
            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-control" aria-hidden />
            <div>
              <p className="text-[15px]">You reported the problem</p>
              <p className="text-xs text-muted-foreground">{formatDateTime(request.created_at)}</p>
            </div>
          </li>
          {updates.map((u) => {
            const mine = u.author_id === viewer.userId;
            return (
              <li key={u.id} className="flex gap-3">
                <span
                  className={cn("mt-1.5 size-2 shrink-0 rounded-full", u.status_to === "resolved" ? "bg-positive" : u.status_to ? "bg-teal" : "bg-control")}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {mine ? "You" : "Landlord"}
                    {u.status_to && <span className="font-normal text-muted-foreground"> · marked {maintenanceStatus(u.status_to).label.toLowerCase()}</span>}
                  </p>
                  <p className="text-[15px] whitespace-pre-line">{u.body}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(u.created_at)}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </Card>

      {open && viewer.status !== "archived" && (
        <Card>
          <CommentForm requestId={request.id} />
        </Card>
      )}
    </div>
  );
}
