import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { createSupabaseAdminClient } from "@paon/database";
import { expect, test, type Locator, type Page } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL, TEST_RETAILER_SLUG } from "./fixtures";

/**
 * PHASE 20.25 — CENV-CTA-001: customer CTA controls (Buy, Save, Book
 * Appointment, Add to cart, and equivalents) use ONE 15px squircle system
 * and never regress to the 8px `@paon/ui` Button default, the 12px
 * `.customer-button` default, or a generic outlined-card corner.
 *
 * Contract: CUSTOMER_ENVIRONMENT_REBUILD_V3 §3 ("CTA controls use one 15px
 * squircle system"), §2 (Book Appointment already on 15px squircle corners).
 *
 * This is a presentation proof: it seeds a deterministic MorningRoutine
 * selection so the Overview action row renders every CTA kind, signs in as
 * the real customer, and asserts the computed `border-radius` of each CTA
 * on desktop and mobile. Setup is done directly through the admin client;
 * the acceptance is the rendered CTA geometry through the production path.
 */

const DESKTOP = { width: 1512, height: 982 } as const;
const MOBILE = { width: 390, height: 844 } as const;

const FIXTURE_IMAGE_URL =
  "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22400%22%20height%3D%22600%22%3E%3Crect%20width%3D%22400%22%20height%3D%22600%22%20fill%3D%22%236b7360%22%2F%3E%3C%2Fsvg%3E";

const EVIDENCE_SUBPATH =
  "../../../docs/evidence/runs/20.25-customer-cta-squircle-v3";

async function radiusPx(locator: Locator): Promise<number> {
  const value = await locator.evaluate(
    (node) => getComputedStyle(node as Element).borderTopLeftRadius,
  );
  return Number.parseFloat(value);
}

async function expectSquircle(locator: Locator, label: string): Promise<void> {
  await expect(locator, `${label} must be visible`).toBeVisible();
  const radius = await radiusPx(locator);
  expect(
    radius,
    `${label} must render the one 15px squircle radius, got ${radius}px`,
  ).toBe(15);
}

async function seedMorningRoutine(): Promise<void> {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "customer-cta-squircle-v3 requires local Supabase — run `supabase start` and export its printed values first.",
    );
  }
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  const { data: retailer } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");

  const { data: customerRow } = await admin
    .from("customers")
    .select("id")
    .eq("email", TEST_CUSTOMER_EMAIL)
    .eq("retailer_id", retailer.id)
    .maybeSingle();
  if (!customerRow) throw new Error("fixture customer missing");

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

  const todayDate = new Date().toISOString().slice(0, 10);

  await admin
    .from("morning_routine_selections")
    .delete()
    .eq("customer_id", customerRow.id)
    .eq("for_date", todayDate);

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
}

async function signIn(page: Page): Promise<void> {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("customer-cta-squircle-v3 requires local Supabase.");
  }
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
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
}

test.describe("Customer CTA squircle system (20.25)", () => {
  test.beforeAll(async () => {
    await seedMorningRoutine();
  });

  for (const viewport of [DESKTOP, MOBILE] as const) {
    const kind = viewport.width === DESKTOP.width ? "desktop" : "mobile";

    test(`every customer CTA renders the 15px squircle — ${kind}`, async ({
      page,
    }, testInfo) => {
      const evidenceDir = resolve(testInfo.config.rootDir, EVIDENCE_SUBPATH);
      await mkdir(evidenceDir, { recursive: true });

      // Real page/script errors fail the test; two classes of pre-existing
      // noise are out of scope for the CTA-styling contract and are filtered:
      //  - generic resource-load failures (missing favicon, flaky asset 404/503);
      //  - React hydration error #418 on the legacy `?legacy=1` storefront
      //    product route (desktop-only, reproduces without this change).
      const IGNORED_CONSOLE =
        /Failed to load resource|Minified React error #418/i;
      const consoleErrors: string[] = [];
      page.on("console", (message) => {
        if (message.type() !== "error") return;
        const text = message.text();
        if (IGNORED_CONSOLE.test(text)) return;
        consoleErrors.push(text);
      });
      page.on("pageerror", (error) => {
        if (IGNORED_CONSOLE.test(String(error))) return;
        consoleErrors.push(String(error));
      });

      await page.setViewportSize(viewport);
      await signIn(page);

      // Every legacy `.customer-button` CTA seen anywhere in this journey must
      // be the one 15px squircle — collected across the pages we visit.
      let customerButtonsSeen = 0;
      const auditCustomerButtons = async (where: string): Promise<void> => {
        const buttons = page.locator(".customer-button");
        for (let i = 0; i < (await buttons.count()); i += 1) {
          const radius = await radiusPx(buttons.nth(i));
          expect(
            radius,
            `.customer-button #${i} on ${where} must be the 15px squircle, got ${radius}px`,
          ).toBe(15);
          customerButtonsSeen += 1;
        }
      };

      // --- MorningRoutine action row: Save / Mark reviewed / Ask advisor /
      // Book / Buy — the canonical customer CTA cluster.
      await page.goto("/morning-routine");
      const panel = page.locator(
        'section[aria-labelledby^="morning-routine-"]',
      );
      await expect(panel).toBeVisible();

      for (const name of [
        "Save",
        "Mark reviewed",
        "Ask advisor",
        "Book",
        "Buy",
      ]) {
        const cta = panel
          .getByRole("button", { name, exact: true })
          .or(panel.getByRole("link", { name, exact: true }))
          .first();
        await expectSquircle(cta, `MorningRoutine "${name}"`);
      }
      await auditCustomerButtons("/morning-routine");

      await page.screenshot({
        path: resolve(
          evidenceDir,
          `${kind}-morning-routine-${viewport.width}x${viewport.height}.png`,
        ),
        fullPage: true,
      });

      // --- Product detail: "Add to cart" (Buy) + "Save to wishlist" (Save).
      await page.goto(
        `/r/${TEST_RETAILER_SLUG}/products/e2e-storefront-overcoat?legacy=1`,
      );
      await expectSquircle(
        page.getByRole("button", { name: /add to cart/i }).first(),
        'Product-detail "Add to cart"',
      );
      await expectSquircle(
        page.getByRole("button", { name: /save to wishlist/i }).first(),
        'Product-detail "Save to wishlist"',
      );
      // The DFR "Start creating" CTA is the positive control — already 15px.
      await expectSquircle(
        page.getByRole("link", { name: /start creating/i }).first(),
        'Product-detail "Start creating"',
      );

      await page.screenshot({
        path: resolve(
          evidenceDir,
          `${kind}-product-${viewport.width}x${viewport.height}.png`,
        ),
        fullPage: true,
      });

      // --- Appointments: the `.customer-button` Book-Appointment launcher.
      await page.goto("/appointments");
      await expect(
        page.getByRole("heading", { name: /appointment/i }).first(),
      ).toBeVisible();
      await auditCustomerButtons("/appointments");

      await page.goto("/dashboard");
      await expect(page.locator("[data-customer-shell]")).toBeVisible();
      await auditCustomerButtons("/dashboard");

      expect(
        customerButtonsSeen,
        "expected at least one .customer-button CTA in the journey",
      ).toBeGreaterThan(0);

      expect(
        consoleErrors,
        `console errors:\n${consoleErrors.join("\n")}`,
      ).toEqual([]);
    });
  }
});
