import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

// Only live-backend runs load local credentials; signed-out checks keep their isolated defaults.
if (process.env.E2E_SUPABASE === "1") {
  config({ path: ".env.local", quiet: true });
  config({ quiet: true });
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY"]) {
    if (!process.env[key]) throw new Error(`Live Supabase tests require ${key}.`);
  }
}

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;
// Uses the system Edge/Chrome so no browser download is needed. Override with E2E_CHANNEL=chromium after `npx playwright install`.
const channel = process.env.E2E_CHANNEL ?? "msedge";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel, viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"], channel } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // Production build against an unreachable Supabase URL unless real E2E env vars are provided:
        // every protected route must still refuse access.
        command: `npx next start -p ${PORT}`,
        url: `${baseURL}/login`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:59999",
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_e2e_placeholder_key",
          NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? baseURL,
          SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY ?? "e2e-placeholder-secret-not-real",
        },
      },
});
