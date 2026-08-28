import { resolve } from "node:path";

import { createSupabaseAdminClient } from "@paon/database";
import { expect, test, type Page } from "@playwright/test";

/**
 * PHASE 20.24 — constrained-network prefetch guard.
 *
 * CUSTOMER_ENVIRONMENT_REBUILD_V3 §3.1: "do not eagerly preload heavyweight
 * routes or documents when Save-Data is enabled or effective connection type
 * is 2G. This guard must not change normal navigation correctness."
 *
 * The customer left sidebar (ShopCategorySidebar) links to the storefront via
 * IntentPrefetchLink, which on mount eagerly injects
 * `<link rel="prefetch" as="document" href="/r/...">` — unless
 * isConstrainedConnection() is true (navigator.connection.saveData, or
 * effectiveType matching /(^|-)2g$/). Explicit intent (hover/focus/touch)
 * still prefetches; only the eager path is gated.
 *
 * Test-only proof lane — no application code is changed.
 */

const CUSTOMER_EMAIL = "contact+isabelle@nebelspiegel.com";
const EVIDENCE_DIR = resolve(
  process.cwd(),
  "../../docs/evidence/runs/20.24-customer-prefetch-guard-v3",
);
const EAGER_PREFETCH = 'head link[rel="prefetch"][as="document"]';

async function signIn(page: Page): Promise<void> {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) throw new Error("requires local Supabase.");
  const admin = createSupabaseAdminClient(url, key);
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: CUSTOMER_EMAIL,
  });
  if (error || !data.properties) {
    throw error ?? new Error("magic link missing");
  }
  await page.goto(
    `/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`,
  );
  await expect(page).toHaveURL(/\/dashboard$/);
}

/** Shadow navigator.connection before any app script runs. */
async function fakeConnection(
  page: Page,
  connection: { saveData: boolean; effectiveType: string },
): Promise<void> {
  await page.addInitScript((conn) => {
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      get: () => ({
        ...conn,
        addEventListener() {},
        removeEventListener() {},
      }),
    });
  }, connection);
}

test("unconstrained: the customer sidebar eagerly warms the storefront with a document prefetch link", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });

  await page.setViewportSize({ width: 1512, height: 982 });
  await signIn(page);

  // The eager (requestIdleCallback / 200ms) path injects the document
  // prefetch for the storefront with no user interaction.
  await expect(page.locator(EAGER_PREFETCH).first()).toHaveAttribute(
    "href",
    /\/r\//,
    { timeout: 15_000 },
  );

  expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
  await page.screenshot({
    path: resolve(EVIDENCE_DIR, "desktop-1512x982.png"),
    fullPage: true,
  });
});

test("Save-Data on: no eager prefetch is injected, and normal navigation still works", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });

  await fakeConnection(page, { saveData: true, effectiveType: "4g" });
  await page.setViewportSize({ width: 1512, height: 982 });
  await signIn(page);

  // Well past the eager window (200ms timeout / idle callback).
  await page.waitForTimeout(2500);
  await expect(page.locator(EAGER_PREFETCH)).toHaveCount(0);

  // Normal navigation correctness is unchanged.
  await page
    .locator('[data-customer-top-menu][href="/wardrobe"]')
    .first()
    .click();
  await expect(page).toHaveURL(/\/wardrobe$/);
  await expect(
    page.locator("[data-customer-navigation-ready]"),
  ).toHaveAttribute("data-customer-navigation-ready", "/wardrobe");

  // Explicit intent still warms it — the guard only blocks eager speculation.
  await page.goBack();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.locator('a[href^="/r/atelier-demo"]').first().hover();
  await expect(page.locator(EAGER_PREFETCH).first()).toHaveAttribute(
    "href",
    /\/r\//,
    { timeout: 5_000 },
  );

  expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
});

test("2G effective connection: no eager prefetch is injected, and normal navigation still works", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });

  await fakeConnection(page, { saveData: false, effectiveType: "2g" });
  await page.setViewportSize({ width: 1512, height: 982 });
  await signIn(page);

  await page.waitForTimeout(2500);
  await expect(page.locator(EAGER_PREFETCH)).toHaveCount(0);

  await page
    .locator('[data-customer-top-menu][href="/orders"]')
    .first()
    .click();
  await expect(page).toHaveURL(/\/orders$/);
  await expect(
    page.locator("[data-customer-navigation-ready]"),
  ).toHaveAttribute("data-customer-navigation-ready", "/orders");

  expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.locator("[data-customer-shell]")).toBeVisible();
  await page.screenshot({
    path: resolve(EVIDENCE_DIR, "mobile-390x844.png"),
    fullPage: true,
  });
});
