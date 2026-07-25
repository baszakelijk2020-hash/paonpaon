import { expect, test } from "@playwright/test";

import { TEST_RETAILER_DISPLAY_NAME, TEST_RETAILER_SLUG } from "./fixtures";

test("landing page shows the storefront, bottom nav, and slide-out menu", async ({
  page,
}) => {
  await page.goto(`/r/${TEST_RETAILER_SLUG}`);

  await expect(page.getByText(TEST_RETAILER_DISPLAY_NAME)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Enter the atelier" }),
  ).toBeVisible();

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
