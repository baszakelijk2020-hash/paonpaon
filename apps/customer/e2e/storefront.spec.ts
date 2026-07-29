import { createSupabaseAdminClient } from "@paon/database";
import { expect, test } from "@playwright/test";

import {
  TEST_CUSTOMER_EMAIL,
  TEST_PRODUCT_SLUG,
  TEST_RETAILER_DISPLAY_NAME,
  TEST_RETAILER_SLUG,
} from "./fixtures";

test("browsing the storefront requires no sign-in", async ({ page }) => {
  await page.goto(`/r/${TEST_RETAILER_SLUG}`);
  await expect(page.getByText(TEST_RETAILER_DISPLAY_NAME)).toBeVisible();
  await expect(page.getByText("E2E Storefront Overcoat")).toBeVisible();

  await page.goto(
    `/r/${TEST_RETAILER_SLUG}/products/${TEST_PRODUCT_SLUG}?legacy=1`,
  );
  await expect(
    page.getByRole("heading", { name: "E2E Storefront Overcoat" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Sign in to purchase" }),
  ).toBeVisible();
});

test("a signed-in shopper builds a cart, updates a line, checks out, and sees the order in history", async ({
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

  // This test mutates its own draft cart (add_to_cart upserts by
  // variant), so a prior interrupted run must not leak into this one —
  // clear any leftover draft before exercising the flow.
  const { data: retailerRow } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (retailerRow) {
    const { data: customerRow } = await admin
      .from("customers")
      .select("id")
      .eq("retailer_id", retailerRow.id)
      .eq("email", TEST_CUSTOMER_EMAIL)
      .maybeSingle();
    if (customerRow) {
      await admin
        .from("orders")
        .delete()
        .eq("customer_id", customerRow.id)
        .eq("status", "draft");
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

  // add_to_cart: a persisted draft Order is created from the storefront.
  await page.goto(
    `/r/${TEST_RETAILER_SLUG}/products/${TEST_PRODUCT_SLUG}?legacy=1`,
  );
  await page.getByLabel("Qty").fill("1");
  await page.getByRole("button", { name: "Add to cart" }).click();

  await expect(page).toHaveURL(new RegExp(`/r/${TEST_RETAILER_SLUG}/cart$`));
  await expect(page.getByText("E2E Storefront Overcoat")).toBeVisible();
  await expect(
    page.getByText("$4,500.00", { exact: true }).first(),
  ).toBeVisible();

  // update_cart_line: the quantity stepper's "+" auto-submits and
  // recomputes the cart total — no separate "Update" button (removed as
  // unnecessary friction, see ADR-037).
  await page
    .getByRole("button", {
      name: "Increase quantity of E2E Storefront Overcoat",
    })
    .click();
  await expect(page.getByText("$9,000.00").first()).toBeVisible();

  // checkout_cart: revalidates stock/price and moves the cart to pending_payment.
  await page.getByPlaceholder("Address", { exact: true }).fill("1 Test Street");
  await page.getByPlaceholder("City").fill("Testville");
  await page.getByPlaceholder("Postal code").fill("00000");
  await page.getByPlaceholder("Country code").fill("US");
  await page.getByRole("button", { name: "Place order" }).click();

  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]+$/);
  await expect(page.getByText("$9,000.00")).toBeVisible();

  await page.goto("/orders");
  await expect(page.getByText(/ORD-\d+/).first()).toBeVisible();
});

test("storefront shows an uploaded product image", async ({ page }) => {
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

  const pngBuffer = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
  const storagePath = `${retailerRow.id}/${productRow.id}/e2e-fixture.png`;
  const { error: uploadError } = await admin.storage
    .from("product-images")
    .upload(storagePath, pngBuffer, { contentType: "image/png", upsert: true });
  if (uploadError) throw uploadError;
  const {
    data: { publicUrl },
  } = admin.storage.from("product-images").getPublicUrl(storagePath);
  await admin
    .from("products")
    .update({ primary_image_url: publicUrl })
    .eq("id", productRow.id);

  await page.goto(`/r/${TEST_RETAILER_SLUG}`);
  await expect(
    page.locator('img[src*="product-images"]').first(),
  ).toBeVisible();

  await page.goto(
    `/r/${TEST_RETAILER_SLUG}/products/${TEST_PRODUCT_SLUG}?legacy=1`,
  );
  await expect(
    page.locator('img[src*="product-images"]').first(),
  ).toBeVisible();
});
