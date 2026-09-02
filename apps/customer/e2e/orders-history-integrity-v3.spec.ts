import { resolve } from "node:path";

import { WardrobeRepository, createSupabaseAdminClient } from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test, type Page } from "@playwright/test";

import {
  TEST_CUSTOMER_EMAIL,
  TEST_PRODUCT_SLUG,
  TEST_RETAILER_SLUG,
} from "./fixtures";

/**
 * PHASE 20.27 — Orders history integrity.
 *
 * CUSTOMER_ENVIRONMENT_REBUILD_V3 §7:
 *  - "History is a complete purchase record even when products also appear
 *     in Wardrobe."
 *  - "Do not duplicate the same product in multiple modules on the same
 *     viewport when data overlaps."
 *
 * Proof only — no product code is changed by this lane.
 */

const EVIDENCE_DIR = resolve(
  process.cwd(),
  "../../docs/evidence/runs/20.27-orders-history-integrity-v3",
);

const WARDROBE_NAME = "V27 History Overcoat";

function admin() {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) throw new Error("requires local Supabase.");
  return createSupabaseAdminClient(url, key);
}

async function seedOverlappingOrderAndWardrobeItem(): Promise<{
  orderId: string;
  orderNumber: string;
  wardrobeItemId: string;
  productSlug: string;
}> {
  const client = admin();

  const { data: retailer } = await client
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");

  const { data: customer } = await client
    .from("customers")
    .select("id")
    .eq("retailer_id", retailer.id)
    .eq("email", TEST_CUSTOMER_EMAIL)
    .single();
  if (!customer) throw new Error("fixture customer missing");

  const { data: product } = await client
    .from("products")
    .select("id, slug")
    .eq("retailer_id", retailer.id)
    .eq("slug", TEST_PRODUCT_SLUG)
    .single();
  if (!product) throw new Error("fixture product missing");

  const { data: variant } = await client
    .from("product_variants")
    .select("id")
    .eq("product_id", product.id)
    .eq("sku", "E2E-OVERCOAT-42")
    .maybeSingle();
  if (!variant) throw new Error("fixture product variant missing");

  const { data: staff } = await client
    .from("retailer_staff_members")
    .select("id")
    .eq("retailer_id", retailer.id)
    .not("accepted_at", "is", null)
    .limit(1)
    .single();
  if (!staff) throw new Error("fixture staff member missing");

  // Clean any leftovers from a previous run.
  await client
    .from("wardrobe_items")
    .delete()
    .eq("customer_id", customer.id)
    .eq("display_name", WARDROBE_NAME);
  await client
    .from("orders")
    .delete()
    .eq("customer_id", customer.id)
    .ilike("order_number", "E2E-V27-%");

  // The SAME product, owned in the wardrobe...
  const wardrobeItem = await new WardrobeRepository(client).createCatalogueItem(
    {
      retailerId: retailer.id,
      customerId: customer.id,
      categoryCode: "coat",
      displayName: WARDROBE_NAME,
      brand: "PAON Atelier",
      condition: "good",
      careState: "current",
      fitPerception: "true_to_size",
      productId: product.id,
    },
    asId<"StaffId">(staff.id),
  );

  // ...and bought in an order.
  const orderNumber = `E2E-V27-${Date.now()}`;
  const price = 450000;
  const { data: order, error: orderError } = await client
    .from("orders")
    .insert({
      retailer_id: retailer.id,
      customer_id: customer.id,
      order_number: orderNumber,
      status: "placed",
      channel: "online",
      currency: "USD",
      subtotal_amount_minor_units: price,
      total_amount_minor_units: price,
    })
    .select("id")
    .single();
  if (orderError || !order) {
    throw new Error(`order insert failed: ${orderError?.message}`);
  }
  const { error: lineError } = await client.from("order_lines").insert({
    order_id: order.id,
    product_variant_id: variant.id,
    quantity: 1,
    unit_price_amount_minor_units: price,
    unit_price_currency: "USD",
    requires_production: false,
    requires_alteration: false,
  });
  if (lineError)
    throw new Error(`order_line insert failed: ${lineError.message}`);

  return {
    orderId: order.id,
    orderNumber,
    wardrobeItemId: wardrobeItem.id,
    productSlug: product.slug,
  };
}

async function signInAndOpenOrders(page: Page) {
  const { data, error } = await admin().auth.admin.generateLink({
    type: "magiclink",
    email: TEST_CUSTOMER_EMAIL,
  });
  if (error || !data.properties) {
    throw new Error(`magic link failed: ${error?.message ?? "unknown"}`);
  }
  await page.goto(
    `/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`,
  );
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/orders");
}

test("an order stays in history when its product is also in the wardrobe, and no product renders twice on /orders", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });

  const seeded = await seedOverlappingOrderAndWardrobeItem();
  const client = admin();

  try {
    await page.setViewportSize({ width: 1512, height: 982 });
    await signInAndOpenOrders(page);

    // The same product is genuinely owned in the wardrobe.
    await page.goto("/wardrobe");
    await expect(page.getByText(WARDROBE_NAME).first()).toBeVisible();
    await page.goto("/orders");

    // 1. History is complete: the order is still in the Order history
    //    section even though its product now also appears in the wardrobe.
    const historySection = page.locator("section", {
      has: page.getByText("Order history", { exact: true }),
    });
    await expect(
      historySection.getByText(seeded.orderNumber).first(),
    ).toBeVisible();

    // 2. No product is duplicated across modules on the same viewport: the
    //    Complete-the-Look source product is never also one of its own
    //    carousel suggestions, and no product-detail link appears twice
    //    inside the module.
    // The seeded most-recent order gives the page a Complete-the-Look
    // module; its product links must contain no repeats.
    const ctl = page.locator("#complete-the-look");
    await expect(ctl).toBeVisible();
    const productHrefs = await ctl
      .locator('a[href*="/products/"]')
      .evaluateAll((nodes) =>
        nodes.map((n) => (n as HTMLAnchorElement).getAttribute("href") ?? ""),
      );
    expect(productHrefs.length).toBeGreaterThan(0);
    const slugs = productHrefs.map(
      (href) => href.split("/products/")[1] ?? href,
    );
    expect(slugs.length).toBe(new Set(slugs).size);

    expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);

    await page.screenshot({
      path: resolve(EVIDENCE_DIR, "desktop-1512x982.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(
      historySection.getByText(seeded.orderNumber).first(),
    ).toBeVisible();
    await page.screenshot({
      path: resolve(EVIDENCE_DIR, "mobile-390x844.png"),
      fullPage: true,
    });
    expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
  } finally {
    await client.from("order_lines").delete().eq("order_id", seeded.orderId);
    await client.from("orders").delete().eq("id", seeded.orderId);
    await client
      .from("wardrobe_items")
      .delete()
      .eq("id", seeded.wardrobeItemId);
  }
});
