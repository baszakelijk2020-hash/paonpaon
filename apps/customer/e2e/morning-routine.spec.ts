import { createSupabaseAdminClient } from "@paon/database";
import { expect, test } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL, TEST_RETAILER_SLUG } from "./fixtures";

test("MorningRoutine Buy button creates a real cart line when customer has default address", async ({
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

  // Get retailer and customer
  const { data: retailerRow } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailerRow) {
    throw new Error(`Retailer ${TEST_RETAILER_SLUG} not found`);
  }

  const { data: customerRow } = await admin
    .from("customers")
    .select("id")
    .eq("retailer_id", retailerRow.id)
    .eq("email", TEST_CUSTOMER_EMAIL)
    .maybeSingle();
  if (!customerRow) {
    throw new Error(`Customer ${TEST_CUSTOMER_EMAIL} not found`);
  }

  // Clear any leftover draft orders
  await admin
    .from("orders")
    .delete()
    .eq("customer_id", customerRow.id)
    .eq("status", "draft");

  // Set default shipping address for this customer
  await admin
    .from("customers")
    .update({
      shipping_addresses: [
        {
          line1: "123 Test St",
          city: "Test City",
          postalCode: "12345",
          countryCode: "US",
        },
      ],
    })
    .eq("id", customerRow.id);

  // Get the first active product with a variant
  const { data: productRow } = await admin
    .from("products")
    .select("id")
    .eq("retailer_id", retailerRow.id)
    .eq("status", "active")
    .limit(1)
    .single();
  if (!productRow) {
    throw new Error("No active product found");
  }

  const { data: variantRow } = await admin
    .from("product_variants")
    .select("id")
    .eq("product_id", productRow.id)
    .limit(1)
    .single();
  if (!variantRow) {
    throw new Error("No variant found");
  }

  // Authenticate
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

  // Navigate to morning routine page
  await page.goto("/morning-routine");
  await expect(page.getByText("MorningRoutine")).toBeVisible();

  // Generate today's routine
  const selectButton = page.getByRole("button", {
    name: /Select today|Refresh today/,
  });
  if (await selectButton.isVisible()) {
    await selectButton.click();
    // Wait for recommendations to load
    await page.waitForTimeout(2000);
  }

  // Find Buy button and click it
  const buyButtons = page.getByRole("button", { name: "Buy" });
  const buyButtonCount = await buyButtons.count();
  if (buyButtonCount > 0) {
    await buyButtons.first().click();

    // Assert that we see "Added to cart" message or button is disabled/replaced
    await expect(page.getByText("Added to cart").first()).toBeVisible({
      timeout: 5000,
    });
  }

  // Verify a real cart line was created by checking the database
  const { data: cartOrder } = await admin
    .from("orders")
    .select("id")
    .eq("customer_id", customerRow.id)
    .eq("status", "draft")
    .maybeSingle();

  expect(cartOrder).toBeTruthy();
  if (!cartOrder) return;

  const { data: lines } = await admin
    .from("order_lines")
    .select("*")
    .eq("order_id", cartOrder.id);

  expect(lines).toBeTruthy();
  expect(lines?.length).toBeGreaterThan(0);
});

test("MorningRoutine Buy button falls back to product page link when customer has no default address", async ({
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

  // Get retailer and customer
  const { data: retailerRow } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailerRow) {
    throw new Error(`Retailer ${TEST_RETAILER_SLUG} not found`);
  }

  const { data: customerRow } = await admin
    .from("customers")
    .select("id")
    .eq("retailer_id", retailerRow.id)
    .eq("email", TEST_CUSTOMER_EMAIL)
    .maybeSingle();
  if (!customerRow) {
    throw new Error(`Customer ${TEST_CUSTOMER_EMAIL} not found`);
  }

  // Clear shipping addresses and draft orders
  await admin
    .from("customers")
    .update({
      shipping_addresses: null,
    })
    .eq("id", customerRow.id);

  await admin
    .from("orders")
    .delete()
    .eq("customer_id", customerRow.id)
    .eq("status", "draft");

  // Authenticate
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

  // Navigate to morning routine page
  await page.goto("/morning-routine");
  await expect(page.getByText("MorningRoutine")).toBeVisible();

  // Generate today's routine
  const selectButton = page.getByRole("button", {
    name: /Select today|Refresh today/,
  });
  if (await selectButton.isVisible()) {
    await selectButton.click();
    // Wait for recommendations to load
    await page.waitForTimeout(2000);
  }

  // Find Buy link/button
  const buyElements = page.getByRole("link", { name: "Buy" });
  const buyCount = await buyElements.count();

  // Should have Buy as a link (not a form button) since customer is not eligible
  if (buyCount > 0) {
    const firstBuyLink = buyElements.first();
    const href = await firstBuyLink.getAttribute("href");
    expect(href).toBeTruthy();
    expect(href).toContain("/products/");
  }

  // Verify no cart was created
  const { data: cartOrder } = await admin
    .from("orders")
    .select("id")
    .eq("customer_id", customerRow.id)
    .eq("status", "draft")
    .maybeSingle();

  expect(cartOrder).toBeFalsy();
});
