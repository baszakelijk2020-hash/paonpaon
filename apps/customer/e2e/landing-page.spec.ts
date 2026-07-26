import { expect, test } from "@playwright/test";

import {
  TEST_PRODUCT_SLUG,
  TEST_RETAILER_DISPLAY_NAME,
  TEST_RETAILER_SLUG,
} from "./fixtures";

const MOBILE_VIEWPORT = { width: 390, height: 844 }; // iPhone 12-class
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };

test.describe("desktop", () => {
  test.use({ viewport: DESKTOP_VIEWPORT });

  test("shows the catalogue grid, opens a product panel, and has a top nav bar", async ({
    page,
  }) => {
    await page.goto(`/r/${TEST_RETAILER_SLUG}`);

    await expect(
      page.getByRole("link", { name: TEST_RETAILER_DISPLAY_NAME }),
    ).toBeVisible();
    const productLink = page.locator(`a[href*="?p=${TEST_PRODUCT_SLUG}"]`);
    await expect(productLink).toBeVisible();

    await productLink.click();
    await expect(page).toHaveURL(new RegExp(`\\?p=${TEST_PRODUCT_SLUG}$`));
    await expect(page.getByRole("link", { name: "Close" })).toBeVisible();

    const primaryNav = page.getByRole("navigation", { name: "Primary" });
    await expect(primaryNav).toBeVisible();
    await expect(page.getByRole("button", { name: "Menu" })).toBeHidden();
  });
});

test.describe("mobile", () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test("shows a bottom nav dock and slide-out menu, not the desktop top bar", async ({
    page,
  }) => {
    await page.goto(`/r/${TEST_RETAILER_SLUG}`);

    const primaryNav = page.getByRole("navigation", { name: "Primary" });
    await expect(primaryNav).toBeVisible();
    await primaryNav.getByRole("link", { name: "Shop" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/r/${TEST_RETAILER_SLUG}/products$`),
    );

    await page.goto(`/r/${TEST_RETAILER_SLUG}`);
    await page.getByRole("button", { name: "Menu" }).click();
    const dialog = page.getByRole("dialog", { name: "Navigation" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("link", { name: "Book an appointment" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/r/${TEST_RETAILER_SLUG}/appointments$`),
    );
  });
});
