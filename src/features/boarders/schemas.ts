import { z } from "zod";
import { email, optionalText, phone, requiredText, uuid } from "@/lib/validation";

export const inviteSchema = z.object({
  fullName: requiredText("Full name", 120, 2),
  email,
  phone,
});

export const profileSchema = z.object({
  memberId: uuid,
  fullName: requiredText("Full name", 120, 2),
  phone,
  emergencyName: optionalText(120),
  emergencyPhone: phone,
});

export const notesSchema = z.object({
  memberId: uuid,
  notes: optionalText(2000),
});

export const memberRefSchema = z.object({ memberId: uuid });

export const archiveSchema = z.object({ memberId: uuid, archived: z.boolean() });
