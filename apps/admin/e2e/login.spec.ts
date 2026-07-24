import { expect, test } from "@playwright/test";

import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } from "./fixtures";

test.describe("Login", () => {
  test("redirects unauthenticated visitors to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByRole("heading", { name: "Good to see you." }),
    ).toBeVisible();
  });

  test("shows an error for invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_ADMIN_EMAIL);
    await page.getByLabel("Password").fill("definitely-wrong-password");
    await page.getByRole("button", { name: "Enter PAON" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "don't match" }),
    ).toBeVisible();
  });

  test("signs a platform admin in and lands on the retailers list", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_ADMIN_EMAIL);
    await page.getByLabel("Password").fill(TEST_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Enter PAON" }).click();

    await expect(page).toHaveURL(/\/retailers$/);
    await expect(
      page.getByRole("heading", { name: "The network, clearly in view." }),
    ).toBeVisible();
    await expect(
      page.getByRole("complementary").getByText(TEST_ADMIN_EMAIL),
    ).toBeVisible();
  });
});
