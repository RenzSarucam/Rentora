import { expect, test } from "@playwright/test";

const ADMIN = ["dashboard", "rooms", "boarders", "assignments", "billing", "payments", "maintenance", "announcements", "reports", "settings"].map(
  (p) => `/admin/${p}`,
);
const BOARDER = ["home", "my-room", "bills", "payment-history", "maintenance", "announcements", "profile"].map((p) => `/boarder/${p}`);

test.describe("signed-out visitors", () => {
  for (const path of [...ADMIN, ...BOARDER]) {
    test(`${path} redirects to sign-in`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path).replace(/%2F/g, "(%2F|/)")}`));
      await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    });
  }

  test("deep links and receipts are protected too", async ({ page }) => {
    await page.goto("/admin/rooms/00000000-0000-0000-0000-000000000000");
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/receipts/00000000-0000-0000-0000-000000000000");
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/boarder/announcements/00000000-0000-0000-0000-000000000000");
    await expect(page).toHaveURL(/\/login/);
  });

  test("CSV exports refuse anonymous requests", async ({ request }) => {
    const res = await request.get("/admin/reports/export/payments", { maxRedirects: 0 });
    expect([302, 303, 307, 401, 403]).toContain(res.status());
    expect(res.headers()["content-type"] ?? "").not.toContain("text/csv");
  });

  test("the root sends visitors to sign-in", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("request security", () => {
  test("pages carry a nonce CSP and hardening headers", async ({ request }) => {
    const res = await request.get("/login");
    const h = res.headers();
    expect(h["content-security-policy"]).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["content-security-policy"]).not.toContain("unsafe-eval");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["strict-transport-security"]).toContain("max-age=");
    expect(h["x-powered-by"]).toBeUndefined();
  });

  test("sign-out rejects cross-site POSTs (CSRF)", async ({ request }) => {
    const forged = await request.post("/auth/signout", { headers: { origin: "https://evil.example" }, maxRedirects: 0 });
    expect(forged.status()).toBe(403);
    const noOrigin = await request.post("/auth/signout", { maxRedirects: 0 });
    expect(noOrigin.status()).toBe(403);
  });

  test("auth redirects keep the browser's origin", async ({ request, baseURL }) => {
    const signout = await request.post("/auth/signout", { headers: { origin: baseURL! }, maxRedirects: 0 });
    expect(signout.status()).toBe(303);
    expect(signout.headers().location).toBe("/login");
    const confirm = await request.get("/auth/confirm?token_hash=forged&type=recovery", { maxRedirects: 0 });
    expect(confirm.status()).toBe(303);
    expect(confirm.headers().location).toBe("/login?error=link");
  });

  test("an invalid email link lands on sign-in with an error", async ({ page }) => {
    await page.goto("/auth/confirm?token_hash=forged&type=recovery&next=https://evil.example");
    await expect(page).toHaveURL(/\/login\?error=link/);
    await expect(page.getByText("That link is invalid or has expired.")).toBeVisible();
  });

  test("open redirects through ?next are ignored", async ({ page }) => {
    await page.goto("/login?next=//evil.example");
    await expect(page).toHaveURL(/localhost/);
  });

  test("source and env files are not served", async ({ request }) => {
    for (const path of ["/.env", "/.env.local", "/supabase/migrations/20261031000001_core_schema.sql", "/package.json", "/src/proxy.ts"]) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(404);
    }
  });
});

test.describe("sign-in form", () => {
  test("validates before calling the server", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
    await expect(page.getByText("Enter your password.")).toBeVisible();
  });

  test("password reset never reveals whether an account exists", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill("nobody@example.com");
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByRole("status")).toContainText("If an account uses that email");
  });
});

test.describe("PWA", () => {
  test("serves an installable manifest and a service worker", async ({ request }) => {
    const manifest = await (await request.get("/manifest.webmanifest")).json();
    expect(manifest.start_url).toBe("/boarder/home");
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons.some((i: { sizes: string }) => i.sizes === "512x512")).toBe(true);
    const sw = await request.get("/sw.js");
    expect(sw.status()).toBe(200);
    expect(sw.headers()["cache-control"]).toContain("no-cache");
  });

  test("offline page renders without user data", async ({ page }) => {
    await page.goto("/offline");
    await expect(page.getByRole("heading")).toBeVisible();
  });
});
