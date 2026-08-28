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
 * PHASE 20.18 — Customer Orders V3, real per-order action row.
 *
 * Contract CUSTOMER_ENVIRONMENT_REBUILD_V3 §7: every order exposes real
 * actions — Order again, Complete the look, Ask a question, Request
 * service, View order/invoice. This proves each is a shipped route and,
 * where the route accepts context, carries *this* order's own product or
 * number so the action continues this order and not a generic flow.
 */

const EVIDENCE_DIR = path.resolve(
  process.cwd(),
  "../../docs/evidence/runs/20.18-customer-orders-actions-v3",
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

  const { data: variant } = await client
    .from("product_variants")
    .select("id")
    .eq("product_id", product.id)
    .eq("sku", "E2E-OVERCOAT-42")
    .maybeSingle();
  if (!variant) throw new Error("fixture product variant missing");

  await client
    .from("orders")
    .delete()
    .eq("customer_id", customer.id)
    .ilike("order_number", "E2E-A18-%");

  const orderNumber = `E2E-A18-${Date.now()}`;
  const priceMinorUnits = 450000;

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

  const { error: lineError } = await client.from("order_lines").insert({
    order_id: orderInserted.id,
    product_variant_id: variant.id,
    quantity: 1,
    unit_price_amount_minor_units: priceMinorUnits,
    unit_price_currency: "USD",
    requires_production: false,
    requires_alteration: false,
  });
  if (lineError) {
    throw new Error(`Failed to insert order_line: ${lineError.message}`);
  }

  return { id: orderInserted.id, orderNumber };
}

test("every per-order action is a real route carrying this order's own context", async ({
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

    const seededArticle = page
      .locator("section")
      .filter({ has: page.getByText("Pending orders", { exact: true }) })
      .locator("article")
      .filter({ hasText: seeded.orderNumber });
    await expect(seededArticle).toBeVisible();

    // All five §7 actions render, with exact labels.
    for (const label of [
      "Order again",
      "Complete the look",
      "Ask a question",
      "Request service",
      "View order / invoice",
    ]) {
      await expect(
        seededArticle.getByRole("link", { name: label, exact: true }),
      ).toBeVisible();
    }

    // Order again -> this retailer's real product-detail route, with the
    // required `?legacy=1` (that route otherwise redirects to the
    // storefront root — see its own file comment).
    await expect(
      seededArticle.getByRole("link", { name: "Order again", exact: true }),
    ).toHaveAttribute(
      "href",
      new RegExp(`^/r/${TEST_RETAILER_SLUG}/products/[^/?#]+\\?legacy=1$`),
    );

    // Complete the look -> the Digital Fitting Room, preloaded with THIS
    // order's product (not a bare page anchor).
    await expect(
      seededArticle.getByRole("link", {
        name: "Complete the look",
        exact: true,
      }),
    ).toHaveAttribute(
      "href",
      new RegExp(`^/digital-fitting-room\\?productSlug=${TEST_PRODUCT_SLUG}$`),
    );

    // Ask a question -> the advisor thread, prefilled with THIS order number.
    await expect(
      seededArticle.getByRole("link", {
        name: "Ask a question",
        exact: true,
      }),
    ).toHaveAttribute(
      "href",
      new RegExp(
        `^/messages\\?prefill=.*${encodeURIComponent(seeded.orderNumber)}`,
      ),
    );

    // Request service -> the real services route.
    await expect(
      seededArticle.getByRole("link", {
        name: "Request service",
        exact: true,
      }),
    ).toHaveAttribute("href", "/services");

    // View order / invoice -> THIS order's detail page.
    await expect(
      seededArticle.getByRole("link", {
        name: "View order / invoice",
        exact: true,
      }),
    ).toHaveAttribute("href", `/orders/${seeded.id}`);

    expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);

    await mkdir(EVIDENCE_DIR, { recursive: true });
    await page.setViewportSize({ width: 1512, height: 982 });
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, "desktop-1512x982.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByText(seeded.orderNumber).first()).toBeVisible();
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, "mobile-390x844.png"),
      fullPage: true,
    });

    expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
  } finally {
    await client.from("order_lines").delete().eq("order_id", seeded.id);
    await client.from("orders").delete().eq("id", seeded.id);
  }
});
