import { expect, test, type Page } from "@playwright/test";

/**
 * End-to-end flows against a REAL Supabase dev project seeded with `npm run seed:demo -- --dev`.
 * Enabled only when E2E_SUPABASE=1 and the NEXT_PUBLIC_SUPABASE_* / SUPABASE_SECRET_KEY env vars point at that project.
 */
test.skip(process.env.E2E_SUPABASE !== "1", "Needs a seeded Supabase dev project (E2E_SUPABASE=1).");

const PASSWORD = "DemoPass2026";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("admin signs in and sees real figures", async ({ page }) => {
  await signIn(page, "owner@demo.rentora.test");
  await expect(page).toHaveURL(/\/admin\/dashboard/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("Occupancy")).toBeVisible();
  await page.goto("/admin/rooms");
  await expect(page.getByRole("link", { name: "Room 101" })).toBeVisible();
});

test("a boarder cannot open admin pages", async ({ page }) => {
  await signIn(page, "ana.reyes@demo.rentora.test");
  await expect(page).toHaveURL(/\/boarder\/home/);
  await page.goto("/admin/dashboard");
  await expect(page).toHaveURL(/\/boarder\/home/);
  await page.goto("/admin/billing");
  await expect(page).toHaveURL(/\/boarder\/home/);
});

test("a boarder sees only their own bills", async ({ page }) => {
  await signIn(page, "ana.reyes@demo.rentora.test");
  await page.goto("/boarder/bills");
  await expect(page.getByText("Paolo Cruz")).toHaveCount(0);
  await expect(page.getByText("Jasmine Villanueva")).toHaveCount(0);
});

test("the boarder app uses bottom navigation on phones", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile only");
  await signIn(page, "paolo.cruz@demo.rentora.test");
  const nav = page.getByRole("navigation", { name: "Boarder" });
  await expect(nav).toBeVisible();
  for (const [label, url] of [
    ["Bills", /\/boarder\/bills/],
    ["Payments", /\/boarder\/payment-history/],
    ["Repairs", /\/boarder\/maintenance/],
    ["Me", /\/boarder\/profile/],
    ["Home", /\/boarder\/home/],
  ] as const) {
    await nav.getByRole("link", { name: label }).click();
    await expect(page).toHaveURL(url);
  }
});

test("an admin cannot open the boarder app", async ({ page }) => {
  await signIn(page, "owner@demo.rentora.test");
  await page.goto("/boarder/home");
  await expect(page).toHaveURL(/\/admin\/dashboard/);
});
