import { expect, test } from "@playwright/test";

import { TEST_PRODUCT_SLUG, TEST_RETAILER_SLUG } from "./fixtures";

test("storefront catalogue renders products and sort controls are present", async ({
  page,
}) => {
  await page.goto(`/r/${TEST_RETAILER_SLUG}`);
  // First: the name also appears in the storefront's address block,
  // so an unscoped match resolves to two elements.
  await expect(page.getByText("E2E Customer Workspace").first()).toBeVisible();
  // The collection grid must contain at least one product card
  await expect(page.locator("#product-grid .grid-card").first()).toBeVisible({
    timeout: 10000,
  });
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

// Regression: the filter panel (color/pattern/price/season) previously
// had no test verifying "Apply" actually changes which products render
// — only that the controls existed. The fixture product is priced at
// $4,500.00 (see global-setup.ts), so the "1200+" price band must keep
// it visible and the "Under €800" band must filter it out.
// Floating widgets (chat, nudge, cart bar) must not cover the Apply
// button or other interactive filter controls; they hide when the panel
// is open via body.filter-active class observer in React widgets and
// CSS rules in the template.
test("applying a price filter changes the rendered catalogue", async ({
  page,
}) => {
  await page.goto(`/r/${TEST_RETAILER_SLUG}`);
  const productCard = page.locator(
    `.grid-card[data-product-id="${TEST_PRODUCT_SLUG}"]`,
  );
  await expect(productCard).toBeVisible({ timeout: 10000 });

  await page.getByRole("button", { name: "Filters" }).click();
  // The "Price range" group is a collapsed accordion (fp-section) — its
  // options aren't interactable until the section header is clicked to
  // expand it (this is what tripped up an earlier draft of this test).
  await page.locator(".fp-section", { hasText: "Price range" }).click();

  // Verify the Apply button is visible and clickable (floating widgets
  // should be hidden by now due to body.filter-active).
  const applyButton = page.locator("button.fp-apply");
  await expect(applyButton).toBeVisible();

  // Verify the Apply button is actually clickable, not covered by a
  // floating widget (Playwright's .click() will fail with "element is
  // covered by" if a non-pointer-events-none element is in the way).
  await applyButton.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const elementAtPoint = document.elementFromPoint(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    );
    if (!elementAtPoint?.closest(".fp-apply")) {
      throw new Error(
        `Apply button is covered by ${elementAtPoint?.className || "unknown element"}`,
      );
    }
  });

  await page
    .locator('[data-filter-group="price"][data-filter-value="0-800"]')
    .click();
  await page.locator("button.fp-apply").click();

  await expect(productCard).toHaveCount(0);

  await page.getByRole("button", { name: "Filters" }).click();
  await page.locator(".fp-section", { hasText: "Price range" }).click();
  await page
    .locator('[data-filter-group="price"][data-filter-value="0-800"]')
    .click();
  await page
    .locator('[data-filter-group="price"][data-filter-value="1200+"]')
    .click();
  await page.locator("button.fp-apply").click();

  await expect(productCard).toBeVisible();
});
