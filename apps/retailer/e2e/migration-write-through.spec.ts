import { expect, test, type Page } from "@playwright/test";

import { TEST_OWNER_EMAIL, TEST_OWNER_PASSWORD } from "./fixtures";
import { writeBrowserProofRun } from "./write-browser-proof-run";

/**
 * PHASE 9.1 operator journey: create fixture → publish → product appears in
 * catalogue. Uses the e2e owner from global-setup (not Maison Dubois demo seed).
 */
async function signInOwner(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

let harnessPassed = false;

test.afterAll(async () => {
  await writeBrowserProofRun({
    phaseItemId: "9.1",
    spec: "apps/retailer/e2e/migration-write-through.spec.ts",
    status: harnessPassed ? "passed" : "failed",
  });
});

test("migration publish writes products into catalogue", async ({ page }) => {
  test.setTimeout(120_000);
  await signInOwner(page);

  await page.goto("/migrations");
  await expect(
    page.getByRole("heading", { name: "Migration cockpit" }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Load fixture job (dry-run)" })
    .click();
  await expect(page.getByText(/Dry-run · customers/i).first()).toBeVisible({
    timeout: 15000,
  });

  await page.getByRole("button", { name: "Publish / resume" }).first().click();
  await expect(page.getByText(/Reconcile · matched true/i).first()).toBeVisible(
    {
      timeout: 30000,
    },
  );

  await page.goto("/products");
  await expect(page.getByText("Navy Suit Jacket").first()).toBeVisible({
    timeout: 15000,
  });
  harnessPassed = true;
});
