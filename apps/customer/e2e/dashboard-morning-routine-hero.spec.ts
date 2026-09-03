import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { createSupabaseAdminClient } from "@paon/database";
import { expect, test } from "@playwright/test";

import {
  AUTH_DELIVERABLE_DOMAIN,
  TEST_CUSTOMER_EMAIL,
  TEST_RETAILER_SLUG,
} from "./fixtures";

/**
 * The Overview composes compact local context directly above the real daily
 * MorningRoutine OOTD. It must not duplicate the look inside the strip or
 * bring the old Overview-only Complete the Look module back.
 */

// A flat SVG data URI — the same fixture image the sibling dashboard
// remediation spec seeds, so `next/image` (unoptimized) renders it without a
// network fetch or a console error.
const FIXTURE_IMAGE_URL =
  "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22400%22%20height%3D%22600%22%3E%3Crect%20width%3D%22400%22%20height%3D%22600%22%20fill%3D%22%236b7360%22%2F%3E%3C%2Fsvg%3E";

function admin() {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("requires local Supabase.");
  }
  return createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
}

/**
 * Point the fixture customer's login at a deliverable domain and seed one
 * real catalogue OOTD for today so the dashboard renders the actual
 * MorningRoutineDashboardHero (not its generic fallback banner). Mirrors
 * apps/customer/e2e/dashboard-local-context-remediation-v3.spec.ts.
 */
async function seedTodaysDailyLook(): Promise<{
  deliverableEmail: string;
  cleanup: () => Promise<void>;
}> {
  const client = admin();

  const { data: retailer } = await client
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");

  // Supabase Auth rejects the reserved `.test` TLD for magic links; the
  // fixture customer row is keyed on TEST_CUSTOMER_EMAIL, so point its
  // login at a deliverable domain before generating the link.
  const deliverableEmail = `e2e-shopper@${AUTH_DELIVERABLE_DOMAIN}`;
  const { data: customerRows } = await client
    .from("customers")
    .select("id")
    .eq("retailer_id", retailer.id)
    .in("email", [deliverableEmail, TEST_CUSTOMER_EMAIL])
    .limit(1);
  if (!customerRows || customerRows.length === 0) {
    throw new Error("fixture customer missing");
  }
  const customerId = (customerRows[0] as { id: string }).id;
  await client
    .from("customers")
    .update({ email: deliverableEmail })
    .eq("id", customerId);

  const { data: product } = await client
    .from("products")
    .select("id")
    .eq("slug", "e2e-storefront-overcoat")
    .eq("retailer_id", retailer.id)
    .single();
  if (!product) throw new Error("e2e-storefront-overcoat product not found");

  const { data: variant } = await client
    .from("product_variants")
    .select("id")
    .eq("sku", "E2E-OVERCOAT-42")
    .eq("product_id", product.id)
    .single();
  if (!variant) throw new Error("E2E-OVERCOAT-42 variant not found");

  const todayDate = new Date().toISOString().slice(0, 10);

  await client
    .from("morning_routine_selections")
    .delete()
    .eq("customer_id", customerId)
    .eq("for_date", todayDate);

  const { data: selection, error: selectionError } = await client
    .from("morning_routine_selections")
    .insert({
      retailer_id: retailer.id,
      customer_id: customerId,
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

  const { error: recommendationError } = await client
    .from("morning_routine_recommendations")
    .insert({
      selection_id: selection.id,
      retailer_id: retailer.id,
      customer_id: customerId,
      rank: 1,
      source: "catalogue",
      display_name: "E2E Storefront Overcoat",
      score: 40,
      product_id: product.id,
      product_variant_id: variant.id,
      product_slug: "e2e-storefront-overcoat",
      primary_image_url: FIXTURE_IMAGE_URL,
      explanation: ["Catalogue recommendation — the real daily OOTD."],
      factors: [
        {
          code: "catalogue_secondary",
          detail: "Catalogue recommendation — the real daily OOTD.",
        },
      ],
      actions: [
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

  return {
    deliverableEmail,
    cleanup: async () => {
      await client
        .from("morning_routine_selections")
        .delete()
        .eq("customer_id", customerId)
        .eq("for_date", todayDate);
    },
  };
}

test("the dashboard composes local context directly above the real daily OOTD", async ({
  page,
}, testInfo) => {
  const evidencePath = (...parts: string[]) =>
    resolve(
      testInfo.config.rootDir,
      "../../../docs/evidence/runs/20.5-customer-overview",
      ...parts,
    );
  await mkdir(evidencePath(), { recursive: true });

  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  const { deliverableEmail, cleanup } = await seedTodaysDailyLook();

  try {
    const { data, error } = await admin().auth.admin.generateLink({
      type: "magiclink",
      email: deliverableEmail,
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

    const localContext = page.getByText("Local context");
    const ootd = page.getByRole("region", { name: "Outfit of the day" });
    await expect(localContext).toBeVisible();
    await expect(ootd).toBeVisible();
    await expect(page.getByText("Complete the look")).toHaveCount(0);

    // At least one priced piece with a working Buy link into the real store.
    const buyControl = page.getByRole("link", { name: "Buy" }).first();
    await expect(buyControl).toBeVisible();
    const href = await buyControl.getAttribute("href");
    expect(href).toMatch(new RegExp(`/r/${TEST_RETAILER_SLUG}`));

    // Reloading does not silently reshuffle "today's look" underneath the
    // customer — same featured piece both times.
    const featuredHeading = page.getByRole("heading", { level: 1 });
    const firstLook = await featuredHeading.textContent();
    await page.reload();
    await expect(featuredHeading).toHaveText(firstLook ?? "");

    await page.setViewportSize({ width: 1512, height: 982 });
    await page.screenshot({
      path: evidencePath("desktop-1512x982.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: evidencePath("mobile-390x844.png"),
      fullPage: true,
    });
    expect(consoleErrors).toEqual([]);
  } finally {
    await cleanup();
  }
});
