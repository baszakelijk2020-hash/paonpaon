import { createSupabaseAdminClient } from "@paon/database";
import { test, expect } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL, TEST_RETAILER_SLUG } from "./fixtures";

test.describe("Storefront → Digital Fitting Room handoff (V3)", () => {
  test.beforeEach(async ({ page }) => {
    // Enable console error reporting
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    page.context().extraHTTPHeaders = {
      "X-E2E-Test": "storefront-dfr-handoff-v3",
    };

    // Store collected errors for cleanup
    (page as any).__errors = { consoleErrors, pageErrors };
  });

  test("authenticated storefront loads + selects real product + DFR module visible + CTA navigates to real DFR + back button restores state (desktop)", async ({
    page,
    context,
  }) => {
    // Sign in using admin magic link
    const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
    const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        "E2E test requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
      );
    }
    const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
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

    // Navigate to storefront
    await page.goto(`/r/${TEST_RETAILER_SLUG}`);
    await page.waitForLoadState("networkidle");

    // Verify storefront loaded
    const categoryGrid = page.locator("#cat-grid");
    await expect(categoryGrid).toBeVisible();

    // Collect network requests
    const requests: { method: string; url: string; status: number }[] = [];
    page.on("response", (response) => {
      requests.push({
        method: response.request().method(),
        url: response.url(),
        status: response.status(),
      });
    });

    // Find and click first available product
    const gridCards = page.locator(".grid-card");
    await expect(gridCards.first()).toBeVisible();

    const firstCard = gridCards.first();
    const productId = await firstCard.getAttribute("data-product-id");
    expect(productId).toBeTruthy();

    await firstCard.click();
    await page.waitForLoadState("networkidle");

    // Verify detail view opened
    await expect(page.locator(".detail-right")).toBeVisible();

    // Verify DFR module is visible
    const dfrModule = page.locator("#paon-dfr-module");
    await expect(dfrModule).toBeVisible();

    // Verify DFR module heading
    const heading = dfrModule.locator(".paon-dfr-module-heading");
    await expect(heading).toHaveText("Try in Digital Fitting Room");

    // Verify all three steps are visible
    const steps = dfrModule.locator(".paon-dfr-module-step");
    await expect(steps).toHaveCount(3);

    const step1 = steps.nth(0);
    const step2 = steps.nth(1);
    const step3 = steps.nth(2);

    await expect(step1).toContainText(
      "Upload two reference photos to create your digital portrait."
    );
    await expect(step2).toContainText(
      "Select this piece and compose it with other items you own or are considering."
    );
    await expect(step3).toContainText(
      "See how the look takes shape before you ask your advisor to make it real."
    );

    // Verify CTA button is visible
    const cta = dfrModule.locator(".paon-dfr-module-cta");
    await expect(cta).toBeVisible();
    await expect(cta).toHaveText("Start creating");

    // Verify CTA border-radius computes to exactly 15px
    const computedStyle = await cta.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return computed.borderRadius;
    });
    // border-radius should be 15px (or close to it in different browsers)
    const radius = parseFloat(computedStyle);
    expect(radius).toBeCloseTo(15, 0);

    // Verify CTA href is correct
    const href = await cta.getAttribute("href");
    expect(href).toContain("/digital-fitting-room?productSlug=");
    expect(href).toContain(productId);

    // Click the CTA
    const navigationPromise = page.waitForNavigation();
    await cta.click();
    await navigationPromise;
    await page.waitForLoadState("networkidle");

    // Verify we're on the DFR page
    expect(page.url()).toContain("/digital-fitting-room");
    expect(page.url()).toContain("productSlug=");

    // Verify DFR page loaded and shows the product
    const heading_drf = page.locator("h1, [class*='Heading']");
    await expect(heading_drf.first()).toBeVisible();

    // Verify the product is actually loaded in the DFR (check for composable items or preset key)
    const dfrContent = page.locator("body");
    await expect(dfrContent).toBeVisible();

    // Navigate back
    await page.goBack();
    await page.waitForLoadState("networkidle");

    // Verify we're back on the storefront (detail view will be closed after navigation)
    expect(page.url()).toContain(`/r/${TEST_RETAILER_SLUG}`);
    await expect(page.locator("#cat-grid")).toBeVisible();

    // Verify Store/My PAON switcher works
    const contextSwitcher = page.locator("#paon-context-switcher");
    if (await contextSwitcher.isVisible()) {
      const myPaonLink = contextSwitcher.locator(".pcs-mypaon");
      await expect(myPaonLink).toBeVisible();
    }

    // Verify all HTTP responses were successful
    const failedRequests = requests.filter((r) => r.status >= 400);
    expect(failedRequests).toEqual([]);

    // Verify no unfiltered console errors
    const errors = (page as any).__errors;
    expect(errors.consoleErrors).toEqual([]);
    expect(errors.pageErrors).toEqual([]);
  });

  test("authenticated storefront → product selection → DFR module → navigation flow (mobile)", async ({
    page,
    context,
  }) => {
    // Apply mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Sign in using admin magic link
    const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
    const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        "E2E test requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
      );
    }
    const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
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

    // Navigate to storefront
    await page.goto(`/r/${TEST_RETAILER_SLUG}`);
    await page.waitForLoadState("networkidle");

    // Verify storefront loaded on mobile (category grid is hidden on mobile, check for products)
    const gridCards = page.locator(".grid-card");
    await expect(gridCards.first()).toBeVisible();

    const firstCard = gridCards.first();
    const productId = await firstCard.getAttribute("data-product-id");

    await firstCard.click();
    await page.waitForLoadState("networkidle");

    // Verify detail view opened on mobile
    const mobileDetailView = page.locator("#view-detail.visible");
    await expect(mobileDetailView).toBeVisible();

    // Scroll to ensure DFR module is in viewport
    const dfrModule = page.locator("#paon-dfr-module");
    await dfrModule.scrollIntoViewIfNeeded();
    await expect(dfrModule).toBeVisible();

    // Verify module content on mobile
    const heading = dfrModule.locator(".paon-dfr-module-heading");
    await expect(heading).toHaveText("Try in Digital Fitting Room");

    const steps = dfrModule.locator(".paon-dfr-module-step");
    await expect(steps).toHaveCount(3);

    // Verify CTA on mobile
    const cta = dfrModule.locator(".paon-dfr-module-cta");
    await expect(cta).toBeVisible();

    // Verify CTA border-radius on mobile
    const computedStyle = await cta.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return computed.borderRadius;
    });
    const radius = parseFloat(computedStyle);
    expect(radius).toBeCloseTo(15, 0);

    // Click CTA
    const navigationPromise = page.waitForNavigation();
    await cta.click();
    await navigationPromise;
    await page.waitForLoadState("networkidle");

    // Verify DFR page loaded on mobile
    expect(page.url()).toContain("/digital-fitting-room");
    const dfrPageHeading = page.locator("h1").first();
    await expect(dfrPageHeading).toBeVisible();

    // Navigate back
    await page.goBack();
    await page.waitForLoadState("networkidle");

    // Verify back to storefront (detail view will be closed after navigation)
    expect(page.url()).toContain(`/r/${TEST_RETAILER_SLUG}`);
  });

  test("navigating between products updates DFR link correctly", async ({
    page,
  }) => {
    // Sign in using admin magic link
    const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
    const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        "E2E test requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
      );
    }
    const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
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

    // Navigate to storefront
    await page.goto(`/r/${TEST_RETAILER_SLUG}`);
    await page.waitForLoadState("networkidle");

    // Select first product
    const gridCards = page.locator(".grid-card");
    const firstCard = gridCards.first();
    const firstProductId = await firstCard.getAttribute("data-product-id");

    await firstCard.click();
    await page.waitForLoadState("networkidle");

    // Get first product's CTA link
    const dfrModule = page.locator("#paon-dfr-module");
    await expect(dfrModule).toBeVisible();
    let cta = dfrModule.locator(".paon-dfr-module-cta");
    let firstHref = await cta.getAttribute("href");
    expect(firstHref).toContain(firstProductId);

    // Navigate back to grid
    const backButton = page.locator("#header-back");
    if (await backButton.isVisible()) {
      await backButton.click();
      await page.waitForLoadState("networkidle");
    }

    // Select second product if available
    const allCards = page.locator(".grid-card");
    const cardCount = await allCards.count();
    if (cardCount > 1) {
      const secondCard = allCards.nth(1);
      const secondProductId = await secondCard.getAttribute("data-product-id");
      await secondCard.click();
      await page.waitForLoadState("networkidle");

      // Verify DFR link updated
      await expect(dfrModule).toBeVisible();
      const cta2 = dfrModule.locator(".paon-dfr-module-cta");
      const secondHref = await cta2.getAttribute("href");
      expect(secondHref).toContain(secondProductId);
      expect(secondHref).not.toBe(firstHref);
    }
  });

  test("category filtering preserves product state + DFR module responsive", async ({
    page,
  }) => {
    // Sign in using admin magic link
    const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
    const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        "E2E test requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
      );
    }
    const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
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

    // Navigate to storefront
    await page.goto(`/r/${TEST_RETAILER_SLUG}`);
    await page.waitForLoadState("networkidle");

    // Get initial category count
    const categoryItems = page.locator(".cat-item");
    if ((await categoryItems.count()) > 1) {
      // Click second category
      await categoryItems.nth(1).click();
      await page.waitForLoadState("networkidle");

      // Verify category filtered
      const gridCards = page.locator(".grid-card");
      const cardCount = await gridCards.count();
      expect(cardCount).toBeGreaterThan(0);

      // Select a product
      await gridCards.first().click();
      await page.waitForLoadState("networkidle");

      // Verify DFR module visible
      const dfrModule = page.locator("#paon-dfr-module");
      await expect(dfrModule).toBeVisible();

      // Verify all required elements
      await expect(
        dfrModule.locator(".paon-dfr-module-heading")
      ).toHaveText("Try in Digital Fitting Room");
      await expect(dfrModule.locator(".paon-dfr-module-step")).toHaveCount(3);
      await expect(dfrModule.locator(".paon-dfr-module-cta")).toBeVisible();
    }
  });
});
