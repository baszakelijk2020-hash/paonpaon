import { expect, test } from "@playwright/test";

import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_ADMIN_EMAIL);
  await page.getByLabel("Password").fill(TEST_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/retailers$/);
});

test("platform staff records a Stripe Price id on a seeded plan", async ({
  page,
}) => {
  const unique = Date.now();
  const priceId = `price_e2e_${unique}`;

  await page.getByRole("link", { name: "Billing" }).click();
  await expect(page).toHaveURL(/\/billing$/);
  await expect(page.getByText("Boutique", { exact: true })).toBeVisible();

  // Plans render cheapest-first (SubscriptionPlanRepository.findAll),
  // and the seed data makes Boutique the cheapest — its price field is
  // always the first "Stripe Price id" input on the page.
  const priceInput = page.getByLabel("Stripe Price id").first();
  const saveButton = page.getByRole("button", { name: "Save" }).first();
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
