import { expect, test } from "@playwright/test";

import { TEST_OWNER_EMAIL, TEST_OWNER_PASSWORD } from "./fixtures";

test("FT-11 owner edits and persists branch location details", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/settings/locations");
  await expect(
    page.getByRole("heading", { name: "Branch locations" }),
  ).toBeVisible();

  const branchLink = page.getByRole("link", { name: /Main house/ });
  await expect(branchLink).toBeVisible();
  await branchLink.click();
  await expect(page).toHaveURL(/\/settings\/locations\/[^/]+$/);

  const storeType = page.getByLabel("Store Type");
  await expect(storeType).toBeVisible();
  const uniqueStoreType = `Flagship ${Date.now()}`;
  await storeType.fill(uniqueStoreType);

  await page.getByRole("button", { name: "Save location details" }).click();

  await page.reload();
  await expect(page.getByLabel("Store Type")).toHaveValue(uniqueStoreType);
});
