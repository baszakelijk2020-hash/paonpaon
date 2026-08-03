import { createSupabaseAdminClient } from "@paon/database";
import { expect, test } from "@playwright/test";

import {
  TEST_ORDER_PRODUCT_SLUG,
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
  TEST_RETAILER_SLUG,
} from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("owner creates a capsule drop, publishes it, and sees it listed", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  const { data: retailer } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");

  const unique = Date.now();
  const title = `E2E Drop ${unique}`;
  // A distinct week to avoid colliding with any drop another run left.
  const weekStart = new Date(Date.now() + (unique % 1000) * 86_400_000)
    .toISOString()
    .slice(0, 10);

  try {
    await page.goto("/capsule-drops");
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Theme (optional)").fill("E2E theme");
    await page.getByLabel("Week starting").fill(weekStart);
    await page
      .getByLabel("Product slugs, one per line, in display order")
      .fill(TEST_ORDER_PRODUCT_SLUG);
    await page.getByRole("button", { name: "Create drop" }).click();

    const row = page.locator("li", { hasText: title });
    await expect(row).toBeVisible();
    await expect(row.getByText("Draft")).toBeVisible();

    await row.getByRole("button", { name: "Publish" }).click();
    await expect(row.getByText("Published")).toBeVisible();
  } finally {
    await admin
      .from("micro_capsule_drops")
      .delete()
      .eq("retailer_id", retailer.id)
      .eq("title", title);
  }
});
