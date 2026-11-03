import { z } from "zod";
import { optionalText, requiredText, uuid } from "@/lib/validation";

export const orgSchema = z.object({
  name: requiredText("Business name", 120, 2),
  defaultDueDay: z.coerce
    .number({ message: "Enter a day of the month." })
    .int()
    .min(1, { message: "Use a day from 1 to 28." })
    .max(28, { message: "Use a day from 1 to 28 so every month has it." }),
});

export const propertySchema = z.object({
  id: uuid.optional().or(z.literal("").transform(() => undefined)),
  name: requiredText("Property name", 120),
  address: optionalText(300),
});
