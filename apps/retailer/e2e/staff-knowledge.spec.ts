import { expect, test } from "@playwright/test";

test.describe("Staff knowledge library", () => {
  test("shows grouped sartorial knowledge cards for a logged-in owner", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Demo login — one click" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/staff/knowledge");
    await expect(
      page.getByRole("heading", { name: "Knowledge library" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Mills" })).toBeVisible();
  });
});
