import { createSupabaseAdminClient } from "@paon/database";
import { expect, test } from "@playwright/test";

import {
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
  TEST_RETAILER_SLUG,
} from "./fixtures";

test("an owner publishes a validated brand version used by the shared shell", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Brand theme e2e requires local Supabase variables.");
  }
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
  const { data: retailer } = await admin
    .from("retailers")
    .select("id, brand_theme")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("E2E retailer is missing");

  try {
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
    await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
    await page.getByRole("button", { name: "Enter the atelier" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/settings/brand");

    await page.getByLabel("Accent").fill("#7a2d31");
    await page.getByLabel("Display typography").selectOption("heritage");
    await page.getByLabel("Corner character").selectOption("tailored");
    await page.getByLabel("Version note").fill("E2E brand refinement");
    await page.getByRole("button", { name: "Publish brand version" }).click();

    await expect(page.getByRole("status")).toContainText(
      /Brand theme version \d+ is now live/,
    );
    await expect(page.getByText(/E2E brand refinement/)).toBeVisible();
    await page.goto("/dashboard");
    await expect(page.locator(".retailer-theme")).toHaveCSS(
      "--retailer-accent",
      "#7a2d31",
    );
  } finally {
    await admin
      .from("retailers")
      .update({ brand_theme: retailer.brand_theme })
      .eq("id", retailer.id);
    await admin
      .from("retailer_brand_theme_versions")
      .delete()
      .eq("retailer_id", retailer.id)
      .eq("change_note", "E2E brand refinement");
  }
});
