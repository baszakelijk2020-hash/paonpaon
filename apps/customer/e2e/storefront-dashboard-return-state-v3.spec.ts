import { resolve } from "node:path";

import { createSupabaseAdminClient } from "@paon/database";
import { expect, test, type Page } from "@playwright/test";

import { TEST_RETAILER_SLUG } from "./fixtures";

/**
 * PHASE 20.23 — storefront/customer return-state restoration.
 *
 * CUSTOMER_ENVIRONMENT_REBUILD_V3 §3.1 / §3.2 / §10: warm customer-to-customer
 * navigation must not trigger a full document reload or a shell remount, and
 * Back/Forward must restore the previous destination (no full reload, no
 * wrong-customer data). The raw `/r/[slug]` storefront stays byte-frozen and
 * is only read here, never changed (§13).
 *
 * Test-only proof lane — no application code is changed.
 */

const CUSTOMER_EMAIL = "contact+isabelle@nebelspiegel.com";

const EVIDENCE_DIR = resolve(
  process.cwd(),
  "../../docs/evidence/runs/20.23-storefront-dashboard-return-state-v3",
);

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

async function assertReady(page: Page, href: string): Promise<void> {
  await expect(
    page.locator("[data-customer-navigation-ready]"),
  ).toHaveAttribute("data-customer-navigation-ready", href);
}

test("Back/Forward through the customer shell restores each destination with no full reload and no shell remount", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });

  await page.setViewportSize({ width: 1512, height: 982 });
  await signIn(page);
  await assertReady(page, "/dashboard");

  // Pin the persistent shell node so a remount is detectable.
  await page.evaluate(() => {
    (window as unknown as { __shell?: Element | null }).__shell =
      document.querySelector("[data-customer-shell]");
  });

  // Count full-document navigations from here on — warm nav must cause none.
  let documentRequests = 0;
  page.on("request", (r) => {
    if (r.isNavigationRequest() && r.resourceType() === "document") {
      documentRequests += 1;
    }
  });

  const sameShell = () =>
    page.evaluate(
      () =>
        document.querySelector("[data-customer-shell]") ===
        (window as unknown as { __shell?: Element | null }).__shell,
    );

  const hop = async (href: string) => {
    await page
      .locator(`[data-customer-top-menu][href="${href}"]`)
      .first()
      .click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await assertReady(page, href);
    expect(
      await sameShell(),
      `shell stayed mounted navigating to ${href}`,
    ).toBe(true);
  };

  await hop("/wardrobe");
  await hop("/orders");
  await hop("/account");

  // Walk history backward, then forward — each stop is a warm restore.
  await page.goBack();
  await expect(page).toHaveURL(/\/orders$/);
  await assertReady(page, "/orders");
  expect(await sameShell()).toBe(true);

  await page.goBack();
  await expect(page).toHaveURL(/\/wardrobe$/);
  await assertReady(page, "/wardrobe");
  expect(await sameShell()).toBe(true);

  await page.goForward();
  await expect(page).toHaveURL(/\/orders$/);
  await assertReady(page, "/orders");
  expect(await sameShell()).toBe(true);

  expect(
    documentRequests,
    "no warm navigation or Back/Forward triggered a full document reload",
  ).toBe(0);
  expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);

  await page.screenshot({
    path: resolve(EVIDENCE_DIR, "desktop-1512x982.png"),
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.locator("[data-customer-shell]")).toBeVisible();
  await page.screenshot({
    path: resolve(EVIDENCE_DIR, "mobile-390x844.png"),
    fullPage: true,
  });
});

test("returning from the customer dashboard to the raw storefront restores the storefront URL and the authenticated identity", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });

  await page.setViewportSize({ width: 1512, height: 982 });
  await signIn(page);

  // Land on the byte-frozen raw storefront (read-only here).
  const storefrontUrl = `/r/${TEST_RETAILER_SLUG}`;
  const storefrontResponse = await page.goto(storefrontUrl);
  expect(storefrontResponse?.status(), "raw storefront route responds").toBe(
    200,
  );
  await expect(page).toHaveURL(new RegExp(`/r/${TEST_RETAILER_SLUG}`));

  // Cross into the persistent customer shell.
  await page.goto("/dashboard");
  await expect(page.locator("[data-customer-shell]")).toBeVisible();
  await assertReady(page, "/dashboard");
  // The shell is authenticated as this customer, not anonymous — the top menu
  // (a signed-in-only control) is present.
  await expect(
    page.locator('[data-customer-top-menu][href="/account"]').first(),
  ).toBeVisible();

  // Back returns to the SAME storefront URL, not a wrong route or an error.
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/r/${TEST_RETAILER_SLUG}`));

  // Forward re-enters the shell, still authenticated as the same identity.
  await page.goForward();
  await expect(page.locator("[data-customer-shell]")).toBeVisible();
  await assertReady(page, "/dashboard");
  await expect(
    page.locator('[data-customer-top-menu][href="/account"]').first(),
  ).toBeVisible();

  // Direct navigation to a deep customer route still resolves for this
  // identity after the Back/Forward churn.
  await page.goto("/orders");
  await assertReady(page, "/orders");
  await expect(page.locator("[data-customer-shell]")).toBeVisible();

  expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
});
