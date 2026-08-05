import { expect, test } from "@playwright/test";

import { TEST_OWNER_EMAIL, TEST_OWNER_PASSWORD } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("owner adds and removes a staff shift on the roster", async ({ page }) => {
  await page.goto("/staff/roster");
  await expect(
    page.getByRole("heading", { name: "Team roster" }),
  ).toBeVisible();

  const today = new Date().toISOString().slice(0, 10);
  await page.getByLabel("Teammate").selectOption({ index: 0 });
  await page.getByLabel("Date").fill(today);
  await page.getByLabel("Start").fill("09:00");
  await page.getByLabel("End").fill("17:00");
  await page.getByRole("button", { name: "Add shift" }).click();

  await expect(page.getByText("09:00–17:00")).toBeVisible();

  await page
    .locator("form", { has: page.getByText("09:00–17:00") })
    .getByRole("button", { name: "Remove shift" })
    .click();
  await expect(page.getByText("09:00–17:00")).toHaveCount(0);
});

test("owner clocks in and out from the dashboard, hours reflect on the roster", async ({
  page,
}) => {
  await expect(page.getByText("Not clocked in")).toBeVisible();
  await page.getByRole("button", { name: "Clock in" }).click();
  await expect(page.getByText(/Clocked in at/)).toBeVisible();

  await page.getByRole("button", { name: "Clock out" }).click();
  await expect(page.getByText("Not clocked in")).toBeVisible();

  await page.goto("/staff/roster");
  await expect(
    page.getByRole("heading", { name: "Team roster" }),
  ).toBeVisible();
});
