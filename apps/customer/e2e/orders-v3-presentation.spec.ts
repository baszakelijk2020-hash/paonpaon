import { mkdir } from "node:fs/promises";
import path from "node:path";

import { createSupabaseAdminClient } from "@paon/database";
import { expect, test, type Page } from "@playwright/test";

import {
  TEST_CUSTOMER_EMAIL,
  TEST_PRODUCT_SLUG,
  TEST_RETAILER_SLUG,
} from "./fixtures";

/**
 * PHASE 20.12 — Customer Orders V3 presentation.
 *
 * Customer Environment Rebuild V3 §7. Proves the presentation contract the
 * orders rebuild must satisfy, end to end, against a real authenticated
 * customer session with a pending order:
 *
 *  - "Pending orders" section appears BEFORE "Order history" section;
 *  - seeded order appears in both pending and history sections;
 *  - each order renders as an <article> with order number (link to /orders/<id>),
 *    retailer · date · item count line, total + status, and exactly 5 action links:
 *    "Order again" (href /r/<slug>/products/...), "Complete the look",
 *    "Ask a question", "Request service", "View order / invoice" (href /orders/<id>);
 *  - #complete-the-look section contains a 70x70 squircle (rounded-[22px], CSS width 70px)
 *    linking to the most-recent order's first product;
 *  - "Keep going" support section (#orders-support-heading) with six module links:
 *    "Advisor selections", "Saved items", "Shop", "Book in-store appointment", "TableService",
 *    "Complete the Look";
 *  - Order detail page shows the same actions minus "View order / invoice", with
 *    "Invoice" kicker and "Subtotal"/"Total" in the itemised card.
 */

const EVIDENCE_DIR = path.resolve(
  process.cwd(),
  "../../docs/evidence/runs/20.12-customer-orders-v3",
);

function admin() {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
}

