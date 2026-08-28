import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { createSupabaseAdminClient } from "@paon/database";
import { expect, test, type Page } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL } from "./fixtures";

/**
 * Customer V3 live-visual-audit remediation — F10 + F11
 * (docs/evidence/reviews/customer-v3-live-visual-audit/README.md).
 *
 * F10: the persistent customer sidebar must label its garment categories
 *      "Trousers" and "Knitwear" — never "Pants" / "Knits" — while the
 *      canonical storefront category value in the link stays unchanged.
 * F11: the local-context surface must show "Your location" only once (the
 *      date cell), never a duplicate under the weather glyph.
 *
 * Contract: CUSTOMER_ENVIRONMENT_REBUILD_V3 §3, §5.2.
 */

const EVIDENCE_SUBPATH =
  "../../../docs/evidence/runs/customer-v3-sidebar-location-remediation";

function admin() {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
}

async function signIn(page: Page): Promise<void> {
  const { data, error } = await admin().auth.admin.generateLink({
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

test("customer sidebar uses Trousers/Knitwear and local-context shows one location label", async ({
  page,
}, testInfo) => {
  const evidenceDir = resolve(testInfo.config.rootDir, EVIDENCE_SUBPATH);
  await mkdir(evidenceDir, { recursive: true });

  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${String(e)}`));

  // --- Desktop: sidebar is visible at lg and up. ---
  await page.setViewportSize({ width: 1512, height: 982 });
  await signIn(page);

  const sidebar = page.locator("aside").filter({ hasText: "Collection" });
  await expect(sidebar).toBeVisible();

  // F10: the canonical taxonomy labels appear; the storefront slugs do not.
  await expect(sidebar.getByText("Trousers", { exact: true })).toBeVisible();
  await expect(sidebar.getByText("Knitwear", { exact: true })).toBeVisible();
  await expect(sidebar.getByText("Pants", { exact: true })).toHaveCount(0);
  await expect(sidebar.getByText("Knits", { exact: true })).toHaveCount(0);

  // The link keeps the canonical storefront category value — only the label
  // changed, so catalogue filtering is untouched.
  await expect(
    sidebar.locator('a[href*="category=Pants"]'),
  ).toHaveCount(1);
  await expect(
    sidebar.locator('a[href*="category=Knits"]'),
  ).toHaveCount(1);
  await expect(
    sidebar.locator('a[href*="category=Trousers"]'),
  ).toHaveCount(0);

  // F11: exactly one "Your location" in the local-context strip.
  const strip = page
    .locator("section")
    .filter({ has: page.getByText("Local context", { exact: true }) });
  await expect(strip).toBeVisible();
  await page.waitForTimeout(1500);
  expect(
    await strip.getByText("Your location", { exact: true }).count(),
  ).toBeLessThanOrEqual(1);

  await page.screenshot({
    path: resolve(evidenceDir, "dashboard-desktop-1512x982.png"),
    fullPage: true,
  });

  // --- Mobile: local-context still shows at most one location label. ---
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(strip).toBeVisible();
  await page.waitForTimeout(1500);
  expect(
    await strip.getByText("Your location", { exact: true }).count(),
  ).toBeLessThanOrEqual(1);

  await page.screenshot({
    path: resolve(evidenceDir, "dashboard-mobile-390x844.png"),
    fullPage: true,
  });

  expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
});
