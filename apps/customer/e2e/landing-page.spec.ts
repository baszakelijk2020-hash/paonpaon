import { createSupabaseAdminClient } from "@paon/database";
import { expect, test, type Page } from "@playwright/test";

import {
  TEST_CUSTOMER_EMAIL,
  TEST_PRODUCT_SLUG,
  TEST_RETAILER_DISPLAY_NAME,
  TEST_RETAILER_SLUG,
} from "./fixtures";

/**
 * `/r/[slug]` now serves the founder's `paon.html` byte-for-byte (ADR-046),
 * not a React port — there is no top nav / bottom dock / slide-out menu to
 * assert on. These tests exercise the real behavior layered onto that file:
 * the product grid is populated from the actual catalog, opening a product
 * reveals the detail view, and "Add to Bag" drives the real cart-add
 * endpoint (sign-in redirect when signed out, a real cart line when signed
 * in) rather than the original's decorative modal.
 */

const MOBILE_VIEWPORT = { width: 390, height: 844 }; // iPhone 12-class
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };

async function clearDraftCart(): Promise<void> {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
  const { data: retailerRow } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailerRow) return;
  const { data: customerRow } = await admin
    .from("customers")
    .select("id")
    .eq("retailer_id", retailerRow.id)
    .eq("email", TEST_CUSTOMER_EMAIL)
    .maybeSingle();
  if (!customerRow) return;
  await admin
    .from("orders")
    .delete()
    .eq("customer_id", customerRow.id)
    .eq("status", "draft");
}

/**
 * The template's `categories` filter list is the founder's own fixed
 * taxonomy (Suits/Jackets/Pants/Knits/Shoes/Shirts/Outerwear/Evening/
 * Wedding), not derived from the retailer's collections — `route.ts`
 * classifies each product into it by keyword match against its name.
 * "E2E Storefront Overcoat" lands in "Outerwear", never the default
 * (whichever bucket has the most products), so switch to it explicitly.
 */
async function selectTestProductCategory(page: Page): Promise<void> {
  await page.locator("#cat-grid .cat-item", { hasText: "Outerwear" }).click();
}

async function signIn(page: Page): Promise<void> {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
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

test.describe("desktop", () => {
  test.use({ viewport: DESKTOP_VIEWPORT });

  test("renders the real catalog inside the founder's template and opens a product's detail view", async ({
    page,
  }) => {
    await page.goto(`/r/${TEST_RETAILER_SLUG}`);

    await expect(
      page
        .locator("#lagilda-shimmer-unique")
        .getByText(TEST_RETAILER_DISPLAY_NAME),
    ).toBeVisible();

    await selectTestProductCategory(page);
    const card = page.locator(
      `.grid-card[data-product-id="${TEST_PRODUCT_SLUG}"]`,
    );
    await expect(card).toBeVisible();

    await card.click();
    await expect(page.locator("#view-detail.visible")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add to Bag" }).first(),
    ).toBeVisible();
  });

  test("Add to Bag preserves a signed-out visitor's intent for sign in", async ({
    page,
  }) => {
    await page.goto(`/r/${TEST_RETAILER_SLUG}`);
    await selectTestProductCategory(page);
    await page
      .locator(`.grid-card[data-product-id="${TEST_PRODUCT_SLUG}"]`)
      .click();

    await page.getByRole("button", { name: "Add to Bag" }).first().click();
    const savedIntent = page.getByRole("status").filter({
      hasText: "Saved for you",
    });
    await expect(savedIntent).toBeVisible();
    await expect(
      savedIntent.getByRole("link", { name: "sign in" }),
    ).toHaveAttribute(
      "href",
      new RegExp(`/login\\?redirectTo=.*r%2F${TEST_RETAILER_SLUG}%2Fcart`),
    );
  });

  test("Add to Bag adds a real cart line for a signed-in shopper", async ({
    page,
  }) => {
    await clearDraftCart();
    await signIn(page);

    await page.goto(`/r/${TEST_RETAILER_SLUG}`);
    await selectTestProductCategory(page);
    await page
      .locator(`.grid-card[data-product-id="${TEST_PRODUCT_SLUG}"]`)
      .click();
    await page.getByRole("button", { name: "Add to Bag" }).first().click();

    await expect(page).toHaveURL(new RegExp(`/r/${TEST_RETAILER_SLUG}/cart$`));
    await expect(page.getByText("E2E Storefront Overcoat")).toBeVisible();
  });
});

test.describe("mobile", () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test("renders the catalog grid and opens a product's detail view", async ({
    page,
  }) => {
    // The desktop-only `.cat-grid` category rail lives in the sidebar
    // `<aside>`, which mobile hides in favor of a separate filter-panel
    // flow (`#filter-panel`'s `.fp-opt` picker) — not exercised here, so
    // this checks a product from the grid's default active category
    // rather than switching to the capsule-collection product.
    await page.goto(`/r/${TEST_RETAILER_SLUG}`);

    const card = page.locator(".grid-card").first();
    await expect(card).toBeVisible();

    await card.click();
    await expect(page.locator("#view-detail.visible")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add to Bag" }).first(),
    ).toBeVisible();
  });
});
