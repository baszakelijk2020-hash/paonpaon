import { expect, test } from "@playwright/test";

import { TEST_RETAILER_SLUG } from "./fixtures";

test("storefront catalogue renders products and sort controls are present", async ({
  page,
}) => {
  await page.goto(`/r/${TEST_RETAILER_SLUG}`);
  await expect(page.getByText("E2E Customer Workspace")).toBeVisible();
  // The collection grid must contain at least one product card
  await expect(
    page
      .locator('[data-product-card], .product-card, [data-testid="product"]')
      .first(),
  ).toBeVisible({ timeout: 10000 });
});

test("storefront catalogue HTML route serves the template", async ({
  page,
}) => {
  const response = await page.goto(`/r/${TEST_RETAILER_SLUG}`);
  expect(response?.status()).toBe(200);
  const content = await page.content();
  // The ported template must include the PAON chrome identifiers
  expect(content).toContain("gilda-chat-widget");
});
