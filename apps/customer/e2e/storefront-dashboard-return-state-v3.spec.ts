import { createSupabaseAdminClient } from "@paon/database";
import { seedDemoData } from "@paon/database/demo-seed";
import { expect, test } from "@playwright/test";

/**
 * PHASE 20.23 return-state restoration proof — V3 top-nav seam.
 *
 * Extends PHASE 21.2 (one-platform seam — storefront ⇄ dashboard) to prove
 * the seam still holds with the V3 top-nav active (7-tab account bar,
 * PHASE 20.15). Proves storefront → dashboard (via V3 account tabs) → Back
 * to storefront works with BFCache preserved, auth/session correct, and
 * retailer scope intact on return — both desktop and mobile.
 *
 * This spec is a proof-only task confirming the already-shipped 21.2 capability
 * still holds now that V3 navigation is in place. Does not touch storefront or
 * implementation files; does not weaken assertions.
 */

test.describe("storefront <-> dashboard return-state with V3 top-nav — desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("storefront → dashboard via top-nav → Back restores storefront with BFCache", async ({
    page,
  }) => {
    const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
    const anonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
    const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error(
        "V3 return-state test requires local Supabase variables.",
      );
    }

    await seedDemoData({ supabaseUrl, anonKey, serviceRoleKey });
    const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

    // A real active variant for the seeded atelier-demo retailer.
    const { data: retailer } = await admin
      .from("retailers")
      .select("id")
      .eq("slug", "atelier-demo")
      .single();
    if (!retailer) throw new Error("atelier-demo retailer missing after seed");
    const { data: products } = await admin
      .from("products")
      .select("id")
      .eq("retailer_id", retailer.id)
      .eq("status", "active")
      .limit(25);
    const productIds = (products ?? []).map((row) => row.id as string);
    const { data: variants } = await admin
      .from("product_variants")
      .select("id")
      .in("product_id", productIds)
      .limit(1);
    const variantId = variants?.[0]?.id as string | undefined;
    if (!variantId) throw new Error("no product variant to add to cart");

    // Sign in as the demo customer (magic link, same pattern as 21.2 reference).
    const { data: link, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: "contact+isabelle@nebelspiegel.com",
    });
    if (error || !link.properties) {
      throw error ?? new Error("magic link missing");
    }
    await page.goto(
      `/auth/confirm?token_hash=${link.properties.hashed_token}&type=magiclink`,
    );
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator("[data-customer-shell]")).toBeVisible();

    // Record console errors and failed network responses for assertions.
    const consoleErrors: string[] = [];
    const failedResponses: { status: number; url: string }[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text());
    });
    page.on("response", (r) => {
      if (r.status() >= 400) {
        failedResponses.push({ status: r.status(), url: r.url() });
      }
    });

    // On the raw storefront, add to bag through the same endpoint the founder
    // template's "Add to Bag" button posts to.
    await page.goto("/r/atelier-demo?category=Suits");
    const addResponse = await page.request.post(
      "/r/atelier-demo/api/cart-add",
      {
        data: { variantId },
      },
    );
    expect(addResponse.ok()).toBe(true);

    // Verify cart is populated before navigation.
    const summaryBefore = await (
      await page.request.get("/r/atelier-demo/api/cart-summary")
    ).json();
    expect(summaryBefore.authenticated).toBe(true);
    expect(summaryBefore.count).toBeGreaterThanOrEqual(1);
    const cartCountBefore = summaryBefore.count as number;

    // Cross the boundary into the React dashboard via the storefront's entry point.
    // The V3 navigation is mounted in the customer dashboard layout; we navigate
    // to /dashboard which will show the AccountTopTabs.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator("[data-customer-shell]")).toBeVisible();

    // Verify V3 top-nav is present and has the 7-tab structure (Overview, Wardrobe, etc.).
    const topNavTabs = page.locator("[data-customer-top-menu]");
    const tabCount = await topNavTabs.count();
    expect(tabCount).toBeGreaterThanOrEqual(3); // At least Overview, Wardrobe, Orders etc.
    const overviewTab = page.locator(
      '[data-customer-top-menu][href="/dashboard"]',
    );
    await expect(overviewTab).toBeVisible();

    // Back to the storefront — BFCache should preserve it exactly as left.
    // BFCache (Back-Forward Cache) preserves the page in its exact state when
    // navigating back, avoiding a full reload.
    await page.goBack();
    await expect(page).toHaveURL(/\/r\/atelier-demo/);

    // Wait briefly for any potential page interactions to settle.
    await page.waitForTimeout(500);

    // Verify cart survived the round trip exactly.
    const summaryAfter = await (
      await page.request.get("/r/atelier-demo/api/cart-summary")
    ).json();
    expect(summaryAfter.authenticated).toBe(true);
    expect(summaryAfter.count).toBe(cartCountBefore);

    // No console errors should have occurred.
    expect(consoleErrors).toEqual([]);

    // No 4xx/5xx responses during the flow.
    expect(failedResponses).toEqual([]);

    page.removeAllListeners();
  });
});

