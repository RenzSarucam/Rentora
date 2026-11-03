import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export type Limit = { name: string; max: number; windowSeconds: number };

export const LIMITS = {
  login: { name: "login", max: 8, windowSeconds: 15 * 60 },
  passwordReset: { name: "password-reset", max: 3, windowSeconds: 60 * 60 },
  invite: { name: "invite", max: 30, windowSeconds: 60 * 60 },
  paymentSubmission: { name: "payment-submission", max: 10, windowSeconds: 60 * 60 },
  maintenance: { name: "maintenance", max: 10, windowSeconds: 60 * 60 },
} satisfies Record<string, Limit>;

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

/**
 * Durable fixed-window limiter backed by Postgres (works across serverless instances).
 * Keys are hashed so no email or IP is stored. Fails open on infrastructure errors:
 * Supabase Auth applies its own limits behind this one.
 */
export async function rateLimit(limit: Limit, ...parts: string[]): Promise<boolean> {
  const key = `${limit.name}:${createHash("sha256").update(parts.join("|").toLowerCase()).digest("hex")}`;
  try {
    const { data, error } = await createAdminClient().rpc("rate_limit_hit", {
      p_key: key,
      p_max: limit.max,
      p_window_seconds: limit.windowSeconds,
    });
    if (error) {
      console.error("rate limit check failed", error.code);
      return true;
    }
    return data === true;
  } catch {
    console.error("rate limit check failed");
    return true;
  }
}
