import { createSupabaseAdminClient } from "@paon/database";
import { expect, test, type Page } from "@playwright/test";

/**
 * PHASE 20.27 — orders history and duplicate-suppression proof.
 *
 * Contract:
 * - PHASE 20.12 / CUSTOMER_ENVIRONMENT_REBUILD_V3.md:212-217 — Pending
 *   Orders renders first, then Order History; History is the complete
 *   purchase record. No order appears twice in either list.
 * - PHASE 10.2 — HoneymoonProgrammeRepository.ensureForOrder is idempotent:
 *   recomputed fresh from live order status on every read, never a second
 *   row/duplicated action from repeated views.
 *
 * Uses the existing demo customer (Isabelle) rather than a freshly-signed-up
 * one — Supabase's admin `generateLink` issues a different verification type
 * for a never-before-seen email than for an already-confirmed user, which
 * `/auth/confirm` (hardcoded to `type=magiclink`) rejects as `invalid_invite`.
 * Two dedicated test orders are added under her real customer/retailer and
 * removed again in `finally`, leaving her real order history untouched.
 */

async function signInIsabelle(page: Page): Promise<void> {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Test requires local Supabase variables.");
  }
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: "contact+isabelle@nebelspiegel.com",
  });
  if (error || !data.properties) {
    throw error ?? new Error("magic link missing");
  }
  await page.goto(
    `/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`,
  );
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("orders history has no duplicate entries, pending renders before history, and the honeymoon timeline is idempotent across reloads", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Test requires local Supabase variables.");
  }
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  const { data: retailer } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", "atelier-demo")
    .single();
  if (!retailer) throw new Error("atelier-demo retailer fixture missing");

  const { data: customerRow } = await admin
    .from("customers")
    .select("id, retailer_id")
    .eq("email", "contact+isabelle@nebelspiegel.com")
    .eq("retailer_id", retailer.id)
    .single();
  if (!customerRow) throw new Error("Isabelle demo customer fixture missing");

  const { data: variantRow } = await admin
    .from("product_variants")
    .select("id, product:products!inner(retailer_id)")
    .eq("products.retailer_id", customerRow.retailer_id)
    .limit(1)
    .single();
  if (!variantRow) throw new Error("no product variant under atelier-demo");

  const now = new Date().toISOString();
  const pendingOrderId = crypto.randomUUID();
  const deliveredOrderId = crypto.randomUUID();
  const orderRows = [
    {
      id: pendingOrderId,
      retailer_id: customerRow.retailer_id,
      customer_id: customerRow.id,
      order_number: `E2E-PENDING-${Date.now()}`,
      status: "placed" as const,
      channel: "online" as const,
      currency: "EUR",
      subtotal_amount_minor_units: 100000,
      total_amount_minor_units: 100000,
      placed_at: now,
      created_at: now,
      updated_at: now,
    },
    {
      id: deliveredOrderId,
      retailer_id: customerRow.retailer_id,
      customer_id: customerRow.id,
      order_number: `E2E-DELIVERED-${Date.now()}`,
      status: "delivered" as const,
      channel: "online" as const,
      currency: "EUR",
      subtotal_amount_minor_units: 100000,
      total_amount_minor_units: 100000,
      placed_at: now,
      created_at: now,
      updated_at: now,
    },
  ];

  try {
    const { error: insertError } = await admin.from("orders").insert(orderRows);
    if (insertError) throw insertError;

    const { error: lineError } = await admin.from("order_lines").insert({
      order_id: pendingOrderId,
      product_variant_id: variantRow.id,
      quantity: 1,
      unit_price_amount_minor_units: 100000,
      unit_price_currency: "EUR",
    });
    if (lineError) throw lineError;

    await signInIsabelle(page);
    await page.goto("/orders");
    await expect(page).toHaveURL(/\/orders$/);

    // Pending Orders renders before Order History, and the new orders
    // appear — the pending one in both sections, the delivered one only in
    // history — with no order id duplicated within either section.
    const pendingSection = page.locator("section", {
      hasText: "Pending orders",
    });
    const historySection = page.locator("section", {
      hasText: "Order history",
    });
    await expect(pendingSection).toBeVisible();
    await expect(historySection).toBeVisible();
    const pendingBox = await pendingSection.boundingBox();
    const historyBox = await historySection.boundingBox();
    if (!pendingBox || !historyBox) {
      throw new Error("could not measure section positions");
    }
    expect(pendingBox.y).toBeLessThan(historyBox.y);

    await expect(
      pendingSection.locator(`a[href="/orders/${pendingOrderId}"]`),
    ).toHaveCount(1);
    await expect(
      historySection.locator(`a[href="/orders/${pendingOrderId}"]`),
    ).toHaveCount(1);
    await expect(
      historySection.locator(`a[href="/orders/${deliveredOrderId}"]`),
    ).toHaveCount(1);
    await expect(
      pendingSection.locator(`a[href="/orders/${deliveredOrderId}"]`),
    ).toHaveCount(0);

    // No order id appears more than once within the same section.
    const historyHrefs = await historySection
      .locator("a[href^='/orders/']")
      .evaluateAll((links) => links.map((l) => l.getAttribute("href")));
    expect(new Set(historyHrefs).size).toBe(historyHrefs.length);

    // Honeymoon programme timeline is idempotent: reloading the order
    // detail page must not duplicate or change the rendered action state.
    await page.goto(`/orders/${pendingOrderId}`);
    await expect(page).toHaveURL(new RegExp(`/orders/${pendingOrderId}$`));
    const firstView = await page.locator("main").innerText();

    await page.reload();
    const secondView = await page.locator("main").innerText();
    await page.reload();
    const thirdView = await page.locator("main").innerText();

    expect(secondView).toBe(firstView);
    expect(thirdView).toBe(firstView);
  } finally {
    await admin.from("orders").delete().eq("id", pendingOrderId);
    await admin.from("orders").delete().eq("id", deliveredOrderId);
  }
});
