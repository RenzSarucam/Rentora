import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * End-to-end flows against a REAL Supabase dev project seeded with `npm run seed:demo -- --dev`.
 * Enabled only when E2E_SUPABASE=1 and the NEXT_PUBLIC_SUPABASE_* / SUPABASE_SECRET_KEY env vars point at that project.
 */
test.skip(process.env.E2E_SUPABASE !== "1", "Needs a seeded Supabase dev project (E2E_SUPABASE=1).");
test.setTimeout(120_000);
test.use({ actionTimeout: 20_000 });

const PASSWORD = "DemoPass2026";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(email === "admin@demo.rentora" ? /\/admin\/dashboard$/ : /\/boarder\/home$/, { timeout: 30_000 });
}

async function capture(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await info.attach(name, { path, contentType: "image/png" });
}

async function boarderData(email: string) {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error: authError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  expect(authError).toBeNull();
  const member = await client.from("organization_members").select("id").eq("user_id", auth.user!.id).single();
  expect(member.error).toBeNull();
  const [invoices, payments] = await Promise.all([
    client.from("invoices").select("id, member_id, invoice_number"),
    client.from("payments").select("id, member_id, receipt_number"),
  ]);
  expect(invoices.error).toBeNull();
  expect(payments.error).toBeNull();
  expect(invoices.data!.length).toBeGreaterThan(0);
  expect(payments.data!.length).toBeGreaterThan(0);
  for (const row of [...invoices.data!, ...payments.data!]) expect(row.member_id).toBe(member.data!.id);
  return { invoices: invoices.data!, payments: payments.data! };
}

