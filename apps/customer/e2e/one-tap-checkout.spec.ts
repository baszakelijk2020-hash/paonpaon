import { createSupabaseAdminClient } from "@paon/database";
import { expect, test } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL, TEST_RETAILER_SLUG } from "./fixtures";

/**
 * "1-Tap Checkout" eligibility is a saved default shipping address — the
 * real `checkout_cart` RPC has never collected payment at all, it only
 * ever left a new order at `pending_payment`; a saved address just skips
 * the manual form that already led to that same state. Proof: before
 * saving an address, the accomplishment banner nudges the customer to
 * turn it on; after saving, the badge replaces it and "Buy now" creates a
 * real order in one click, landing on the order page.
 */
test("a customer turns on 1-Tap Checkout and buys today's pick in one click", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("requires local Supabase.");
  }
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  const { data: retailer } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");
  const { data: customer } = await admin
    .from("customers")
    .select("id")
    .eq("retailer_id", retailer.id)
    .eq("email", TEST_CUSTOMER_EMAIL)
    .single();
  if (!customer) throw new Error("fixture customer missing");

  // The shared e2e-shopper fixture must start with no saved address for
  // this test's first assertion to mean anything — other runs/specs never
  // set this, but be explicit rather than assume.
  await admin
    .from("customers")
    .update({ shipping_addresses: [] })
    .eq("id", customer.id);

  try {
    const { data: link, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: TEST_CUSTOMER_EMAIL,
    });
    if (error || !link.properties) {
      throw new Error(
        `Failed to generate magic link: ${error?.message ?? "unknown error"}`,
      );
    }
    await page.goto(
      `/auth/confirm?token_hash=${link.properties.hashed_token}&type=magiclink`,
    );
    await expect(page).toHaveURL(/\/dashboard$/);

    await expect(
      page.getByText("1-Tap Checkout is not turned on."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Buy now" })).toHaveCount(0);

    await page.getByRole("button", { name: "Turn it on" }).click();
    await page.getByLabel("Address line 1").fill("221B Baker Street");
    await page.getByLabel("City").fill("Amsterdam");
    await page.getByLabel("Postal code").fill("1011AB");
    await page.getByLabel("Country code").fill("NL");
    await page.getByRole("button", { name: "Save & turn on" }).click();

    await expect(
      page.getByText(/1-Tap Checkout is on — buy today.s pick in one tap\./),
    ).toBeVisible();
    await expect(
      page.getByText("1-Tap Checkout is not turned on."),
    ).toHaveCount(0);

    await page.getByRole("button", { name: "Buy now" }).first().click();
    await expect(page).toHaveURL(/\/orders\/[0-9a-f-]+$/);
    const orderId = page.url().split("/").pop();
    if (!orderId) throw new Error("order id missing from URL");

    const { data: order } = await admin
      .from("orders")
      .select("status, shipping_address")
      .eq("id", orderId)
      .single();
    expect(order?.status).toBe("pending_payment");
    expect(order?.shipping_address).toMatchObject({ city: "Amsterdam" });
  } finally {
    await admin
      .from("customers")
      .update({ shipping_addresses: [] })
      .eq("id", customer.id);
  }
});
