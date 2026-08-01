import {
  PlatformModuleRepository,
  RetailerRepository,
  createSupabaseAdminClient,
} from "@paon/database";
import { expect, test } from "@playwright/test";

import {
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
  TEST_RETAILER_SLUG,
} from "./fixtures";

test("module lifecycle projects navigation and suppresses jobs", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
  const retailer = await new RetailerRepository(admin).findBySlug(
    TEST_RETAILER_SLUG,
  );
  expect(retailer).not.toBeNull();
  const modules = new PlatformModuleRepository(admin);

  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  const stockNavigation = page.locator(
    'nav[aria-label="Primary"] a[href="/inventory"]',
  );
  await expect(stockNavigation).toBeVisible();

  try {
    await modules.configure({
      retailerId: retailer!.id,
      moduleKey: "retail_operations",
      state: "suspended",
      authorityMode: "co_managed",
      source: "override",
      reason: "Browser proof suspension",
    });
    await page.reload();

    await expect(stockNavigation).toHaveCount(0);
    await expect(
      page.locator('nav[aria-label="Primary"] a[href="/customers"]'),
    ).toBeVisible();
    await expect(
      modules.jobEnabled({
        retailerId: retailer!.id,
        jobKey: "inventory_drift_monitor",
      }),
    ).resolves.toBe(false);

    await modules.configure({
      retailerId: retailer!.id,
      moduleKey: "retail_operations",
      state: "preview",
      authorityMode: "external",
      source: "add_on",
    });
    await page.reload();
    await expect(stockNavigation).toContainText("Stock · Preview");
  } finally {
    await modules.configure({
      retailerId: retailer!.id,
      moduleKey: "retail_operations",
      state: "active",
      authorityMode: "co_managed",
      source: "add_on",
    });
  }
});
