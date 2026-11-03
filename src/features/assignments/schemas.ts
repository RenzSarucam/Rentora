import { z } from "zod";
import { isoDate, optionalText, pesoAmount, uuid } from "@/lib/validation";

export const assignSchema = z.object({
  memberId: uuid,
  bedId: uuid,
  moveIn: isoDate,
  rent: pesoAmount({ allowZero: true }),
});

export const transferSchema = z.object({
  memberId: uuid,
  bedId: uuid,
  date: isoDate,
  rent: pesoAmount({ allowZero: true }),
});

export const endSchema = z.object({
  assignmentId: uuid,
  moveOut: isoDate,
  reason: optionalText(300),
});

export const rentSchema = z.object({
  assignmentId: uuid,
  rent: pesoAmount({ allowZero: true }),
});
