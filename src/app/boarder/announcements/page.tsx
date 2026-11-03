import type { Metadata } from "next";
import { StatusPill } from "@/components/app/status-pill";
import { listAnnouncements } from "@/features/boarder/queries";
import { Card, Empty, ScreenTitle } from "@/features/boarder/ui";
import { requireBoarder } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/dates";

export const metadata: Metadata = { title: "Announcements" };

export default async function AnnouncementsPage() {
  await requireBoarder();
  const announcements = await listAnnouncements();

  return (
    <>
      <ScreenTitle>Announcements</ScreenTitle>
      {announcements.length === 0 ? (
        <Card>
          <Empty>No announcements yet. Notices about water, power, visitors or house rules will appear here.</Empty>
        </Card>
      ) : (
        <div className="grid gap-4">
          {announcements.map((a) => (
            <Card key={a.id} id={a.id} className="scroll-mt-20" aria-labelledby={`a-${a.id}`}>
              <div className="flex items-start justify-between gap-3">
                <h2 id={`a-${a.id}`} className="text-lg leading-snug font-semibold">
                  {a.title}
                </h2>
                {a.pinned && <StatusPill tone="accent">Pinned</StatusPill>}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(a.published_at)}</p>
              {/* Rendered as plain text: announcement bodies never become HTML. */}
              <p className="mt-3 text-[15px] leading-relaxed whitespace-pre-line">{a.body}</p>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
