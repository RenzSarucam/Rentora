import type { Metadata } from "next";
import { ActionButton } from "@/components/app/action-button";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/app/status-pill";
import { changeAnnouncement } from "@/features/announcements/actions";
import { AnnouncementDialog } from "@/features/announcements/announcement-dialog";
import { announcementState, listAnnouncements } from "@/features/announcements/queries";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Announcements" };

const STATE_PILL = {
  draft: { label: "Draft", tone: "neutral" },
  published: { label: "Published", tone: "positive" },
  archived: { label: "Archived", tone: "neutral" },
} as const;

export default async function AnnouncementsPage() {
  const announcements = await listAnnouncements();
  const live = announcements.filter((a) => announcementState(a) === "published").length;

  return (
    <>
      <PageHeader
        title="Announcements"
        description={announcements.length ? `${live} visible to boarders now` : "Tell every boarder at once: water cuts, house rules, rent reminders."}
        actions={<AnnouncementDialog />}
      />
      {announcements.length === 0 ? (
        <EmptyState title="No announcements yet" action={<AnnouncementDialog />}>
          Your first notice appears on each boarder&apos;s home screen as soon as you publish it.
        </EmptyState>
      ) : (
        <ul className="grid max-w-3xl gap-0">
          {announcements.map((a) => {
            const state = announcementState(a);
            const pill = STATE_PILL[state];
            return (
              <li key={a.id} className={cn("border-b border-rule py-5 first:pt-0", state === "archived" && "opacity-70")}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
                      {a.title}
                      <StatusPill tone={pill.tone}>{pill.label}</StatusPill>
                      {a.pinned && <StatusPill tone="accent">Pinned</StatusPill>}
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {state === "published" ? `Published ${formatDateTime(a.publishedAt)}` : `Last edited ${formatDateTime(a.updatedAt)}`}
                    </p>
                  </div>
                  {state !== "archived" && (
                    <div className="flex flex-wrap gap-1">
                      <AnnouncementDialog announcement={a} />
                      <ActionButton variant="ghost" size="sm" action={changeAnnouncement} input={{ id: a.id, change: a.pinned ? "unpin" : "pin" }}>
                        {a.pinned ? "Unpin" : "Pin"}
                      </ActionButton>
                      <ActionButton
                        variant="ghost"
                        size="sm"
                        action={changeAnnouncement}
                        input={{ id: a.id, change: state === "published" ? "unpublish" : "publish" }}
                      >
                        {state === "published" ? "Unpublish" : "Publish"}
                      </ActionButton>
                      <ActionButton
                        variant="ghost"
                        size="sm"
                        action={changeAnnouncement}
                        input={{ id: a.id, change: "archive" }}
                        confirm={{
                          title: "Archive this announcement?",
                          description: "Boarders will no longer see it. It stays here for your records.",
                          confirmLabel: "Archive",
                          destructive: true,
                        }}
                      >
                        Archive
                      </ActionButton>
                    </div>
                  )}
                </div>
                {/* Plain text only: rendered as text, never as HTML. */}
                <p className="mt-2 text-sm leading-relaxed whitespace-pre-line">{a.body}</p>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