test("admin signs in and opens every screen with real data", async ({ page }, info) => {
  await signIn(page, "admin@demo.rentora");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("Occupancy")).toBeVisible();
  await expect(page.getByText("5 of 11 beds occupied", { exact: true })).toBeVisible();
  await capture(page, info, "admin-dashboard");

  for (const [route, heading] of [
    ["rooms", "Rooms & beds"], ["boarders", "Boarders"], ["assignments", "Assignments"],
    ["billing", "Billing"], ["payments", "Payments"], ["maintenance", "Maintenance"],
    ["announcements", "Announcements"], ["reports", "Reports"], ["settings", "Settings"],
    ["settings/audit", "Activity log"],
  ]) {
    await test.step(route, async () => {
      await page.goto(`/admin/${route}`);
      await expect(page.getByRole("heading", { name: heading, exact: true, level: 1 })).toBeVisible();
      await capture(page, info, `admin-${route.replaceAll("/", "-")}`);
    });
  }

  await page.goto("/admin/rooms");
  await page.getByRole("link", { name: "Room 101", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Room 101/, level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ana Reyes", exact: true })).toBeVisible();

  await page.goto("/admin/boarders");
  await page.getByRole("link", { name: "Ana Reyes", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Ana Reyes/, level: 1 })).toBeVisible();
  await page.locator('a[href^="/admin/billing/"]').first().click();
  await expect(page.getByRole("heading", { name: /INV-/, level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Charges", exact: true })).toBeVisible();

  await page.goto("/admin/payments");
  await page.getByRole("tab", { name: "History", exact: true }).click();
  await page.locator('a[href^="/receipts/"]').first().click();
  await expect(page.getByRole("heading", { name: "Payment receipt", exact: true })).toBeVisible();

  await page.goto("/admin/maintenance");
  await page.getByRole("link", { name: /Aircon not cooling/ }).click();
  await expect(page.getByRole("heading", { name: /Aircon not cooling/, level: 1 })).toBeVisible();

  for (const kind of ["collections", "outstanding", "overdue", "occupancy", "payments"]) {
    const response = await page.request.get(`/admin/reports/export/${kind}?from=2026-09-01&to=2026-10-31`);
    expect(response.status(), kind).toBe(200);
    expect(response.headers()["content-type"], kind).toContain("text/csv");
    expect((await response.text()).split("\n").length, kind).toBeGreaterThan(1);
  }
});

test("a boarder cannot open admin pages", async ({ page }) => {
  await signIn(page, "boarder1@demo.rentora");
  await expect(page).toHaveURL(/\/boarder\/home/);
  await page.goto("/admin/dashboard");
  await expect(page).toHaveURL(/\/boarder\/home/);
  await page.goto("/admin/billing");
  await expect(page).toHaveURL(/\/boarder\/home/);
});

test("a boarder sees their own bills and cannot open another boarder's bills or receipts", async ({ page }, info) => {
  const [own, other] = await Promise.all([
    boarderData("boarder1@demo.rentora"), boarderData("boarder2@demo.rentora"),
  ]);
  await signIn(page, "boarder1@demo.rentora");
  await expect(page.getByRole("heading", { name: "Ana", exact: true })).toBeVisible();
  await capture(page, info, "boarder-home");

  for (const [route, heading] of [
    ["my-room", "My room"], ["bills", "Bills"], ["payment-history", "Payments"],
    ["maintenance", "Repairs"], ["maintenance/new", "Report a problem"],
    ["announcements", "Announcements"], ["profile", "Ana Reyes"],
  ]) {
    await test.step(route, async () => {
      await page.goto(`/boarder/${route}`);
      await expect(page.getByRole("heading", { name: heading, exact: true, level: 1 })).toBeVisible();
      await capture(page, info, `boarder-${route.replaceAll("/", "-")}`);
    });
  }

  await page.goto("/boarder/my-room");
  await expect(page.getByText("Room 101", { exact: true })).toBeVisible();
  await expect(page.getByText("Bed A", { exact: true })).toBeVisible();
  await page.goto("/boarder/bills");
  await expect(page.getByRole("heading", { name: "Bills", exact: true, level: 1 })).toBeVisible();
  for (const invoice of own.invoices) await expect(page.locator(`a[href="/boarder/bills/${invoice.id}"]`)).toBeVisible();
  for (const invoice of other.invoices) await expect(page.locator(`a[href="/boarder/bills/${invoice.id}"]`)).toHaveCount(0);
  await expect(page.getByText("Paolo Cruz")).toHaveCount(0);
  await expect(page.getByText("Jasmine Villanueva")).toHaveCount(0);

  await page.goto(`/boarder/bills/${own.invoices[0].id}`);
  await expect(page.getByText(own.invoices[0].invoice_number, { exact: true })).toBeVisible();
  await page.goto(`/receipts/${own.payments[0].id}`);
  await expect(page.getByRole("heading", { name: "Payment receipt", exact: true })).toBeVisible();
  await expect(page.getByText("Ana Reyes", { exact: true })).toBeVisible();

  for (const path of [`/boarder/bills/${other.invoices[0].id}`, `/receipts/${other.payments[0].id}`]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "This page does not exist", exact: true })).toBeVisible();
  }
});

test("the boarder app uses bottom navigation on phones", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile only");
  await signIn(page, "boarder2@demo.rentora");
  const nav = page.getByRole("navigation", { name: "Boarder" });
  await expect(nav).toBeVisible();
  for (const [label, url] of [
    ["Bills", /\/boarder\/bills/],
    ["Payments", /\/boarder\/payment-history/],
    ["Repairs", /\/boarder\/maintenance/],
    ["Me", /\/boarder\/profile/],
    ["Home", /\/boarder\/home/],
  ] as const) {
    await nav.getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(url);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
  await page.goto("/boarder/maintenance");
  await page.getByRole("link", { name: /Aircon not cooling/ }).click();
  await expect(page.getByRole("heading", { name: "Aircon not cooling", exact: true })).toBeVisible();
});

test("an admin cannot open the boarder app", async ({ page }) => {
  await signIn(page, "admin@demo.rentora");
  await page.goto("/boarder/home");
  await expect(page).toHaveURL(/\/admin\/dashboard/);
});
