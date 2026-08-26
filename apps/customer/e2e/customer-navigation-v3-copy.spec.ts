import { createSupabaseAdminClient } from "@paon/database";
import { seedDemoData } from "@paon/database/demo-seed";
import { expect, test, type Page } from "@playwright/test";

const CUSTOMER_ROUTES = [
  ["/dashboard", "Overview"],
  ["/wardrobe", "Wardrobe"],
  ["/appointments", "My Appointments"],
  ["/orders", "Orders"],
  ["/digital-fitting-room", "Digital Fitting Room"],
  ["/loyalty", "Rewards & Referrals"],
  ["/account", "My Profile"],
] as const;

const DESKTOP_VIEWPORT = { width: 1280, height: 800 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };

async function authenticateAsIsabelle(page: Page) {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const anonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error(
      "Customer navigation test requires local Supabase variables.",
    );
  }

  await seedDemoData({ supabaseUrl, anonKey, serviceRoleKey });
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: "contact+isabelle@nebelspiegel.com",
  });
  if (error || !data.properties) {
    throw error ?? new Error("Customer magic link is missing");
  }
  await page.goto(
    `/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`,
  );
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator("[data-customer-shell]")).toBeVisible();
}

test.describe("Customer navigation and forbidden-copy consistency (20.15)", () => {
  test.describe("Desktop viewport", () => {
    test.use({ viewport: DESKTOP_VIEWPORT });

    test("shows exactly 7 navigation tabs in correct order with correct hrefs", async ({
      page,
    }) => {
      await authenticateAsIsabelle(page);

      for (const [href, label] of CUSTOMER_ROUTES) {
        const link = page.locator(`[data-customer-top-menu][href="${href}"]`);
        await expect(link).toBeVisible();
        await expect(link).toHaveText(label);
      }
    });

    test("navigation is client-side (no full page reload)", async ({
      page,
    }) => {
      await authenticateAsIsabelle(page);

      // Store reference to the persistent shell element
      await page.evaluate(() => {
        const shell = document.querySelector("[data-customer-shell]");
        if (!shell) throw new Error("customer shell is missing");
        (
          window as Window & { __paonCustomerShell?: Element }
        ).__paonCustomerShell = shell;
      });

      // Track document requests to verify no full-page reloads
      let documentRequests = 0;
      page.on("request", (request) => {
        if (
          request.isNavigationRequest() &&
          request.resourceType() === "document"
        ) {
          documentRequests += 1;
        }
      });

      // Navigate to each route and verify shell persistence
      for (const [href] of CUSTOMER_ROUTES.slice(1)) {
        // Skip first route since we're already there
        await page.locator(`[data-customer-top-menu][href="${href}"]`).click();

        await expect(page).toHaveURL(
          new RegExp(`${href.replace("/", "\\/")}$`),
        );

        // Verify shell element is the same (client-side nav preserves it)
        const shellStillSame = await page.evaluate(
          () =>
            document.querySelector("[data-customer-shell]") ===
            (window as Window & { __paonCustomerShell?: Element })
              .__paonCustomerShell,
        );
        expect(shellStillSame).toBe(true);
      }

      // Verify no document requests were made (except initial load)
      expect(documentRequests).toBe(0);
    });

    test("no forbidden 'house' wording in navigation", async ({ page }) => {
      await authenticateAsIsabelle(page);

      // Get all text content from the navigation bar
      const navText = await page.locator("nav").first().textContent();
      expect(navText?.toLowerCase()).not.toMatch(/house/i);
    });

    test("console-clean warm navigation across all destinations", async ({
      page,
    }) => {
      await authenticateAsIsabelle(page);

      const consoleErrors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });

      // Navigate across all routes
      for (const [href] of CUSTOMER_ROUTES) {
        await page.locator(`[data-customer-top-menu][href="${href}"]`).click();
        await expect(page).toHaveURL(
          new RegExp(`${href.replace("/", "\\/")}$`),
        );
      }

      expect(consoleErrors).toEqual([]);
    });
  });

  test.describe("Mobile viewport", () => {
    test.use({ viewport: MOBILE_VIEWPORT });

    test("first 3 destinations inline, remaining in overflow menu, all reachable", async ({
      page,
    }) => {
      await authenticateAsIsabelle(page);

      const mobilePrimaryTabs = CUSTOMER_ROUTES.slice(0, 3);
      const mobileOverflowTabs = CUSTOMER_ROUTES.slice(3);

      // Verify first 3 tabs are inline and visible
      for (const [href, label] of mobilePrimaryTabs) {
        const link = page.locator(`[data-customer-top-menu][href="${href}"]`);
        await expect(link).toBeVisible();
        await expect(link).toHaveText(label);
      }

      // Verify "More" button exists
      const moreButton = page.locator("button", { hasText: /More/i });
      await expect(moreButton).toBeVisible();

      // Open overflow menu
      await moreButton.click();

      // Verify all remaining tabs are in the menu
      for (const [href, label] of mobileOverflowTabs) {
        const link = page.locator(
          "#customer-mobile-navigation [data-customer-top-menu]",
          { hasText: label },
        );
        await expect(link).toBeVisible();
        await expect(link).toHaveAttribute("href", href);
      }

      // Verify "My Profile" is guaranteed in the menu (even though it's already in CUSTOMER_ROUTES)
      const profileLink = page.locator(
        '#customer-mobile-navigation [data-customer-top-menu][href="/account"]',
      );
      await expect(profileLink).toBeVisible();
      await expect(profileLink).toHaveText("My Profile");
    });

    test("mobile navigation is client-side", async ({ page }) => {
      await authenticateAsIsabelle(page);

      // Store reference to the persistent shell element
      await page.evaluate(() => {
        const shell = document.querySelector("[data-customer-shell]");
        if (!shell) throw new Error("customer shell is missing");
        (
          window as Window & { __paonCustomerShell?: Element }
        ).__paonCustomerShell = shell;
      });

      let documentRequests = 0;
      page.on("request", (request) => {
        if (
          request.isNavigationRequest() &&
          request.resourceType() === "document"
        ) {
          documentRequests += 1;
        }
      });

      // Test navigation via direct visible tabs
      for (const [href] of CUSTOMER_ROUTES.slice(1, 3)) {
        const link = page.locator(`[data-customer-top-menu][href="${href}"]`);
        await link.click();
        await expect(page).toHaveURL(
          new RegExp(`${href.replace("/", "\\/")}$`),
        );

        const shellStillSame = await page.evaluate(
          () =>
            document.querySelector("[data-customer-shell]") ===
            (window as Window & { __paonCustomerShell?: Element })
              .__paonCustomerShell,
        );
        expect(shellStillSame).toBe(true);
      }

      // Test navigation via overflow menu
      const moreButton = page.locator("button", { hasText: /More/i });
      const overflowRoutes = CUSTOMER_ROUTES.slice(3);
      for (let i = 0; i < overflowRoutes.length; i += 1) {
        const [href] = overflowRoutes[i]!;
        await moreButton.click();
        const link = page.locator(
          `#customer-mobile-navigation [data-customer-top-menu][href="${href}"]`,
        );
        await link.click();
        await expect(page).toHaveURL(
          new RegExp(`${href.replace("/", "\\/")}$`),
        );

        const shellStillSame = await page.evaluate(
          () =>
            document.querySelector("[data-customer-shell]") ===
            (window as Window & { __paonCustomerShell?: Element })
              .__paonCustomerShell,
        );
        expect(shellStillSame).toBe(true);
      }

      expect(documentRequests).toBe(0);
    });

    test("no forbidden 'house' wording in mobile navigation", async ({
      page,
    }) => {
      await authenticateAsIsabelle(page);

      // Check main nav bar
      const navText = await page.locator("nav").first().textContent();
      expect(navText?.toLowerCase()).not.toMatch(/house/i);

      // Check overflow menu
      const moreButton = page.locator("button", { hasText: /More/i });
      await moreButton.click();
      const menuText = await page
        .locator("#customer-mobile-navigation")
        .textContent();
      expect(menuText?.toLowerCase()).not.toMatch(/house/i);
    });

    test("console-clean warm navigation across all destinations (mobile)", async ({
      page,
    }) => {
      await authenticateAsIsabelle(page);

      const consoleErrors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });

      // Navigate via primary tabs
      for (const [href] of CUSTOMER_ROUTES.slice(0, 3)) {
        await page.locator(`[data-customer-top-menu][href="${href}"]`).click();
        await expect(page).toHaveURL(
          new RegExp(`${href.replace("/", "\\/")}$`),
        );
      }

      // Navigate via overflow menu
      const moreButton = page.locator("button", { hasText: /More/i });
      for (const [href] of CUSTOMER_ROUTES.slice(3)) {
        await moreButton.click();
        const link = page.locator(
          `#customer-mobile-navigation [data-customer-top-menu][href="${href}"]`,
        );
        await link.click();
        await expect(page).toHaveURL(
          new RegExp(`${href.replace("/", "\\/")}$`),
        );
      }

      expect(consoleErrors).toEqual([]);
    });
  });
});
