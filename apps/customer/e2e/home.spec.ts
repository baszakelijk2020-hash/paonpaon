import { expect, test } from "@playwright/test";

test("home page renders the customer portal shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Customer Portal")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Your relationship with the house, in one place",
    }),
  ).toBeVisible();
});
