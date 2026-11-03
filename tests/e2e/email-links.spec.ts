import { expect, test } from "@playwright/test";

test("default email links pass fragments to the browser without putting tokens in redirects", async ({ request }) => {
  const response = await request.get("/auth/confirm?next=https://evil.example", { maxRedirects: 0 });
  expect(response.status()).toBe(303);
  expect(response.headers().location).toBe("/auth/callback?next=%2F");
});

test("missing and expired default email sessions stay signed out", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/auth/callback", { waitUntil: "commit" });
  await expect(page).toHaveURL(/\/login\?error=link$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible({ timeout: 20_000 });
  await page.goto("/auth/confirm#error=access_denied&error_code=otp_expired&type=invite", { waitUntil: "commit" });
  await expect(page).toHaveURL(/\/login\?error=link$/, { timeout: 20_000 });
  await expect(page.getByText("That link is invalid or has expired. Request a new one.")).toBeVisible({ timeout: 20_000 });
});

test("an invalid PKCE code cannot establish a session", async ({ request }) => {
  const response = await request.get("/auth/confirm?code=test-invalid-code", { maxRedirects: 0 });
  expect(response.status()).toBe(303);
  expect(response.headers().location).toBe("/login?error=link");
});

test("default invitations establish cookies and clear their fragment before opening password setup", async ({ page, context, baseURL }) => {
  test.setTimeout(60_000);
  // Fake credentials are accepted only by the intercepted browser request, never by the server.
  const userId = "00000000-0000-4000-8000-000000000001";
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const accessToken = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: userId, aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.${Buffer.from("test-signature").toString("base64url")}`;
  const refreshToken = "test-email-link-refresh-token";
  let verified = false;
  let fragmentAtVerification = "not checked";
  const leakedRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes(accessToken) || request.url().includes(refreshToken)) leakedRequests.push(request.url());
  });
  await page.route("**/auth/v1/user", async (route) => {
    verified = true;
    fragmentAtVerification = new URL(page.url()).hash;
    await route.fulfill({
      contentType: "application/json",
      headers: { "access-control-allow-origin": baseURL! },
      body: JSON.stringify({ id: userId, aud: "authenticated", role: "authenticated", email: "invite@example.test", created_at: new Date().toISOString(), app_metadata: {}, user_metadata: {}, identities: [] }),
    });
  });
  await page.route("**/auth/set-password", (route) => route.fulfill({ contentType: "text/html", body: "<h1>Password setup destination</h1>" }));
  const fragment = new URLSearchParams({ access_token: accessToken, refresh_token: refreshToken, token_type: "bearer", type: "invite" });
  await page.goto(`/auth/confirm#${fragment}`, { waitUntil: "commit" });
  await expect(page.getByRole("heading", { name: "Password setup destination" })).toBeVisible({ timeout: 20_000 });
  expect(verified).toBe(true);
  expect(fragmentAtVerification).toBe("");
  expect(leakedRequests).toEqual([]);
  expect((await context.cookies()).some((cookie) => /-auth-token(?:\.\d+)?$/.test(cookie.name))).toBe(true);
});