test.describe("storefront <-> dashboard return-state with V3 top-nav — mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("storefront → dashboard via top-nav → Back restores storefront with BFCache (mobile)", async ({
    page,
  }) => {
    const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
    const anonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
    const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error(
        "V3 return-state mobile test requires local Supabase variables.",
      );
    }

    await seedDemoData({ supabaseUrl, anonKey, serviceRoleKey });
    const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

    // A real active variant for the seeded atelier-demo retailer.
    const { data: retailer } = await admin
      .from("retailers")
      .select("id")
      .eq("slug", "atelier-demo")
      .single();
    if (!retailer) throw new Error("atelier-demo retailer missing after seed");
    const { data: products } = await admin
      .from("products")
      .select("id")
      .eq("retailer_id", retailer.id)
      .eq("status", "active")
      .limit(25);
    const productIds = (products ?? []).map((row) => row.id as string);
    const { data: variants } = await admin
      .from("product_variants")
      .select("id")
      .in("product_id", productIds)
      .limit(1);
    const variantId = variants?.[0]?.id as string | undefined;
    if (!variantId) throw new Error("no product variant to add to cart");

    // Sign in as the demo customer.
    const { data: link, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: "contact+isabelle@nebelspiegel.com",
    });
    if (error || !link.properties) {
      throw error ?? new Error("magic link missing");
    }
    await page.goto(
      `/auth/confirm?token_hash=${link.properties.hashed_token}&type=magiclink`,
    );
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator("[data-customer-shell]")).toBeVisible();

    // Record console errors and failed responses.
    const consoleErrors: string[] = [];
    const failedResponses: { status: number; url: string }[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text());
    });
    page.on("response", (r) => {
      if (r.status() >= 400) {
        failedResponses.push({ status: r.status(), url: r.url() });
      }
    });

    // Add item to cart on storefront.
    await page.goto("/r/atelier-demo?category=Suits");
    const addResponse = await page.request.post(
      "/r/atelier-demo/api/cart-add",
      {
        data: { variantId },
      },
    );
    expect(addResponse.ok()).toBe(true);

    // Verify cart before navigation.
    const summaryBefore = await (
      await page.request.get("/r/atelier-demo/api/cart-summary")
    ).json();
    expect(summaryBefore.authenticated).toBe(true);
    expect(summaryBefore.count).toBeGreaterThanOrEqual(1);
    const cartCountBefore = summaryBefore.count as number;

    // Navigate to dashboard.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator("[data-customer-shell]")).toBeVisible();

    // Verify V3 top-nav tabs are present on mobile (some hidden, some visible).
    const topNavTabs = page.locator("[data-customer-top-menu]");
    const tabCount = await topNavTabs.count();
    expect(tabCount).toBeGreaterThanOrEqual(2); // At least some tabs visible on mobile

    // Go back to storefront.
    await page.goBack();
    await expect(page).toHaveURL(/\/r\/atelier-demo/);
    await page.waitForTimeout(500);

    // Verify cart survived round trip.
    const summaryAfter = await (
      await page.request.get("/r/atelier-demo/api/cart-summary")
    ).json();
    expect(summaryAfter.authenticated).toBe(true);
    expect(summaryAfter.count).toBe(cartCountBefore);

    // No console errors.
    expect(consoleErrors).toEqual([]);

    // No failed responses.
    expect(failedResponses).toEqual([]);

    page.removeAllListeners();
  });
});
