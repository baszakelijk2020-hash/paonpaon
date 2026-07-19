import { expect, test } from "@playwright/test";

test("home page renders the admin shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("PAON Admin")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Platform administration console" }),
  ).toBeVisible();
});
