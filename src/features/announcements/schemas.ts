import { z } from "zod";
import { requiredText, uuid } from "@/lib/validation";

export const announcementSchema = z.object({
  id: uuid.optional().or(z.literal("").transform(() => undefined)),
  title: requiredText("Title", 140, 3),
  body: requiredText("Message", 5000),
  pinned: z.boolean().default(false),
  publish: z.boolean().default(true),
});

export const announcementFlagSchema = z.object({
  id: uuid,
  change: z.enum(["publish", "unpublish", "pin", "unpin", "archive"]),
});
