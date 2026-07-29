import { createSupabaseAdminClient } from "@paon/database";
import { expect, test } from "@playwright/test";

import {
  TEST_CUSTOMER_EMAIL,
  TEST_PRODUCT_SLUG,
  TEST_RETAILER_SLUG,
} from "./fixtures";

test("a signed-in shopper saves and removes a product from their wishlist", async ({
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

  const { data: retailerRow } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailerRow) throw new Error("fixture retailer missing");
  const { data: productRow } = await admin
    .from("products")
    .select("id")
    .eq("retailer_id", retailerRow.id)
    .eq("slug", TEST_PRODUCT_SLUG)
    .single();
  if (!productRow) throw new Error("fixture product missing");
  const { data: variantRow } = await admin
    .from("product_variants")
    .select("id")
    .eq("product_id", productRow.id)
    .limit(1)
    .single();
  if (!variantRow) throw new Error("fixture variant missing");

  // toggle_wishlist_item flips state — clear any leftover saved item
  // from a prior interrupted run so this test starts from "not saved".
  const { data: customerRow } = await admin
    .from("customers")
    .select("id")
    .eq("retailer_id", retailerRow.id)
    .eq("email", TEST_CUSTOMER_EMAIL)
    .maybeSingle();
  if (customerRow) {
    const { data: wishlistRow } = await admin
      .from("wishlists")
      .select("id")
      .eq("customer_id", customerRow.id)
      .eq("is_default", true)
      .maybeSingle();
    if (wishlistRow) {
      await admin
        .from("wishlist_items")
        .delete()
        .eq("wishlist_id", wishlistRow.id)
        .eq("product_variant_id", variantRow.id);
    }
  }

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

  await page.goto(
    `/r/${TEST_RETAILER_SLUG}/products/${TEST_PRODUCT_SLUG}?legacy=1`,
  );
  const toggleButton = page.getByRole("button", {
    name: /Save to wishlist|Saved to wishlist/,
  });
  await expect(toggleButton).toHaveText("♡ Save to wishlist");
  await toggleButton.click();
  await expect(toggleButton).toHaveText("♥ Saved to wishlist");

  await page.goto("/wishlist");
  await expect(page.getByText("E2E Storefront Overcoat")).toBeVisible();

  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("Nothing saved yet.")).toBeVisible();
});
