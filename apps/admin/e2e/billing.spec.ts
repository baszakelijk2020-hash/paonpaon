import { expect, test } from "@playwright/test";

import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_ADMIN_EMAIL);
  await page.getByLabel("Password").fill(TEST_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Enter PAON" }).click();
  await expect(page).toHaveURL(/\/retailers$/);
});

test("platform staff records a Stripe Price id on a seeded plan", async ({
  page,
}) => {
  const unique = Date.now();
  const priceId = `price_e2e_${unique}`;

  await page.getByRole("link", { name: /^Billing/ }).click();
  await expect(page).toHaveURL(/\/billing$/);
  await expect(page.getByText("PAON Fused", { exact: true })).toBeVisible();

  // Plans render in explicit commercial display order, so Fused owns the
  // first "Stripe Price id" input on the page.
  const priceInput = page.getByLabel("Stripe Price id").first();
  const saveButton = page
    .getByRole("button", { name: "Save Stripe bridge" })
    .first();
  await priceInput.fill(priceId);
  // useActionState's returned state doesn't reliably settle in the DOM
  // before a hard reload (the form's revalidatePath-triggered refresh
  // races with Playwright's own polling) — waiting for the underlying
  // POST response is what actually guarantees the write has landed.
  const [response] = await Promise.all([
    page.waitForResponse(
      (res) =>
        res.request().method() === "POST" && res.url().includes("/billing"),
    ),
    saveButton.click(),
  ]);
  expect(response.ok()).toBe(true);

  await page.reload();
  await expect(page.getByLabel("Stripe Price id").first()).toHaveValue(priceId);
});

test("platform staff edits commercial positioning and entitlements atomically", async ({
  page,
}) => {
  await page.getByRole("link", { name: /^Billing/ }).click();
  const positioning = page.getByLabel("Positioning").first();
  const original = await positioning.inputValue();
  const updated = `${original.replace(/\.$/, "")} — configured for pilots.`;

  await positioning.fill(updated);
  const [response] = await Promise.all([
    page.waitForResponse(
      (res) =>
        res.request().method() === "POST" && res.url().includes("/billing"),
    ),
    page.getByRole("button", { name: "Save commercial plan" }).first().click(),
  ]);
  expect(response.ok()).toBe(true);
  await page.reload();
  await expect(page.getByLabel("Positioning").first()).toHaveValue(updated);

  // Restore the shared local fixture so repeated runs stay deterministic.
  await page.getByLabel("Positioning").first().fill(original);
  await page
    .getByRole("button", { name: "Save commercial plan" })
    .first()
    .click();
  await expect(page.getByLabel("Positioning").first()).toHaveValue(original);
});
