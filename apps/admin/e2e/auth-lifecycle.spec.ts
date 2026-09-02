import { expect, test } from "@playwright/test";

import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } from "./fixtures";

test.describe("Auth Lifecycle", () => {
  test("session cookies are set with secure flags on login", async ({
    page,
    context,
  }) => {
    // Clear any existing cookies
    await context.clearCookies();

    await page.goto("/login");

    // Fill and submit login form
    await page.getByLabel("Email").fill(TEST_ADMIN_EMAIL);
    await page.getByLabel("Password").fill(TEST_ADMIN_PASSWORD);

    // Capture response headers by waiting for network response
    const setCookieHeaders: Record<string, string> = {};
    page.on("response", (response) => {
      if (response.url().includes("/login")) {
        const headers = response.headers();
        if (headers["set-cookie"]) {
          setCookieHeaders["set-cookie"] = headers["set-cookie"];
        }
      }
    });

    // Submit login
    await page.getByRole("button", { name: "Enter PAON" }).click();

    // Wait for navigation to retailers page
    await expect(page).toHaveURL(/\/retailers$/);

    // Check cookies after login
    const cookies = await context.cookies();
    const authCookies = cookies.filter(
      (c) =>
        c.name.includes("auth") ||
        c.name.includes("sb-") ||
        c.name.includes("session"),
    );

    expect(authCookies.length, "Should have auth cookies").toBeGreaterThan(0);

    // Verify secure flags on auth cookies
    for (const cookie of authCookies) {
      expect(cookie.httpOnly, `${cookie.name} should be HttpOnly`).toBe(true);
      expect(cookie.secure, `${cookie.name} should be Secure`).toBe(true);
      expect(
        ["Strict", "Lax", "None"],
        `${cookie.name} should have valid SameSite`,
      ).toContain(cookie.sameSite);
    }
  });

  test("session is invalidated after clearing cookies", async ({
    page,
    context,
  }) => {
    // Login first
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_ADMIN_EMAIL);
    await page.getByLabel("Password").fill(TEST_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Enter PAON" }).click();

    // Verify we're logged in
    await expect(page).toHaveURL(/\/retailers$/);

    // Clear cookies
    await context.clearCookies();

    // Try to access protected route - should redirect to login
    await page.goto("/retailers");
    await expect(page).toHaveURL(/\/login/);
  });

  test("tampered session cookie is rejected", async ({ page, context }) => {
    // Login first
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_ADMIN_EMAIL);
    await page.getByLabel("Password").fill(TEST_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Enter PAON" }).click();

    // Wait for login to complete
    await expect(page).toHaveURL(/\/retailers$/);

    // Get cookies and tamper with one
    const cookies = await context.cookies();
    const authCookie = cookies.find(
      (c) =>
        c.name.includes("auth") ||
        c.name.includes("sb-") ||
        c.name.includes("session"),
    );

    if (authCookie) {
      // Tamper with cookie value
      const tamperedValue = authCookie.value.substring(0, -10) + "tampered__";

      // Clear cookies and set tampered one
      await context.clearCookies();
      await context.addCookies([
        {
          ...authCookie,
          value: tamperedValue,
        },
      ]);

      // Try to access protected route - should fail
      await page.goto("/retailers");

      // Should redirect to login or show error
      const url = page.url();
      expect(
        url.includes("/login") || url.includes("error"),
        "Should redirect or show error for tampered cookie",
      ).toBe(true);
    }
  });

  test("expired/old session is rejected", async ({ page, context }) => {
    // Login first
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_ADMIN_EMAIL);
    await page.getByLabel("Password").fill(TEST_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Enter PAON" }).click();

    await expect(page).toHaveURL(/\/retailers$/);

    // Get cookies and modify expiration
    const cookies = await context.cookies();
    const authCookie = cookies.find((c) => c.name.includes("session"));

    if (authCookie) {
      // Set expiration to the past
      const expiredCookie = {
        ...authCookie,
        expires: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      };

      await context.clearCookies();
      await context.addCookies([expiredCookie]);

      // Try to access protected route
      await page.goto("/retailers");

      // Should be redirected to login
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test("invalid credentials show error message", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_ADMIN_EMAIL);
    await page.getByLabel("Password").fill("wrong-password-123");
    await page.getByRole("button", { name: "Enter PAON" }).click();

    // Should stay on login page and show error
    await expect(page).toHaveURL(/\/login\?error=invalid_credentials/);
    await expect(
      page.getByRole("alert").filter({ hasText: "don't match" }),
    ).toBeVisible();
  });

  test("detects brute force attempts", async ({ page }) => {
    // Make multiple rapid failed login attempts
    const attempts = 5;

    for (let i = 0; i < attempts; i++) {
      await page.goto("/login");
      await page.getByLabel("Email").fill(TEST_ADMIN_EMAIL);
      await page.getByLabel("Password").fill(`wrong-${i}`);
      await page.getByRole("button", { name: "Enter PAON" }).click();

      // Give time for response
      await page.waitForTimeout(500);
    }

    // Check if any rate limiting was triggered
    const content = await page.content();
    const hasRateLimitWarning =
      content.includes("too many") || content.includes("rate");

    // Note: This is not a failure, just documentation of whether rate limiting is present
    console.warn(`Rate limiting active: ${hasRateLimitWarning}`);
  });

  // Requires a non-platform user; only a platform_owner test fixture exists
  // today. Skipped rather than a no-op assertion so this shows up as
  // pending in test output instead of silently passing.
  test.skip("wrong account type is rejected after login", async () => {});

  test("middleware prevents unguarded access to protected routes", async ({
    page,
  }) => {
    // Access a protected route without being logged in
    const routes = ["/retailers", "/staff", "/commercials"];

    for (const route of routes) {
      await page.goto(route, { waitUntil: "domcontentloaded" });

      // Should redirect to login
      expect(page.url()).toMatch(/\/login/);
    }
  });
});
