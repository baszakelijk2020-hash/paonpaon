import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { createSupabaseAdminClient } from "@paon/database";
import { expect, test, type Page } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL, TEST_RETAILER_SLUG } from "./fixtures";

/**
 * Customer V3 live-visual-audit remediation — F3 + F4
 * (docs/evidence/reviews/customer-v3-live-visual-audit/README.md).
 *
 * F3: the Overview local-context strip weather cell must never render a bare
 *     "—". With geolocation unavailable (headless, no permission) it must show
 *     a readable state ("Weather unavailable" / "Checking weather…").
 * F4: at mobile width the strip must still carry the "Elsewhere" world clocks
 *     and the daily suit/jacket image — visible, not hidden, not clipped.
 *
 * Contract: CUSTOMER_ENVIRONMENT_REBUILD_V3 §3, §4.
 */

const FIXTURE_IMAGE_URL =
  "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22400%22%20height%3D%22600%22%3E%3Crect%20width%3D%22400%22%20height%3D%22600%22%20fill%3D%22%236b7360%22%2F%3E%3C%2Fsvg%3E";

const WORLD_CLOCK_CITIES = [
  "New York",
  "London",
  "Dubai",
  "Hong Kong",
  "Tokyo",
  "Sydney",
];

const EVIDENCE_SUBPATH =
  "../../../docs/evidence/runs/customer-v3-dashboard-wardrobe-remediation";

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

async function seedDailySelection(): Promise<{ cleanup: () => Promise<void> }> {
  const client = admin();
  const { data: retailer } = await client
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");

  const { data: customerRow } = await client
    .from("customers")
    .select("id")
    .eq("email", TEST_CUSTOMER_EMAIL)
    .eq("retailer_id", retailer.id)
    .maybeSingle();
  if (!customerRow) throw new Error("fixture customer missing");

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
    .eq("customer_id", customerRow.id)
    .eq("for_date", todayDate);

  const { data: selection, error: selectionError } = await client
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

  const { error: recommendationError } = await client
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
    cleanup: async () => {
      await client
        .from("morning_routine_selections")
        .delete()
        .eq("customer_id", customerRow.id)
        .eq("for_date", todayDate);
    },
  };
}

async function signIn(page: Page): Promise<void> {
  const { data, error } = await admin().auth.admin.generateLink({
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
}

test("local-context strip: readable weather state and mobile-visible world clocks + daily image", async ({
  page,
}, testInfo) => {
  const evidenceDir = resolve(testInfo.config.rootDir, EVIDENCE_SUBPATH);
  await mkdir(evidenceDir, { recursive: true });

  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${String(e)}`));

  const { cleanup } = await seedDailySelection();

  try {
    // --- Desktop ---
    await page.setViewportSize({ width: 1512, height: 982 });
    await signIn(page);

    const strip = page
      .locator("section")
      .filter({ has: page.getByText("Local context", { exact: true }) });
    await expect(strip).toBeVisible();
    // Let the client tick set `now` and the geolocation callback settle.
    await page.waitForTimeout(1500);

    // F3: no bare em dash anywhere in the strip; a readable weather state.
    await expect(strip.getByText("—", { exact: true })).toHaveCount(0);
    await expect(
      strip.getByText(/Weather unavailable|Checking weather/),
    ).toBeVisible();

    await page.screenshot({
      path: resolve(evidenceDir, "dashboard-desktop-1512x982.png"),
      fullPage: true,
    });

    // --- Mobile ---
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(strip).toBeVisible();
    await page.waitForTimeout(1500);

    // F3 still holds at mobile width.
    await expect(strip.getByText("—", { exact: true })).toHaveCount(0);
    await expect(
      strip.getByText(/Weather unavailable|Checking weather/),
    ).toBeVisible();

    // F4: the "Elsewhere" world clocks remain in the strip on mobile.
    await expect(strip.getByText("Elsewhere", { exact: true })).toBeVisible();
    for (const city of WORLD_CLOCK_CITIES) {
      await expect(strip.getByText(city, { exact: true })).toBeVisible();
    }

    // F4: the daily suit/jacket image is present, contained (uncropped), and
    // has real rendered size on mobile.
    const dailyImage = strip.locator("img").first();
    await expect(dailyImage).toBeVisible();
    await expect(dailyImage).toHaveCSS("object-fit", "contain");
    const box = await dailyImage.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);
    // Not clipped by its container: the image box fits inside the viewport.
    expect(box!.x).toBeGreaterThanOrEqual(-1);
    expect(box!.x + box!.width).toBeLessThanOrEqual(391);

    // Regression guard: the work-address control is still reachable on mobile.
    await expect(page.getByLabel("Work address")).toBeVisible();

    await page.screenshot({
      path: resolve(evidenceDir, "dashboard-mobile-390x844.png"),
      fullPage: true,
    });

    expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
  } finally {
    await cleanup();
  }
});
