import { expect, test } from "@playwright/test";

import { TEST_OWNER_EMAIL, TEST_OWNER_PASSWORD } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("owner records fit-tool observations against a work order", async ({
  page,
}) => {
  await page.goto("/alterations/new");
  await page.getByLabel("Customer").selectOption({ index: 1 });
  await page.getByLabel("Garment type").fill("Grey herringbone waistcoat");
  await page
    .getByLabel("Description")
    .fill("Customer-owned waistcoat, three-piece suit.");
  await page
    .getByLabel("Intake condition")
    .fill("Good condition, no visible wear.");
  await page.getByLabel("Observation area").fill("Chest");
  await page
    .getByLabel("Observation", { exact: true })
    .fill("Chest is snug across the third button.");
  await page.getByLabel("Work-now task").fill("Let out chest 5 mm");
  await page.getByRole("button", { name: "Create work order" }).click();
  await expect(page).toHaveURL(/\/alterations\/[0-9a-f-]+$/);

  await expect(page.getByRole("heading", { name: "Fit tools" })).toBeVisible();

  // Voice slider: chip tap applies a value without needing speech input.
  const neigingRow = page.locator('[data-field="Neiging"]');
  await neigingRow.getByRole("button", { name: "+1.0" }).click();
  await expect(page.getByText("Observation recorded.")).toBeVisible();
  await expect(page.getByText("Neiging · +1.0")).toBeVisible();

  // Silhouette carousel: switch tab, select the default body type.
  await page.getByRole("tab", { name: "Silhouette" }).click();
  await page.getByRole("button", { name: "Selecteer silhouet" }).click();
  await expect(page.getByText("Observation recorded.")).toBeVisible();
  await expect(page.getByText("Silhouet · Slank")).toBeVisible();
});
