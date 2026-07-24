import { expect, test } from "@playwright/test";

import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_ADMIN_EMAIL);
  await page.getByLabel("Password").fill(TEST_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Enter PAON" }).click();
  await expect(page).toHaveURL(/\/retailers$/);
});

test("onboards a new retailer and invites its owner", async ({ page }) => {
  const unique = Date.now();
  const slug = `e2e-atelier-${unique}`;

  await page.getByRole("link", { name: "Onboard a retailer" }).click();
  await expect(page).toHaveURL(/\/retailers\/new$/);

  await page.getByLabel("Legal name").fill("E2E Atelier, Inc.");
  await page.getByLabel("Display name").fill("E2E Atelier");
  await page.getByLabel("Slug").fill(slug);
  await page.getByLabel("Address line 1").fill("1 Test Street");
  await page.getByLabel("City").fill("Testville");
  await page.getByLabel("Postal code").fill("00000");
  await page.getByLabel("Country code").fill("US");
  await page.getByLabel("Full name").fill("Owner Ownerson");
  await page.getByLabel("Email").fill(`owner-${unique}@paon.test`);

  await page
    .getByRole("button", { name: "Create retailer & send invite" })
    .click();

  await expect(page).toHaveURL(/\/retailers\/[0-9a-f-]+$/);
  await expect(
    page.getByRole("heading", { name: "E2E Atelier" }),
  ).toBeVisible();
  await expect(page.getByText("Pending onboarding")).toBeVisible();
  await expect(page.getByText("Owner Ownerson")).toBeVisible();
  await expect(page.getByText("Invited")).toBeVisible();

  await page.goto("/retailers");
  await expect(page.getByText(slug)).toBeVisible();
});

test("rejects a duplicate slug with a field error", async ({ page }) => {
  const unique = Date.now();
  const slug = `e2e-dup-${unique}`;

  async function createWithSlug() {
    await page.goto("/retailers/new");
    await page.getByLabel("Legal name").fill("Dup Co");
    await page.getByLabel("Display name").fill("Dup Co");
    await page.getByLabel("Slug").fill(slug);
    await page.getByLabel("Address line 1").fill("1 Test Street");
    await page.getByLabel("City").fill("Testville");
    await page.getByLabel("Postal code").fill("00000");
    await page.getByLabel("Country code").fill("US");
    await page.getByLabel("Full name").fill("Owner Two");
    await page.getByLabel("Email").fill(`owner-dup-${Date.now()}@paon.test`);
    await page
      .getByRole("button", { name: "Create retailer & send invite" })
      .click();
  }

  await createWithSlug();
  await expect(page).toHaveURL(/\/retailers\/[0-9a-f-]+$/);

  await createWithSlug();
  await expect(page.getByText(/already exists/)).toBeVisible();
});
