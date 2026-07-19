import { expect, test } from "@playwright/test";

test("home page renders the retailer portal shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Retailer Portal")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Run the store, from CRM to production",
    }),
  ).toBeVisible();
});
