import { resolve } from "node:path";

import { createSupabaseAdminClient } from "@paon/database";
import { expect, test } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL, TEST_RETAILER_SLUG } from "./fixtures";

/**
 * PHASE 20.11 — Customer Overview V3, daily-return composition.
 *
 * The repair being proven: the rightmost cell of the desktop green
 * local-context strip again carries the REAL daily MorningRoutine
 * suit/jacket image (object-contain, never clipped) — and nothing else
 * the contract forbids came back with it (no duplicate greeting, no
 * "Today's look" caption, no "Today's Edit", no one-tap-setup ad, no
 * Complete the Look). Contract: CUSTOMER_ENVIRONMENT_REBUILD_V3 §4.
 */

const FIXTURE_IMAGE_URL =
  "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22400%22%20height%3D%22600%22%3E%3Crect%20width%3D%22400%22%20height%3D%22600%22%20fill%3D%22%236b7360%22%2F%3E%3C%2Fsvg%3E";

test("the overview strip carries the real daily image above the OOTD, clamped and clean", async ({
  page,
}, testInfo) => {
  const evidencePath = (...parts: string[]) =>
    resolve(
      testInfo.config.rootDir,
      "../../../docs/evidence/runs/20.11-customer-overview-v3",
      ...parts,
    );

  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

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

  // Seed fixture product with stable data-URI image for deterministic rendering.
  const { error: seedError } = await admin
    .from("products")
    .update({ primary_image_url: FIXTURE_IMAGE_URL })
    .eq("retailer_id", retailer.id)
    .is("deleted_at", null);
  if (seedError) throw seedError;

  const { data: customerRow } = await admin
    .from("customers")
    .select("id")
    .eq("email", TEST_CUSTOMER_EMAIL)
    .eq("retailer_id", retailer.id)
    .maybeSingle();
  if (!customerRow) throw new Error("fixture customer missing");

  const todayDate = new Date().toISOString().slice(0, 10);

  // Clean up any stale selection before seeding fresh one.
  await admin
    .from("morning_routine_selections")
    .delete()
    .eq("customer_id", customerRow.id)
    .eq("for_date", todayDate);

  // Seed a deterministic daily selection with real product/variant link.
  // Look up the fixture product and variant by their test slugs/skus.
  const { data: product } = await admin
    .from("products")
    .select("id")
    .eq("slug", "e2e-storefront-overcoat")
    .eq("retailer_id", retailer.id)
    .single();
  if (!product) throw new Error("e2e-storefront-overcoat product not found");

  const { data: variant } = await admin
    .from("product_variants")
    .select("id")
    .eq("sku", "E2E-OVERCOAT-42")
    .eq("product_id", product.id)
    .single();
  if (!variant) throw new Error("E2E-OVERCOAT-42 variant not found");

  // Insert morning_routine_selections row with minimal provenance.
  const { data: selection, error: selectionError } = await admin
    .from("morning_routine_selections")
    .insert({
      retailer_id: retailer.id,
      customer_id: customerRow.id,
      for_date: todayDate,
      summary: "Selected 1 catalogue recommendation.",
      personalization_consent: "denied",
      location_consent: "denied",
      personalization_status: "skipped_no_consent",
      location_status: "skipped_no_consent",
      location_kind: "none",
      weather_status: "skipped_absent",
      calendar_status: "skipped_absent",
      occasion_labels: [],
    })
    .select()
    .single();
  if (selectionError) throw selectionError;
  if (!selection) throw new Error("selection insert returned no data");

  // Insert morning_routine_recommendations row with product link and image.
  const { error: recommendationError } = await admin
    .from("morning_routine_recommendations")
    .insert({
      selection_id: selection.id,
      retailer_id: retailer.id,
      customer_id: customerRow.id,
      rank: 1,
      source: "catalogue",
      display_name: "E2E Storefront Overcoat",
      score: 40,
      product_id: product.id,
      product_variant_id: variant.id,
      product_slug: "e2e-storefront-overcoat",
      primary_image_url: FIXTURE_IMAGE_URL,
      explanation: ["Catalogue recommendation — secondary to owned pieces."],
      factors: [
        {
          code: "catalogue_secondary",
          detail: "Catalogue recommendation — secondary to owned pieces.",
        },
      ],
      actions: [
        {
          kind: "save",
          available: true,
          productVariantId: variant.id,
          productId: product.id,
        },
        {
          kind: "review",
          available: true,
          reason: "Ask your Style Advisor about this pick.",
          productId: product.id,
        },
        {
          kind: "book",
          available: true,
          href: `/r/${TEST_RETAILER_SLUG}/appointments`,
        },
        {
          kind: "buy",
          available: true,
          href: `/r/${TEST_RETAILER_SLUG}/products/e2e-storefront-overcoat?legacy=1`,
          productId: product.id,
          productVariantId: variant.id,
        },
      ],
    });
  if (recommendationError) throw recommendationError;

  try {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: TEST_CUSTOMER_EMAIL,
    });
    if (error || !data.properties) {
      throw new Error(
        `Failed to generate magic link: ${error?.message ?? "unknown error"}`,
      );
    }

    await page.setViewportSize({ width: 1512, height: 982 });
    await page.goto(
      `/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`,
    );
    await expect(page).toHaveURL(/\/dashboard$/);

    const strip = page
      .locator("section")
      .filter({ has: page.getByText("Local context", { exact: true }) });
    await expect(strip).toBeVisible();

    // Contract §4: the desktop local-context strip is no taller than 100px.
    const stripBox = await strip.boundingBox();
    expect(stripBox).not.toBeNull();
    expect(stripBox!.height).toBeLessThanOrEqual(101);

    // The rightmost cell shows the real daily image, object-contain, uncropped.
    // The strip's only <img> is that recommendation image (weather is a glyph,
    // city cameras are iframes).
    const stripImage = strip.locator("img").first();
    await expect(stripImage).toBeVisible();
    await expect(stripImage).toHaveCSS("object-fit", "contain");
    const imgBox = await stripImage.boundingBox();
    expect(imgBox).not.toBeNull();
    expect(imgBox!.width).toBeGreaterThan(0);
    expect(imgBox!.height).toBeGreaterThan(0);

    // OOTD begins immediately below the strip.
    const ootd = page.getByRole("region", { name: "Outfit of the day" });
    await expect(ootd).toBeVisible();
    const ootdBox = await ootd.boundingBox();
    expect(ootdBox).not.toBeNull();
    expect(stripBox!.y + stripBox!.height).toBeLessThanOrEqual(ootdBox!.y + 8);

    // Nothing the contract forbids came back with the image.
    await expect(page.getByText("Complete the look")).toHaveCount(0);
    await expect(page.getByText(/today.?s edit/i)).toHaveCount(0);
    await expect(
      page.getByText("1-Tap Checkout is not turned on."),
    ).toHaveCount(0);
    await expect(strip.getByText(/today.?s look/i)).toHaveCount(0);

    // The OOTD still exposes the real store Buy action.
    const buyControl = page.getByRole("link", { name: "Buy" }).first();
    await expect(buyControl).toBeVisible();
    await expect(buyControl).toHaveAttribute(
      "href",
      new RegExp(`/r/${TEST_RETAILER_SLUG}`),
    );

    expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);

    await page.screenshot({
      path: evidencePath("desktop-1512x982.png"),
      fullPage: true,
    });

    // Mobile: every local-context function stays reachable — no five tiny
    // columns forcing the work-address control off the strip.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(strip).toBeVisible();
    const workAddress = page.getByLabel("Work address");
    await expect(workAddress).toBeVisible();
    const waBox = await workAddress.boundingBox();
    expect(waBox).not.toBeNull();
    expect(waBox!.width).toBeGreaterThan(0);
    expect(waBox!.height).toBeGreaterThan(0);

    await page.screenshot({
      path: evidencePath("mobile-390x844.png"),
      fullPage: true,
    });

    expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
  } finally {
    // Clean up fixture after test so other specs start fresh.
    await admin
      .from("morning_routine_selections")
      .delete()
      .eq("customer_id", customerRow.id)
      .eq("for_date", todayDate);
  }
});
