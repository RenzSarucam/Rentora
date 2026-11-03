"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireBoarder } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { dbFail, ok, validationFail, type ActionResult } from "@/lib/errors";
import { uuid } from "@/lib/validation";

const readSchema = z.object({ id: uuid, publishedAt: z.iso.datetime({ offset: true }) });

export async function markAnnouncementRead(input: unknown): Promise<ActionResult<null>> {
  await requireBoarder();
  const parsed = readSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_announcement_read", {
    p_announcement: parsed.data.id, p_published_at: parsed.data.publishedAt,
  });
  if (error) return dbFail(error);
  revalidatePath("/boarder", "layout");
  return ok(null);
}
