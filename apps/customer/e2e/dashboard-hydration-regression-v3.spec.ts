import { createSupabaseAdminClient } from "@paon/database";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL, TEST_RETAILER_SLUG } from "./fixtures";

/**
 * Hydration regression guard (React error #418).
 *
 * `customer-cta-squircle-v3.spec.ts` carries a blanket console-error filter
 * for "Minified React error #418" on the storefront product-detail page at
 * `?legacy=1` (desktop-only, historically reported as pre-existing noise).
 * Six independent reproduction attempts against that exact URL — a real
 * production build, an authenticated session, desktop and mobile viewports,
 * both a fresh first request and a client-side back/forward navigation —
 * could not reproduce a hydration mismatch anywhere in this codebase. This
 * spec asserts ZERO tolerance (no filter) for that exact scenario so a
 * future regression is caught immediately instead of silently passing
 * through the older test's exemption.
 *
 * See HYDRATION_INVESTIGATION_STATUS.md for the full investigation record.
 */

const DESKTOP = { width: 1512, height: 982 } as const;
const MOBILE = { width: 390, height: 844 } as const;

const LEGACY_PRODUCT_PATH = `/r/${TEST_RETAILER_SLUG}/products/e2e-storefront-overcoat?legacy=1`;

function requireAdmin() {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "dashboard-hydration-regression-v3 requires local Supabase.",
    );
  }
  return createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
}

async function signIn(page: Page): Promise<void> {
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
  await page.goto(
    `/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`,
  );
  await expect(page).toHaveURL(/\/dashboard$/);
}

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${String(error)}`));
  return errors;
}

for (const viewport of [DESKTOP, MOBILE] as const) {
  const kind = viewport.width === DESKTOP.width ? "desktop" : "mobile";

  test(`legacy storefront product page hydrates cleanly on first request and client navigation — ${kind}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await signIn(page);

    // Authenticated first request (real document load, not a client
    // transition) — this is the exact scenario customer-cta-squircle-v3's
    // filter names as the historical #418 source.
    const errors = trackErrors(page);
    await page.goto(LEGACY_PRODUCT_PATH);
    await expect(page).toHaveURL(/\?legacy=1$/);

    // Subsequent client-side navigation away and back (browser history,
    // handled by the Next.js client router — not a full document reload)
    // must not reintroduce a mismatch either.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goBack();
    await expect(page).toHaveURL(/\?legacy=1$/);
    await page.goForward();
    await expect(page).toHaveURL(/\/dashboard$/);

    expect(errors, errors.join("\n")).toEqual([]);
  });
}

test("dashboard first request still renders the authenticated shell cleanly", async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP);
  const errors = trackErrors(page);
  await signIn(page);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(errors, errors.join("\n")).toEqual([]);
});
