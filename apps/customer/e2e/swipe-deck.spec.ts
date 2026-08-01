import { createSupabaseAdminClient } from "@paon/database";
import { expect, test } from "@playwright/test";

import {
  TEST_CUSTOMER_EMAIL,
  TEST_PRODUCT_SLUG,
  TEST_RETAILER_SLUG,
} from "./fixtures";

test("the founder swipe deck saves with the keyboard and survives reload", async ({
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

  const { data: retailer } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");
  const { data: product } = await admin
    .from("products")
    .select("id")
    .eq("retailer_id", retailer.id)
    .eq("slug", TEST_PRODUCT_SLUG)
    .single();
  if (!product) throw new Error("fixture product missing");
  const { data: variant } = await admin
    .from("product_variants")
    .select("id")
    .eq("product_id", product.id)
    .limit(1)
    .single();
  if (!variant) throw new Error("fixture variant missing");

  const { data: customer } = await admin
    .from("customers")
    .select("id")
    .eq("retailer_id", retailer.id)
    .eq("email", TEST_CUSTOMER_EMAIL)
    .single();
  if (!customer) throw new Error("fixture customer missing");
  const { data: wishlist } = await admin
    .from("wishlists")
    .select("id")
    .eq("customer_id", customer.id)
    .eq("is_default", true)
    .maybeSingle();
  if (wishlist) {
    await admin
      .from("wishlist_items")
      .delete()
      .eq("wishlist_id", wishlist.id)
      .eq("product_variant_id", variant.id);
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
    `/r/${TEST_RETAILER_SLUG}/swipe?products=${encodeURIComponent(product.id)}`,
  );
  const card = page.getByRole("button", {
    name: /E2E Storefront Overcoat.*right arrow to save/i,
  });
  await expect(card).toBeVisible();
  await card.focus();
  await page.keyboard.press("ArrowRight");
  await expect(card).not.toBeVisible();

  await expect
    .poll(async () => {
      const { data: persistedWishlist } = await admin
        .from("wishlists")
        .select("id")
        .eq("customer_id", customer.id)
        .eq("is_default", true)
        .single();
      if (!persistedWishlist) return 0;
      const { count } = await admin
        .from("wishlist_items")
        .select("*", { count: "exact", head: true })
        .eq("wishlist_id", persistedWishlist.id)
        .eq("product_variant_id", variant.id);
      return count;
    })
    .toBe(1);

  await page.reload();
  await expect(
    page.getByRole("button", { name: /E2E Storefront Overcoat/i }),
  ).toBeVisible();
  await page.goto("/wishlist");
  await expect(page.getByText("E2E Storefront Overcoat")).toBeVisible();
});
