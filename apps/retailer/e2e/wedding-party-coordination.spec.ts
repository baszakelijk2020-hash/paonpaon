import { expect, test } from "@playwright/test";

import { TEST_OWNER_EMAIL, TEST_OWNER_PASSWORD } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("owner starts a wedding party, adds a groomsman, and messages the party", async ({
  page,
}) => {
  const unique = Date.now();

  await page.goto("/customers/new");
  await page.getByLabel("Full name").fill("Groom To Be");
  await page.getByLabel("Email").fill(`groom-${unique}@paon.test`);
  await page.getByRole("button", { name: "Add client" }).click();
  await expect(page).toHaveURL(/\/customers\/[0-9a-f-]+$/);
  const customerId = page.url().split("/").pop();

  await page.goto(`/wedding-parties/new?customerId=${customerId}`);
  await page.getByLabel("Venue").fill("The Grand Hall");
  await page.getByRole("button", { name: "Create wedding party" }).click();
  await expect(page).toHaveURL(/\/wedding-parties\/[0-9a-f-]+$/);

  await expect(
    page.getByRole("heading", { name: "Groom To Be" }),
  ).toBeVisible();

  await page.getByLabel("Name").fill("Best Man");
  await page.getByLabel("Email").fill(`bestman-${unique}@paon.test`);
  await page.getByLabel("Role").selectOption("best_man");
  await page.getByRole("button", { name: "Add member" }).click();

  await expect(
    page.locator("p.font-medium", { hasText: "Best Man" }),
  ).toBeVisible();
  await expect(
    page.locator("span").filter({ hasText: "invited" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Message the party" }).click();
  // The inbox selects a conversation with a query param now
  // (/messages?c=<id>), not a path segment. Accept either so this
  // assertion tracks "a conversation is open", which is what it means.
  await expect(page).toHaveURL(/\/messages(\/[0-9a-f-]+|\?c=[0-9a-f-]+)$/);
});

test("owner adds a delivery & pickup readiness instruction for the whole party", async ({
  page,
}) => {
  const unique = Date.now();

  await page.goto("/customers/new");
  await page.getByLabel("Full name").fill("Aftercare Groom");
  await page.getByLabel("Email").fill(`aftercare-groom-${unique}@paon.test`);
  await page.getByRole("button", { name: "Add client" }).click();
  await expect(page).toHaveURL(/\/customers\/[0-9a-f-]+$/);
  const customerId = page.url().split("/").pop();

  await page.goto(`/wedding-parties/new?customerId=${customerId}`);
  await page.getByLabel("Venue").fill("The Grand Hall");
  await page.getByRole("button", { name: "Create wedding party" }).click();
  await expect(page).toHaveURL(/\/wedding-parties\/[0-9a-f-]+$/);

  const instruction = `Return rentals within 3 days ${unique}`;
  await page.getByLabel("Instruction").fill(instruction);
  await page.getByRole("button", { name: "Add instruction" }).click();

  const planItem = page.locator("li", { hasText: instruction });
  await expect(planItem).toBeVisible();
  await expect(planItem.getByText("Whole party")).toBeVisible();
  await expect(planItem.getByText("Pending", { exact: true })).toBeVisible();
});
