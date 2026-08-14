import { expect, test } from "@playwright/test";

import { TEST_OWNER_EMAIL, TEST_OWNER_PASSWORD } from "./fixtures";

test("FT-11 owner can review authoritative house locations", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/locations");
  await expect(
    page.getByRole("heading", { name: "House locations" }),
  ).toBeVisible();
  await expect(page.getByLabel("Retailer locations")).toBeVisible();
  await expect(page.getByText("Default house")).toBeVisible();
  await expect(page.getByText("House timezone:")).toBeVisible();
});
