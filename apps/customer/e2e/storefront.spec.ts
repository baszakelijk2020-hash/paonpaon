import { createSupabaseAdminClient } from "@paon/database";
import { expect, test } from "@playwright/test";

import {
  TEST_CUSTOMER_EMAIL,
  TEST_PRODUCT_SLUG,
  TEST_RETAILER_DISPLAY_NAME,
  TEST_RETAILER_SLUG,
} from "./fixtures";

test("browsing the storefront requires no sign-in", async ({ page }) => {
  await page.goto(`/r/${TEST_RETAILER_SLUG}/products`);
  await expect(page.getByText(TEST_RETAILER_DISPLAY_NAME)).toBeVisible();
  await expect(page.getByText("E2E Storefront Overcoat")).toBeVisible();

  await page.getByText("E2E Storefront Overcoat").click();
  await expect(
    page.getByRole("heading", { name: "E2E Storefront Overcoat" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Sign in to purchase" }),
  ).toBeVisible();
});

test("a signed-in shopper places an order and sees it in their order history", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: TEST_CUSTOMER_EMAIL,
  });
  if (error || !data.properties) {
    throw new Error(
      `Failed to generate magic link: ${error?.message ?? "unknown error"}`,
    );
  }

  await page.goto(
    `/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`,
  );
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto(`/r/${TEST_RETAILER_SLUG}/products/${TEST_PRODUCT_SLUG}`);
  await page.getByLabel("Qty").fill("2");
  await page.getByRole("button", { name: "Place order" }).click();

  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]+$/);
  await expect(page.getByText("$9,000.00")).toBeVisible();

  await page.goto("/orders");
  await expect(page.getByText(/ORD-\d+/)).toBeVisible();
});
