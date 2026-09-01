import { createSupabaseAdminClient } from "@paon/database";
import { expect, test } from "@playwright/test";
import type { Browser, BrowserContext, Page, Request } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL, TEST_RETAILER_DISPLAY_NAME } from "./fixtures";

/**
 * C3 — customer sign-out control (local-device scope).
 *
 * The customer shell exposes the existing `signOut` server action
 * (apps/customer/app/(dashboard)/actions.ts) as a real "Sign out" control:
 * once in the desktop top-nav trailing slot, once inline on mobile /account
 * (each viewport shows exactly one). `scope: "local"` matches the "on this
 * device" copy — a second, independently authenticated browser context for
 * the same customer must stay signed in.
 */

function requireAdmin() {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
}

async function signInFreshContext(
  browser: Browser,
  viewport: { width: number; height: number },
): Promise<{ context: BrowserContext; page: Page }> {
  const admin = requireAdmin();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: TEST_CUSTOMER_EMAIL,
  });
  if (error || !data.properties) {
    throw new Error(
      `Failed to generate magic link: ${error?.message ?? "unknown error"}`,
    );
  }

  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto(
    `/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`,
  );
  await expect(page).toHaveURL(/\/dashboard$/);
  return { context, page };
}

async function authCookies(context: BrowserContext) {
  const cookies = await context.cookies();
  return cookies.filter(
    (cookie) =>
      cookie.name.includes("-auth-token") &&
      !cookie.name.includes("code-verifier"),
  );
}

function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${String(error)}`));
  return errors;
}

test.describe("desktop", () => {
  test("signing out context A through the desktop control clears only that device's session; context B stays signed in", async ({
    browser,
  }) => {
    const desktopViewport = { width: 1512, height: 982 };
    const { context: contextA, page: pageA } = await signInFreshContext(
      browser,
      desktopViewport,
    );
    const { context: contextB, page: pageB } = await signInFreshContext(
      browser,
      desktopViewport,
    );
    const consoleErrorsA = trackConsoleErrors(pageA);

    try {
      await pageA.goto("/account");
      await expect(
        pageA
          .getByRole("heading", {
            name: TEST_RETAILER_DISPLAY_NAME,
            exact: true,
          })
          .first(),
      ).toBeVisible();

      const desktopControl = pageA.getByTestId("customer-signout-desktop");
      const signOutButton = desktopControl.getByRole("button", {
        name: "Sign out",
      });
      await expect(signOutButton).toBeVisible();
      await expect(desktopControl.getByRole("button")).toHaveCount(1);

      // Prove the click actually reaches the server — the historical defect
      // (docs/PHASE.md, 2026-08-19) was a click that registered in the DOM
      // but produced zero POST requests.
      const [postRequest] = await Promise.all([
        pageA.waitForRequest(
          (request: Request) =>
            request.method() === "POST" && request.url().includes("/account"),
          { timeout: 15_000 },
        ),
        signOutButton.click(),
      ]);
      expect(postRequest.method()).toBe("POST");

      await expect(pageA).toHaveURL(/\/login$/);
      expect(await authCookies(contextA)).toHaveLength(0);

      await pageA.reload();
      await expect(pageA).toHaveURL(/\/login/);

      // /account is a guest-browsable public path (middleware.ts
      // PUBLIC_PATHS) — the (dashboard) layout shows the guest preview
      // shell here instead of redirecting, exactly like /dashboard.
      // "No customer data leaks" means the guest shell, not a login
      // redirect.
      await pageA.goto("/account");
      await expect(pageA).toHaveURL(/\/account$/);
      await expect(pageA.locator("[data-customer-shell]")).toHaveCount(0);
      await expect(pageA.getByText(TEST_CUSTOMER_EMAIL)).toHaveCount(0);
      await expect(
        pageA.getByRole("heading", { name: TEST_RETAILER_DISPLAY_NAME }),
      ).toHaveCount(0);
      await expect(
        pageA.getByRole("link", { name: "Customer Demo" }),
      ).toBeVisible();

      await pageA.goto("/dashboard");
      await expect(pageA).toHaveURL(/\/dashboard$/);
      await expect(pageA.locator("[data-customer-shell]")).toHaveCount(0);
      await expect(pageA.getByText(TEST_CUSTOMER_EMAIL)).toHaveCount(0);
      await expect(
        pageA.getByRole("main").getByRole("link", {
          name: "Sign in",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        pageA.getByRole("link", { name: "Customer Demo" }),
      ).toBeVisible();

      // Context B was signed in independently and never touched signOut —
      // scope: "local" must not have invalidated it.
      await pageB.goto("/account");
      await expect(pageB).toHaveURL(/\/account$/);
      await expect(
        pageB
          .getByRole("heading", {
            name: TEST_RETAILER_DISPLAY_NAME,
            exact: true,
          })
          .first(),
      ).toBeVisible();

      expect(consoleErrorsA, consoleErrorsA.join("\n")).toEqual([]);
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});

test.describe("mobile", () => {
  test("signing out through the mobile account control clears the session", async ({
    browser,
  }) => {
    const mobileViewport = { width: 390, height: 844 };
    const { context, page } = await signInFreshContext(browser, mobileViewport);
    const consoleErrors = trackConsoleErrors(page);

    try {
      await page.goto("/account");
      await expect(
        page
          .getByRole("heading", {
            name: TEST_RETAILER_DISPLAY_NAME,
            exact: true,
          })
          .first(),
      ).toBeVisible();

      const mobileControl = page.getByTestId("customer-signout-mobile");
      const signOutButton = mobileControl.getByRole("button", {
        name: "Sign out",
      });
      await expect(signOutButton).toBeVisible();

      // On mobile the desktop trailing slot is hidden; only one control is
      // ever reachable at a given viewport.
      await expect(
        page.getByTestId("customer-signout-desktop"),
      ).not.toBeVisible();

      const [postRequest] = await Promise.all([
        page.waitForRequest(
          (request: Request) =>
            request.method() === "POST" && request.url().includes("/account"),
          { timeout: 15_000 },
        ),
        signOutButton.click(),
      ]);
      expect(postRequest.method()).toBe("POST");

      await expect(page).toHaveURL(/\/login$/);
      expect(await authCookies(context)).toHaveLength(0);

      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/dashboard$/);
      await expect(page.locator("[data-customer-shell]")).toHaveCount(0);
      await expect(page.getByText(TEST_CUSTOMER_EMAIL)).toHaveCount(0);
      await expect(
        page.getByRole("link", { name: "Customer Demo" }),
      ).toBeVisible();

      expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
    } finally {
      await context.close();
    }
  });
});
