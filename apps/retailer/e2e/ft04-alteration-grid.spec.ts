import { expect, test } from "@playwright/test";

import { TEST_OWNER_EMAIL, TEST_OWNER_PASSWORD } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("FT-04 saves a locked grid revision and opens selective dispatch", async ({
  page,
}) => {
  await page.goto("/alterations/new");
  await page.getByLabel("Customer").selectOption({ index: 1 });
  await page.getByLabel("Garment type").fill("FT-04 grid test suit");
  await page
    .getByLabel("Description")
    .fill("Suit prepared for first-fitting grid coverage.");
  await page.getByLabel("Intake condition").fill("Good condition.");
  await page.getByLabel("Observation area").fill("Waist");
  await page
    .getByLabel("Observation", { exact: true })
    .fill("Requires fitting review.");
  await page.getByLabel("Work-now task").fill("Initial fitting review");
  await page.getByRole("button", { name: "Create work order" }).click();
  await expect(page).toHaveURL(/\/alterations\/[0-9a-f-]+$/);

  await expect(
    page.getByRole("heading", { name: "First-fitting alteration grid" }),
  ).toBeVisible();
  const firstPositiveControl = page
    .locator('select[aria-label$="positive"]')
    .first();
  await firstPositiveControl.selectOption("0.5");
  await page
    .getByPlaceholder("Fitting notes (optional)")
    .fill("Record a half-unit adjustment.");
  await page.getByRole("button", { name: "Save immutable snapshot" }).click();

  await expect(page.getByText("Locked version 1")).toBeVisible();
  await expect(firstPositiveControl).toBeDisabled();
  await page.getByRole("button", { name: "Unlock and revise" }).click();
  await expect(firstPositiveControl).toBeEnabled();

  // Reload the original locked history before opening the dark selective flow.
  await page.reload();
  await page
    .getByRole("button", { name: "Create selective work order" })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Selective alteration work order",
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('input[type="checkbox"]')).toHaveCount(1);
  await dialog.locator('input[type="checkbox"]').check();
  await expect(
    dialog.getByRole("button", { name: "Dispatch 1 alteration" }),
  ).toBeEnabled();
});
