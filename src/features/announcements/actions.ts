"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/session";
import { dbFail, ok, validationFail, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { announcementFlagSchema, announcementSchema } from "./schemas";

function refresh() {
  revalidatePath("/admin/announcements");
  revalidatePath("/boarder/home");
  revalidatePath("/boarder/announcements");
}

export async function saveAnnouncement(input: unknown): Promise<ActionResult<null>> {
  const viewer = await requireStaff();
  const parsed = announcementSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();

  if (v.id) {
    const { data: current } = await supabase
      .from("announcements")
      .select("published_at")
      .eq("id", v.id)
      .maybeSingle<{ published_at: string | null }>();
    const published_at = v.publish ? (current?.published_at ?? new Date().toISOString()) : null;
    const { error } = await supabase
      .from("announcements")
      .update({ title: v.title, body: v.body, pinned: v.pinned, published_at })
      .eq("id", v.id);
    if (error) return dbFail(error);
    refresh();
    return ok(null, "Announcement saved.");
  }

  const { error } = await supabase.from("announcements").insert({
    organization_id: viewer.orgId,
    title: v.title,
    body: v.body,
    pinned: v.pinned,
    published_at: v.publish ? new Date().toISOString() : null,
  });
  if (error) return dbFail(error);
  refresh();
  return ok(null, v.publish ? "Published. Boarders see it on their home screen." : "Saved as a draft.");
}

export async function changeAnnouncement(input: unknown): Promise<ActionResult<null>> {
  await requireStaff();
  const parsed = announcementFlagSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const { id, change } = parsed.data;
  const patch =
    change === "publish"
      ? { published_at: new Date().toISOString() }
      : change === "unpublish"
        ? { published_at: null }
        : change === "pin"
          ? { pinned: true }
          : change === "unpin"
            ? { pinned: false }
            : { archived_at: new Date().toISOString(), pinned: false };
  const supabase = await createClient();
  const { error } = await supabase.from("announcements").update(patch).eq("id", id);
  if (error) return dbFail(error);
  refresh();
  const messages = {
    publish: "Published.",
    unpublish: "Moved back to drafts.",
    pin: "Pinned to the top.",
    unpin: "Unpinned.",
    archive: "Archived. Boarders no longer see it.",
  };
  return ok(null, messages[change]);
}
