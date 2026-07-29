import { expect, test } from "@playwright/test";

import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } from "./fixtures";

test("platform staff views prospects list and creates a new prospect record", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_ADMIN_EMAIL);
  await page.getByLabel("Password").fill(TEST_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Enter PAON" }).click();
  await expect(page).toHaveURL(/\/retailers$/);

  await page.getByRole("link", { name: /^Demo Studio/ }).click();
  await expect(page).toHaveURL(/\/prospects$/);
  await expect(
    page.getByRole("heading", { name: /Demo Studio|Prospects/ }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Create prospect" }).click();
  await expect(page).toHaveURL(/\/prospects\/new$/);
  await expect(
    page.getByRole("heading", { name: /New prospect|Create prospect/ }),
  ).toBeVisible();

  const companyName = `E2E Commercials ${Date.now()}`;
  await page.getByLabel("Company name").fill(companyName);
  await page.getByLabel("Website").fill("https://e2e-commercials.test");
  await page.getByLabel("Primary contact").fill("Commercial E2E");
  await page.getByLabel("Contact email").fill("commercial-e2e@paon.test");
  await page
    .getByLabel("Next revenue action")
    .fill("E2E commercial test action");
  await page
    .getByLabel("Observed opportunities")
    .fill("E2E commercial test opportunities");

  await page
    .getByRole("button", {
      name: "Create prospect and open Demo Studio",
    })
    .click();

  await expect(page).toHaveURL(/\/prospects\/[^/]+\/studio$/);
  await expect(page.getByText(companyName)).toBeVisible();
});

test("platform staff views inquiries list", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_ADMIN_EMAIL);
  await page.getByLabel("Password").fill(TEST_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Enter PAON" }).click();
  await expect(page).toHaveURL(/\/retailers$/);

  await page.goto("/inquiries");
  await expect(page).toHaveURL(/\/inquiries$/);
  // Either a list of inquiries or an empty state is acceptable
  const hasInquiries = await page
    .getByRole("list")
    .or(page.getByText(/No inquiries|inquiry/i))
    .first()
    .isVisible();
  expect(hasInquiries).toBe(true);
});
