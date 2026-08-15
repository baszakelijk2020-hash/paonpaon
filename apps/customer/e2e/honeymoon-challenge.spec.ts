import { createSupabaseAdminClient } from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL, TEST_RETAILER_SLUG } from "./fixtures";
import { writeBrowserProofRun } from "./write-browser-proof-run";

// This spec proved 10.2 end to end but produced NO evidence: it declared no
// PHASE_ITEM_ID and never called writeBrowserProofRun, so docs/evidence/runs/
// 10.2.json did not exist and 10.2 could never be shown as proven, however
// green the run was. Every other phase spec follows this pattern; this one was
// simply missed.
const PHASE_ITEM_ID = "10.2";
const BROWSER_PROOF_SPEC = "apps/customer/e2e/honeymoon-challenge.spec.ts";

let proofPassed = false;

test.afterAll(async () => {
  await writeBrowserProofRun({
    phaseItemId: PHASE_ITEM_ID,
    spec: BROWSER_PROOF_SPEC,
    status: proofPassed ? "passed" : "failed",
  });
});

/**
 * Seven-Day Wardrobe honeymoon challenge look (PHASE 10.2 / CMP-105 / WRD-104).
 * Proves that a real customer order renders an accurate owned-first composition
 * at `/orders/{orderId}/honeymoon-campaign-challenge-look`, with:
 * - 7 day sections
 * - At least one slot showing "Owned" source with wardrobe item name
 * - Gaps rendered honestly for slot types without owned or in-stock items
 */
test("honeymoon-challenge: a customer order renders an accurate owned-first seven-day wardrobe composition", async ({
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
  const retailerId = asId<"RetailerId">(retailer.id);

  const { data: customerRow } = await admin
    .from("customers")
    .select("id")
    .eq("retailer_id", retailerId)
    .eq("email", TEST_CUSTOMER_EMAIL)
    .maybeSingle();
  if (!customerRow) throw new Error("fixture customer missing");
  const customerId = asId<"CustomerId">(customerRow.id);

  // Create a unique wardrobe item for this test (jacket category)
  const testItemName = `E2E Honeymoon Challenge Jacket ${Date.now()}`;
  const { data: wardrobeItem, error: wardrobeError } = await admin
    .from("wardrobe_items")
    .insert({
      retailer_id: retailerId,
      customer_id: customerId,
      ownership_kind: "external",
      provenance_source: "customer_added",
      category_code: "jacket",
      display_name: testItemName,
      condition: "good",
      care_state: "current",
      fit_perception: "true_to_size",
      created_by_actor: "customer",
    })
    .select("id")
    .single();

  if (wardrobeError || !wardrobeItem) {
    throw new Error(
      `Failed to create wardrobe item: ${wardrobeError?.message ?? "unknown error"}`,
    );
  }

  // Create a real order for the test customer
  const orderNumber = `E2E-HONEYMOON-${Date.now()}`;
  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      retailer_id: retailerId,
      customer_id: customerId,
      order_number: orderNumber,
      status: "pending_payment",
      channel: "online",
      currency: "USD",
      subtotal_amount_minor_units: 50000,
      total_amount_minor_units: 50000,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    throw new Error(
      `Failed to create order: ${orderError?.message ?? "unknown error"}`,
    );
  }

  const orderId = order.id;

  try {
    // Ensure the auth user exists before requesting a magic link — a
    // fresh local Supabase stack's `customers` row is deliberately
    // unlinked (no `user_id`) until first sign-in, same precedent
    // global-setup.ts's own alteration fixture actor already follows.
    const { data: existingUsers, error: listUsersError } =
      await admin.auth.admin.listUsers({ perPage: 1000 });
    if (listUsersError) throw listUsersError;
    const hasAuthUser = existingUsers.users.some(
      (user) => user.email === TEST_CUSTOMER_EMAIL,
    );
    if (!hasAuthUser) {
      const { error: createUserError } = await admin.auth.admin.createUser({
        email: TEST_CUSTOMER_EMAIL,
        email_confirm: true,
      });
      if (createUserError) throw createUserError;
    }

    // Generate magic link and authenticate as the test customer
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

    // Navigate to the honeymoon campaign challenge look page
    await page.goto(`/orders/${orderId}/honeymoon-campaign-challenge-look`);

    // Assertion 1: Page renders 7 day sections (Day 1 through Day 7)
    for (let day = 1; day <= 7; day++) {
      await expect(
        page.getByRole("heading", { name: `Day ${day}`, exact: true }),
      ).toBeVisible();
    }

    // Assertion 2: At least one jacket slot shows "Owned" badge with wardrobe item name
    const ownedBadge = page.getByText("Owned");
    await expect(ownedBadge.first()).toBeVisible();

    // Assertion 3: Verify the owned item citation contains the wardrobe item name
    const citationText = await page
      .locator("text=" + testItemName)
      .first()
      .textContent();
    expect(citationText).toContain(testItemName);

    // Assertion 4: Verify that a slot without owned item or in-stock product shows "Gap" badge
    // We didn't create any shoes items or in-stock catalogue shoes, so shoes should be gaps
    const gapBadge = page.getByText("Gap");
    // Gap should appear at least once since we only provided jacket
    await expect(gapBadge.first()).toBeVisible();

    // Set only after every assertion above has held, so a partial run records
    // status="failed" rather than claiming a pass it did not earn.
    proofPassed = true;
  } finally {
    // Cleanup: delete the order and wardrobe item we created
    await admin.from("orders").delete().eq("id", orderId);
    await admin.from("wardrobe_items").delete().eq("id", wardrobeItem.id);
  }
});
