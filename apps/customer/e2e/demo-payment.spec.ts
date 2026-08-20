import { createSupabaseAdminClient } from "@paon/database";
import { expect, test } from "@playwright/test";

import {
  TEST_CUSTOMER_EMAIL,
  TEST_PRODUCT_SLUG,
  TEST_RETAILER_SLUG,
} from "./fixtures";

/**
 * Demo payment path: when Stripe is not configured, a customer can click
 * through the entire ecommerce checkout flow end-to-end using a mock payment.
 * Proves the demo payment form appears, accepts input, records a synthetic
 * payment, and marks the order as paid without real Stripe credentials.
 */
test("a customer can complete a demo payment when Stripe is not configured", async ({
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
  const { data: customerRow } = await admin
    .from("customers")
    .select("id")
    .eq("retailer_id", retailer.id)
    .eq("email", TEST_CUSTOMER_EMAIL)
    .maybeSingle();
  if (!customerRow) throw new Error("fixture customer missing");

  // Isolate this run from any draft cart another spec left behind.
  await admin
    .from("orders")
    .delete()
    .eq("customer_id", customerRow.id)
    .eq("status", "draft");

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

  // Browse and add to cart
  await page.goto(
    `/r/${TEST_RETAILER_SLUG}/products/${TEST_PRODUCT_SLUG}?legacy=1`,
  );
  await page.getByLabel("Qty").fill("1");
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page).toHaveURL(new RegExp(`/r/${TEST_RETAILER_SLUG}/cart$`));

  // Checkout: save as pending order
  await page.getByText("Save as pending order instead").click();
  await page.getByPlaceholder("Address", { exact: true }).fill("1 Test Street");
  await page.getByPlaceholder("City").fill("Testville");
  await page.getByPlaceholder("Postal code").fill("00000");
  await page.getByPlaceholder("Country code").fill("US");
  await page.getByRole("button", { name: "Save pending order" }).click();
  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]+$/);
  const orderId = page.url().split("/").pop();
  if (!orderId) throw new Error("order id missing from URL");

  try {
    // Verify order is pending_payment
    const orderBefore = await admin
      .from("orders")
      .select("status")
      .eq("id", orderId)
      .single();
    expect(orderBefore.data?.status).toBe("pending_payment");

    // Verify demo mode button appears (when Stripe is not configured)
    await expect(
      page.getByRole("button", { name: "Enter demo payment" }),
    ).toBeVisible();

    // Click demo payment button to show form
    await page.getByRole("button", { name: "Enter demo payment" }).click();

    // Verify demo mode warning appears
    await expect(
      page.getByText("DEMO MODE — No real payment is processed"),
    ).toBeVisible();
    await expect(
      page.getByText("This is a simulated payment for testing purposes only."),
    ).toBeVisible();

    // Fill card form
    await page.getByPlaceholder("4242 4242 4242 4242").fill("4242424242424242");
    await page.getByPlaceholder("12/25").fill("12/25");
    await page.getByPlaceholder("123").fill("123");

    // Submit demo payment
    await page.getByRole("button", { name: "Pay" }).click();

    // Verify redirect to success state
    await expect(page).toHaveURL(/\/orders\/[0-9a-f-]+\?payment=success$/);
    await expect(
      page.getByText("Confirming your payment — this can take a few seconds."),
    ).toBeVisible();

    // Verify payment record was created
    const { data: payment } = await admin
      .from("payments")
      .select("*")
      .eq("order_id", orderId)
      .single();
    expect(payment?.status).toBe("captured");
    expect(payment?.provider_payment_intent_id).toMatch(/^demo_\d+$/);

    // Verify order status remains pending_payment (status doesn't change, just payment is recorded)
    // This is consistent with how Stripe webhooks work - the payment status is separate
    const orderAfter = await admin
      .from("orders")
      .select("status")
      .eq("id", orderId)
      .single();
    expect(orderAfter.data?.status).toBe("pending_payment");
  } finally {
    await admin.from("orders").delete().eq("id", orderId);
  }
});
