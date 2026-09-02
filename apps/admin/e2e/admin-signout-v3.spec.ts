import { expect, test } from "@playwright/test";
import type { Browser, BrowserContext, Page, Request } from "@playwright/test";

import {
  applyExpiredSession,
  refreshTokenFromSnapshot,
  refreshTokenStatus,
  requireSupabaseTestEnv,
  snapshotAuthCookies,
} from "./_signout-helpers";
import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } from "./fixtures";

/**
 * Admin sign-out control (GLOBAL scope, founder decision 2026-09-01).
 *
 * The dashboard layout mounts the `signOut` server action
 * (apps/admin/app/(dashboard)/actions.ts) as two SEPARATE `SignOutButton`
 * instances — one in the desktop sidebar, one in the mobile drawer — rather
 * than passing one server-rendered `<form>` element into both AppShell
 * slots (docs/PHASE.md "REAL BUG FOUND, NOT FIXED 2026-08-19": the admin
 * layout previously passed only `signOutControl`, so AppShell fell back to
 * mounting that SAME element instance in both DOM locations). Two
 * independent `SignOutButton`s fix that instead. `supabase.auth.signOut()`
 * is called with NO `scope` argument — default `scope: "global"` — so
 * signing out revokes every refresh token for that platform staff member
 * everywhere, not just this device.
 */

async function signInFreshContext(
  browser: Browser,
  viewport: { width: number; height: number },
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_ADMIN_EMAIL);
  await page.getByLabel("Password").fill(TEST_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Enter PAON" }).click();
  await expect(page).toHaveURL(/\/retailers$/);
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
  test("signing out context A through the sidebar control clears that device's session and revokes context B's session everywhere (global scope)", async ({
    browser,
  }) => {
    const desktopViewport = { width: 1512, height: 982 };
    const { supabaseUrl, anonKey } = requireSupabaseTestEnv();
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
      // Snapshot B's session cookie now — see _signout-helpers.ts's doc
      // comment on why a live re-read later can race the app's own client-
      // side cleanup once its refresh token is revoked.
      const sessionSnapshotB = await snapshotAuthCookies(contextB);

      const desktopControl = pageA.getByTestId("admin-signout-desktop");
      const signOutButton = desktopControl.getByRole("button", {
        name: "Sign out",
      });
      await expect(signOutButton).toBeVisible();
      await expect(desktopControl.getByRole("button")).toHaveCount(1);
      await pageA.screenshot({
        path: "../../docs/evidence/runs/global-signout-v3/admin/desktop-signed-in.png",
      });

      // Baseline: context B's refresh token is still live before A signs out.
      const refreshTokenB = refreshTokenFromSnapshot(sessionSnapshotB);
      const baselineStatus = await refreshTokenStatus(
        supabaseUrl,
        anonKey,
        refreshTokenB,
      );
      expect(baselineStatus).toBe(200);

      // Prove the click actually reaches the server — the historical defect
      // (docs/PHASE.md, 2026-08-19) was a click that registered in the DOM
      // but produced zero POST requests. The server action posts to the
      // current route (no explicit form `action`), so match on that exact
      // URL rather than any POST — the dashboard can have other incidental
      // POST traffic (polling, etc.) that would otherwise resolve this
      // early and let the assertion race ahead of the real sign-out.
      const currentUrl = pageA.url();
      const [postRequest] = await Promise.all([
        pageA.waitForRequest(
          (request: Request) =>
            request.method() === "POST" && request.url() === currentUrl,
          { timeout: 15_000 },
        ),
        signOutButton.click(),
      ]);
      expect(postRequest.method()).toBe("POST");

      await expect(pageA).toHaveURL(/\/login$/);
      expect(await authCookies(contextA)).toHaveLength(0);
      await pageA.screenshot({
        path: "../../docs/evidence/runs/global-signout-v3/admin/desktop-post-signout-login.png",
      });

      await pageA.goto("/retailers");
      await expect(pageA).toHaveURL(/\/login/);

      // Core cross-context proof: context B's SAME refresh token, which
      // worked a moment ago, is now revoked — global scope killed every
      // session for this platform staff member, not just context A's.
      const postSignOutStatus = await refreshTokenStatus(
        supabaseUrl,
        anonKey,
        refreshTokenB,
      );
      expect(postSignOutStatus).toBe(400);

      // Context B is still holding a cached, not-yet-expired access token —
      // simulate that access token expiring and reload: the app must
      // attempt to refresh, fail (refresh token is revoked), and redirect
      // to /login instead of coasting on stale client state. The admin app
      // has no guest shell for a protected route, so it redirects.
      await applyExpiredSession(contextB, sessionSnapshotB);
      await pageB.reload();
      await expect(pageB).toHaveURL(/\/login/);

      expect(consoleErrorsA, consoleErrorsA.join("\n")).toEqual([]);
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});

test.describe("mobile", () => {
  test("signing out through the mobile drawer control clears the session", async ({
    browser,
  }) => {
    const mobileViewport = { width: 390, height: 844 };
    const { context, page } = await signInFreshContext(browser, mobileViewport);
    const consoleErrors = trackConsoleErrors(page);

    try {
      await page.getByRole("button", { name: "Open navigation" }).click();

      const mobileControl = page.getByTestId("admin-signout-mobile");
      const signOutButton = mobileControl.getByRole("button", {
        name: "Sign out",
      });
      await expect(signOutButton).toBeVisible();
      await page.screenshot({
        path: "../../docs/evidence/runs/global-signout-v3/admin/mobile-signed-in.png",
      });

      const currentUrl = page.url();
      const [postRequest] = await Promise.all([
        page.waitForRequest(
          (request: Request) =>
            request.method() === "POST" && request.url() === currentUrl,
          { timeout: 15_000 },
        ),
        signOutButton.click(),
      ]);
      expect(postRequest.method()).toBe("POST");

      await expect(page).toHaveURL(/\/login$/);
      expect(await authCookies(context)).toHaveLength(0);
      await page.screenshot({
        path: "../../docs/evidence/runs/global-signout-v3/admin/mobile-post-signout-login.png",
      });

      expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
    } finally {
      await context.close();
    }
  });
});

test.describe("guest", () => {
  test("logged-out visitor is redirected to /login", async ({ page }) => {
    await page.goto("/retailers");
    await expect(page).toHaveURL(/\/login/);
  });
});
