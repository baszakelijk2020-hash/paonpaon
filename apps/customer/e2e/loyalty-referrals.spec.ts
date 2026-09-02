import { createSupabaseAdminClient } from "@paon/database";
import { expect, test } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL, TEST_RETAILER_SLUG } from "./fixtures";

/**
 * Exercises the referral conversion triggers (ADR-025) end to end: a
 * signed-in shopper invites a friend, that friend's Customer Portal
 * signup is simulated (a service-role-only step — a second real magic
 * link would invalidate this suite's shared shopper identity), and the
 * friend's first delivered order is simulated the same way order
 * fulfillment is: a retailer staff action, out of Customer Portal's
 * reach, so it's driven directly via the admin client here.
 */
test("a referral converts through signup and first delivered order", async ({
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
  const suffix = Date.now();
  const referredEmail = `e2e-referred-${suffix}@paon.test`;

  const { data: retailer } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");

  await admin
    .from("loyalty_programs")
    .upsert(
      { retailer_id: retailer.id, enabled: true, referral_points: 500 },
      { onConflict: "retailer_id" },
    );

  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email: TEST_CUSTOMER_EMAIL,
    });
  if (linkError || !linkData.properties) {
    throw new Error(
      `Failed to generate magic link: ${linkError?.message ?? "unknown error"}`,
    );
  }
  await page.goto(
    `/auth/confirm?token_hash=${linkData.properties.hashed_token}&type=magiclink`,
  );
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/loyalty");
  const joinButton = page.getByRole("button", {
    name: "Join loyalty programme",
  });
  if (await joinButton.isVisible().catch(() => false)) {
    await joinButton.click();
  }

  await page.getByPlaceholder("Their email address").fill(referredEmail);
  await page.getByRole("button", { name: "Send invitation" }).click();
  // Scoped to this referral's own row — the referrer may have other
  // referrals from prior runs/tests sharing the same identity.
  const referralRow = page.locator("li", { hasText: referredEmail });
  await expect(referralRow).toContainText("Invited");

  const { data: referrerCustomer } = await admin
    .from("customers")
    .select("id")
    .eq("retailer_id", retailer.id)
    .eq("email", TEST_CUSTOMER_EMAIL)
    .single();
  if (!referrerCustomer) throw new Error("referrer customer row missing");

  const { data: accountBefore } = await admin
    .from("loyalty_accounts")
    .select("points_balance")
    .eq("retailer_id", retailer.id)
    .eq("customer_id", referrerCustomer.id)
    .single();
  const pointsBefore = accountBefore?.points_balance ?? 0;

  // Simulate the referred friend signing up at this retailer — the
  // same inline-Customer-creation shape place_order/add_to_cart use,
  // which is what actually fires match_referral_after_customer_link
  // in production, not a browser action this test can drive.
  const { data: referredUser, error: referredUserError } =
    await admin.auth.admin.createUser({
      email: referredEmail,
      email_confirm: true,
    });
  if (referredUserError || !referredUser.user) {
    throw new Error(
      `Failed to create referred user: ${referredUserError?.message ?? "unknown error"}`,
    );
  }
  const { data: referredCustomer, error: referredCustomerError } = await admin
    .from("customers")
    .insert({
      retailer_id: retailer.id,
      user_id: referredUser.user.id,
      full_name: "E2E Referred Friend",
      email: referredEmail,
      lifecycle_stage: "prospect",
    })
    .select("id")
    .single();
  if (referredCustomerError || !referredCustomer) {
    throw new Error(
      `Failed to create referred customer: ${referredCustomerError?.message ?? "unknown error"}`,
    );
  }

  await page.reload();
  await expect(referralRow).toContainText("Signed up");

  // Simulate the referred friend's first delivered order — fulfillment
  // is a retailer staff action Customer Portal never performs.
  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      retailer_id: retailer.id,
      customer_id: referredCustomer.id,
      order_number: `E2E-REF-${suffix}`,
      status: "pending_payment",
      channel: "online",
      currency: "USD",
      subtotal_amount_minor_units: 100000,
      total_amount_minor_units: 100000,
    })
    .select("id")
    .single();
  if (orderError || !order) {
    throw new Error(
      `Failed to create referred order: ${orderError?.message ?? "unknown error"}`,
    );
  }
  const { error: deliverError } = await admin
    .from("orders")
    .update({ status: "delivered" })
    .eq("id", order.id);
  if (deliverError) throw deliverError;

  await page.reload();
  await expect(referralRow).toContainText("Reward issued");

  const { data: accountAfter } = await admin
    .from("loyalty_accounts")
    .select("points_balance")
    .eq("retailer_id", retailer.id)
    .eq("customer_id", referrerCustomer.id)
    .single();
  expect((accountAfter?.points_balance ?? 0) - pointsBefore).toBe(500);

  // Create a reward the authenticated referrer can afford, then exercise the
  // real customer form and verify the database-side redemption it invokes.
  const rewardName = `E2E redeem reward ${suffix}`;
  const { data: reward, error: rewardError } = await admin
    .from("rewards")
    .insert({
      retailer_id: retailer.id,
      name: rewardName,
      type: "discount_percent",
      points_cost: 100,
      active: true,
    })
    .select("id")
    .single();
  if (rewardError || !reward) {
    throw new Error(
      `Failed to create redemption reward: ${rewardError?.message ?? "unknown error"}`,
    );
  }

  await page.reload();
  const rewardForm = page.locator("form", { hasText: rewardName });
  const redeemButton = rewardForm.getByRole("button", { name: "Redeem" });
  await expect(redeemButton).toBeEnabled();
  await redeemButton.click();

  await expect
    .poll(async () => {
      const { count, error } = await admin
        .from("reward_redemptions")
        .select("id", { count: "exact", head: true })
        .eq("reward_id", reward.id);
      if (error) throw error;
      return count ?? 0;
    })
    .toBe(1);

  const { data: accountAfterRedemption, error: balanceError } = await admin
    .from("loyalty_accounts")
    .select("points_balance")
    .eq("retailer_id", retailer.id)
    .eq("customer_id", referrerCustomer.id)
    .single();
  if (balanceError) throw balanceError;
  expect(accountAfterRedemption?.points_balance).toBe(
    (accountAfter?.points_balance ?? 0) - 100,
  );
});