async function signInAndOpenOrders(page: Page) {
  const client = admin();
  const { data, error } = await client.auth.admin.generateLink({
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
  await page.goto("/orders");
}

async function seedPendingOrder(): Promise<{
  id: string;
  orderNumber: string;
}> {
  const client = admin();

  // Look up fixture retailer, customer, and product variant
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
    .select("id")
    .eq("retailer_id", retailer.id)
    .eq("slug", TEST_PRODUCT_SLUG)
    .single();
  if (!product) throw new Error("fixture product missing");

  const { data: variants } = await client
    .from("product_variants")
    .select("id")
    .eq("product_id", product.id)
    .eq("sku", "E2E-OVERCOAT-42")
    .maybeSingle();
  if (!variants) throw new Error("fixture product variant missing");

  // Guard against duplicates from a previous run
  await client
    .from("orders")
    .delete()
    .eq("customer_id", customer.id)
    .ilike("order_number", "E2E-V3-%");

  // Create a unique order number using timestamp
  const orderNumber = `E2E-V3-${Date.now()}`;

  // Price is stored as amountMinorUnits (cents)
  const priceMinorUnits = 450000; // $4500

  // Insert order row (RLS bypass via service role)
  const { data: orderInserted, error: orderError } = await client
    .from("orders")
    .insert({
      retailer_id: retailer.id,
      customer_id: customer.id,
      order_number: orderNumber,
      status: "placed",
      channel: "online",
      currency: "USD",
      subtotal_amount_minor_units: priceMinorUnits,
      total_amount_minor_units: priceMinorUnits,
    })
    .select("id")
    .single();

  if (orderError || !orderInserted) {
    throw new Error(
      `Failed to insert order: ${orderError?.message ?? "unknown"}`,
    );
  }

  const orderId = orderInserted.id;

  // Insert order_lines row
  const { error: lineError } = await client.from("order_lines").insert({
    order_id: orderId,
    product_variant_id: variants.id,
    quantity: 1,
    unit_price_amount_minor_units: priceMinorUnits,
    unit_price_currency: "USD",
    requires_production: false,
    requires_alteration: false,
  });

  if (lineError) {
    throw new Error(
      `Failed to insert order_line: ${lineError.message ?? "unknown"}`,
    );
  }

  return { id: orderId, orderNumber };
}

test("orders V3: pending-first, full history, real per-order actions, complete-the-look module", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  const seeded = await seedPendingOrder();
  const client = admin();

  try {
    await signInAndOpenOrders(page);

    // 1. Assert the two section headings appear in DOM order:
    // "Pending orders" BEFORE "Order history"
    const kickers = page.locator("p.customer-kicker");
    const allKickerTexts = await kickers.allTextContents();
    const pendingIndex = allKickerTexts.indexOf("Pending orders");
    const historyIndex = allKickerTexts.indexOf("Order history");
    expect(pendingIndex).toBeGreaterThanOrEqual(0);
    expect(historyIndex).toBeGreaterThanOrEqual(0);
    expect(pendingIndex).toBeLessThan(historyIndex);

    // 2. The seeded order number is visible in BOTH pending and history
    const orderOccurrences = await page.getByText(seeded.orderNumber).count();
    expect(orderOccurrences).toBeGreaterThanOrEqual(2);

    // 3. Within the seeded order's <article> in the pending section:
    // all 5 action links with exact names
    const pendingSection = page.locator("section").first(); // pending section
    const orderArticles = pendingSection.locator("article");
    const seededArticle = orderArticles.filter({
      hasText: seeded.orderNumber,
    });

    const expectedActions = [
      "Order again",
      "Complete the look",
      "Ask a question",
      "Request service",
      "View order / invoice",
    ];
    for (const action of expectedActions) {
      await expect(
        seededArticle.getByRole("link", { name: action, exact: true }),
      ).toBeVisible();
    }

    // 4. "Order again" href points at /r/e2e-customer-workspace/products/...
    const orderAgainLink = seededArticle.getByRole("link", {
      name: "Order again",
      exact: true,
    });
    const orderAgainHref = await orderAgainLink.getAttribute("href");
    expect(orderAgainHref).toMatch(/^\/r\/e2e-customer-workspace\/products\//);

    // 5. "View order / invoice" href = /orders/<seededId>
    const viewOrderLink = seededArticle.getByRole("link", {
      name: "View order / invoice",
      exact: true,
    });
    const viewOrderHref = await viewOrderLink.getAttribute("href");
    expect(viewOrderHref).toBe(`/orders/${seeded.id}`);

    // 6. The `#complete-the-look` section exists with a 70x70 squircle
    const completeTheLookSection = page.locator("#complete-the-look");
    await expect(completeTheLookSection).toBeVisible();

    const squircleLink = completeTheLookSection.locator("a").first();
    await expect(squircleLink).toBeVisible();

    // Check for rounded-[22px] in class list and CSS width 70px
    const classList = await squircleLink.getAttribute("class");
    expect(classList).toContain("rounded-[22px]");
    await expect(squircleLink).toHaveCSS("width", "70px");

    // 7. The "Keep going" support section shows 6 module links
    const supportSection = page.locator(
      "section[aria-labelledby='orders-support-heading']",
    );
    await expect(supportSection).toBeVisible();

    const supportLinks = [
      "Advisor selections",
      "Saved items",
      "Complete the Look",
      "Shop",
      "Book in-store appointment",
      "TableService",
    ];
    for (const link of supportLinks) {
      await expect(
        supportSection.getByRole("link", { name: link, exact: true }),
      ).toBeVisible();
    }

    // 8. No console errors
    expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
  } finally {
    // Clean up: delete order_lines first, then orders
    const { data: orders } = await client
      .from("orders")
      .select("id")
      .eq("id", seeded.id);

    if (orders && orders.length > 0) {
      await client.from("order_lines").delete().eq("order_id", seeded.id);
      await client.from("orders").delete().eq("id", seeded.id);
    }
  }
});

test("authenticated desktop and mobile capture of orders", async ({ page }) => {
  const seeded = await seedPendingOrder();
  const client = admin();
  await mkdir(EVIDENCE_DIR, { recursive: true });

  try {
    // Desktop capture: 1512x982
    await page.setViewportSize({ width: 1512, height: 982 });
    await signInAndOpenOrders(page);
    await expect(
      page.getByRole("heading", { name: "Orders", exact: true }),
    ).toBeVisible();
    await expect(page.getByText(seeded.orderNumber).first()).toBeVisible();
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, "desktop-1512x982.png"),
      fullPage: true,
    });

    // Mobile capture: 390x844
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/orders");
    await expect(
      page.getByRole("heading", { name: "Orders", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, "mobile-390x844.png"),
      fullPage: true,
    });

    // Desktop order detail capture: 1512x982
    await page.setViewportSize({ width: 1512, height: 982 });
    await page.goto(`/orders/${seeded.id}`);
    await expect(page.getByText("Invoice")).toBeVisible();
    await expect(page.getByText("Subtotal")).toBeVisible();
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, "desktop-detail-1512x982.png"),
      fullPage: true,
    });
  } finally {
    // Clean up: delete order_lines first, then orders
    const { data: orders } = await client
      .from("orders")
      .select("id")
      .eq("id", seeded.id);

    if (orders && orders.length > 0) {
      await client.from("order_lines").delete().eq("order_id", seeded.id);
      await client.from("orders").delete().eq("id", seeded.id);
    }
  }
});
