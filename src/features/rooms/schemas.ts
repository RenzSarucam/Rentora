import { z } from "zod";
import { optionalText, pesoAmount, requiredText, uuid } from "@/lib/validation";

export const roomSchema = z.object({
  propertyId: uuid,
  code: requiredText("Room number", 20),
  floor: optionalText(20),
  capacity: z.coerce.number({ message: "Enter the number of beds." }).int().min(1, { message: "At least 1 bed." }).max(20, { message: "At most 20 beds." }),
  rate: pesoAmount({ allowZero: true }),
  notes: optionalText(2000),
});

export const roomUpdateSchema = roomSchema.omit({ propertyId: true }).extend({ id: uuid });

export const bedSchema = z.object({
  roomId: uuid,
  label: requiredText("Bed label", 20),
  rate: pesoAmount({ allowZero: true }),
});

export const bedUpdateSchema = bedSchema.omit({ roomId: true }).extend({ id: uuid });

export type RoomInput = z.input<typeof roomSchema>;
export type BedInput = z.input<typeof bedSchema>;
