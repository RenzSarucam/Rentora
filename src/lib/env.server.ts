import "server-only";
import { z } from "zod";

const serverSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(20),
});

let cached: z.infer<typeof serverSchema> | undefined;

/** Server-only secrets. Importing this from a Client Component fails the build ("server-only"). */
export function serverEnv() {
  if (cached) return cached;
  const parsed = serverSchema.safeParse({ SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY });
  if (!parsed.success) {
    throw new Error("Missing or invalid SUPABASE_SECRET_KEY. See .env.example.");
  }
  cached = parsed.data;
  return cached;
}
