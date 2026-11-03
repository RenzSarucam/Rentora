import { z } from "zod";
import { optionalText, requiredText, uuid } from "@/lib/validation";

export const maintenanceStatuses = ["open", "in_progress", "resolved", "cancelled"] as const;

export const statusChangeSchema = z.object({
  requestId: uuid,
  status: z.enum(maintenanceStatuses, { message: "Choose a status." }),
  note: optionalText(2000),
});

export const commentSchema = z.object({
  requestId: uuid,
  body: requiredText("Update", 2000),
});
