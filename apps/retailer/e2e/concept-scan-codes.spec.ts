import { createSupabaseAdminClient } from "@paon/database";
import { expect, test } from "@playwright/test";

import {
  TEST_ORDER_PRODUCT_SLUG,
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
  TEST_RETAILER_SLUG,
} from "./fixtures";

/**
 * FT-03 QR try-on and fabric-batch concept order
 * (docs/FOUNDER_TOOL_BLUEPRINTS.md) — the retailer side: a manager issues
 * a scan code, recalls one and rotates another (the blueprint's
 * "opaque, rotatable, expiring" requirement — recall stops the old code
 * resolving immediately, rotate mints a fresh one for the same piece),
 * then sees a customer's real submitted concept order for review.
 * Converting a review into a proposal/order is out of this slice's
 * scope, matching FT-10's gift-booklet precedent.
 */
test("a manager issues, recalls and rotates concept scan codes, and reviews a customer's submitted concept order", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Concept scan codes e2e requires local Supabase variables.",
    );
  }
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  const { data: retailer } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("E2E retailer is missing");
  const { data: product } = await admin
    .from("products")
    .select("id, name")
    .eq("retailer_id", retailer.id)
    .eq("slug", TEST_ORDER_PRODUCT_SLUG)
    .single();
  if (!product) throw new Error("E2E order fixture product is missing");
  const { data: variant } = await admin
    .from("product_variants")
    .select("id")
    .eq("product_id", product.id)
    .limit(1)
    .single();
  if (!variant) throw new Error("E2E order fixture variant is missing");

  const codeIds: string[] = [];
  let selectionId: string | undefined;
  let customerId: string | undefined;

  try {
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
    await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
    await page.getByRole("button", { name: "Enter the atelier" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/concepts");

    // Issue a code for rotation.
    await page
      .locator('select[name="productVariantId"]')
      .selectOption(variant.id);
    await page.locator('select[name="kind"]').selectOption("try_on");
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          new URL(response.url()).pathname === "/concepts",
      ),
      page.getByRole("button", { name: "Issue code" }).click(),
    ]);

    const { data: rotateTarget } = await admin
      .from("concept_scan_codes")
      .select("id, code")
      .eq("retailer_id", retailer.id)
      .eq("product_variant_id", variant.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (!rotateTarget) throw new Error("issued code not found");
    codeIds.push(rotateTarget.id);

    await expect(
      page.locator("li", { hasText: rotateTarget.code }),
    ).toBeVisible();

    // Rotate: the old code recalls, a fresh one takes its place.
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          new URL(response.url()).pathname === "/concepts",
      ),
      page
        .locator("li", { hasText: rotateTarget.code })
        .getByRole("button", { name: "Rotate" })
        .click(),
    ]);

    const { data: rotatedOriginal } = await admin
      .from("concept_scan_codes")
      .select("status, superseded_by_code_id")
      .eq("id", rotateTarget.id)
      .single();
    expect(rotatedOriginal?.status).toBe("recalled");
    expect(rotatedOriginal?.superseded_by_code_id).toBeTruthy();
    const { data: replacement } = await admin
      .from("concept_scan_codes")
      .select("id, code, status")
      .eq("id", rotatedOriginal!.superseded_by_code_id!)
      .single();
    if (!replacement)
      throw new Error("rotation did not produce a replacement code");
    codeIds.push(replacement.id);
    expect(replacement.status).toBe("active");

    await page.reload();
    await expect(
      page.locator("li", { hasText: rotateTarget.code }),
    ).toContainText("Recalled");
    await expect(
      page.locator("li", { hasText: replacement.code }),
    ).toContainText("Active");

    // Recall the replacement directly.
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          new URL(response.url()).pathname === "/concepts",
      ),
      page
        .locator("li", { hasText: replacement.code })
        .getByRole("button", { name: "Recall", exact: true })
        .click(),
    ]);
    await page.reload();
    await expect(
      page.locator("li", { hasText: replacement.code }),
    ).toContainText("Recalled");

    // A customer's real submitted concept order shows up for review.
    const { data: customer } = await admin
      .from("customers")
      .insert({
        retailer_id: retailer.id,
        full_name: `E2E Concept Customer ${Date.now()}`,
        lifecycle_stage: "prospect",
      })
      .select("id, full_name")
      .single();
    if (!customer) throw new Error("failed to seed review customer");
    customerId = customer.id;

    const { data: reviewCode } = await admin
      .from("concept_scan_codes")
      .insert({
        retailer_id: retailer.id,
        product_variant_id: variant.id,
        kind: "fabric_swatch",
        status: "active",
      })
      .select("id")
      .single();
    if (!reviewCode) throw new Error("failed to seed review scan code");
    codeIds.push(reviewCode.id);

    const { data: selection } = await admin
      .from("concept_order_selections")
      .insert({
        customer_id: customer.id,
        retailer_id: retailer.id,
        status: "submitted",
        submitted_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (!selection) throw new Error("failed to seed submitted selection");
    selectionId = selection.id;

    const { error: itemError } = await admin
      .from("concept_order_selection_items")
      .insert({ selection_id: selection.id, scan_code_id: reviewCode.id });
    if (itemError) throw itemError;

    await page.reload();
    const reviewCard = page
      .locator("li")
      .filter({ hasText: customer.full_name });
    await expect(reviewCard).toBeVisible();
    await expect(
      reviewCard.getByText(new RegExp(`Fabric swatch.*${product.name}`)),
    ).toBeVisible();
  } finally {
    if (selectionId) {
      await admin
        .from("concept_order_selection_items")
        .delete()
        .eq("selection_id", selectionId);
      await admin
        .from("concept_order_selections")
        .delete()
        .eq("id", selectionId);
    }
    if (customerId) {
      await admin.from("customers").delete().eq("id", customerId);
    }
    if (codeIds.length > 0) {
      await admin.from("concept_scan_codes").delete().in("id", codeIds);
    }
  }
});
