import { createSupabaseAdminClient } from "@paon/database";
import { expect, test } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL, TEST_RETAILER_SLUG } from "./fixtures";

/**
 * MorningRoutine's "Buy" button creates a real order through the same
 * `add_to_cart`/`checkout_cart` RPCs one-tap-checkout uses, gated on the
 * same saved default address — no payment step. Proof: with a saved
 * address, clicking "Buy" on a catalogue pick lands on the order page
 * with a real `pending_payment` order, not just a link to the product page.
 */
test("a shopper buys today's MorningRoutine pick in one click", async ({
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

  await admin
    .from("customers")
    .update({
      shipping_addresses: [
        {
          line1: "221B Baker Street",
          city: "Amsterdam",
          postalCode: "1011AB",
          countryCode: "NL",
        },
      ],
    })
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

    await page.goto("/morning-routine");
    const generateButton = page
      .getByRole("button", { name: "Select today" })
      .or(page.getByRole("button", { name: "Refresh today" }));
    await generateButton.click();
    await expect(page.getByText("Today’s look")).toBeVisible({
      timeout: 15000,
    });

    const buyButton = page.getByRole("button", { name: "Buy" }).first();
    await expect(buyButton).toBeVisible();
    await buyButton.click();

    await expect(page).toHaveURL(/\/orders\/[0-9a-f-]+$/);
    const orderId = page.url().split("/").pop();
    if (!orderId) throw new Error("order id missing from URL");

    const { data: order } = await admin
      .from("orders")
      .select("status")
      .eq("id", orderId)
      .single();
    expect(order?.status).toBe("pending_payment");
  } finally {
    await admin
      .from("customers")
      .update({ shipping_addresses: [] })
      .eq("id", customer.id);
  }
});
