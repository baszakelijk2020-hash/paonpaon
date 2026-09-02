import { expect, test } from "@playwright/test";

import { TEST_OWNER_EMAIL, TEST_OWNER_PASSWORD } from "./fixtures";

test.describe("Login", () => {
  test("redirects unauthenticated visitors to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByRole("heading", { name: "Open the atelier." }),
    ).toBeVisible();
  });

  test("shows an error for invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
    await page.getByLabel("Password").fill("definitely-wrong-password");
    await page.getByRole("button", { name: "Enter the atelier" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "don't match" }),
    ).toBeVisible();
  });

  test("signs an accepted owner in and lands on the dashboard", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
    await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
    await page.getByRole("button", { name: "Enter the atelier" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(
      page.getByRole("heading", { name: "The atelier, at a glance." }),
    ).toBeVisible();
    await expect(
      page.getByRole("complementary").getByText(TEST_OWNER_EMAIL),
    ).toBeVisible();
  });

  test("canonical retailer-owner quick login lands on the demo dashboard", async ({
    page,
  }) => {
    await page.goto("/login");
    await page
      .getByRole("button", {
        name: "Retailer owner · Nebel & Spiegel",
      })
      .click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(
      page
        .getByRole("complementary")
        .getByText("contact+atelier-demo-owner@nebelspiegel.com"),
    ).toBeVisible();
  });
});
