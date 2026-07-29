import { createSupabaseAdminClient } from "@paon/database";
import { expect, test, type Page } from "@playwright/test";

import { TEST_PRODUCT_SLUG, TEST_RETAILER_SLUG } from "./fixtures";

const MOBILE_VIEWPORT = { width: 390, height: 844 };
const FIBRE_FIXTURE_CONCEPT_ID = "a1000000-0000-4000-8000-100000000002";
const EXPECTED_FIBRE_CARD_TITLE = "Why fibre composition matters";

async function requireAdmin() {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
}

async function ensureAcceptedFibreAssignment(): Promise<void> {
  const admin = await requireAdmin();
  const { data: retailerRow } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailerRow) throw new Error("fixture retailer missing");

  const { data: productRow } = await admin
    .from("products")
    .select("id")
    .eq("retailer_id", retailerRow.id)
    .eq("slug", TEST_PRODUCT_SLUG)
    .single();
  if (!productRow) throw new Error("fixture product missing");

  let { data: staffRow } = await admin
    .from("retailer_staff_members")
    .select("id")
    .eq("retailer_id", retailerRow.id)
    .limit(1)
    .maybeSingle();
  if (!staffRow) {
    const { data: authUser, error: authError } =
      await admin.auth.admin.createUser({
        email: "e2e-knowledge-staff@paon.test",
        email_confirm: true,
      });
    if (authError || !authUser.user) {
      throw authError ?? new Error("failed to create knowledge staff user");
    }
    const { data: insertedStaff, error: staffError } = await admin
      .from("retailer_staff_members")
      .insert({
        retailer_id: retailerRow.id,
        user_id: authUser.user.id,
        full_name: "E2E Knowledge Staff",
        email: "e2e-knowledge-staff@paon.test",
        role: "owner",
        accepted_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (staffError || !insertedStaff) {
      throw staffError ?? new Error("failed to create knowledge staff member");
    }
    staffRow = insertedStaff;
  }

  const reviewedAt = new Date().toISOString();
  const { error: assignmentError } = await admin
    .from("entity_metadata_assignments")
    .upsert(
      {
        retailer_id: retailerRow.id,
        target_type: "product",
        target_id: productRow.id,
        concept_id: FIBRE_FIXTURE_CONCEPT_ID,
        source: "retailer",
        review_status: "accepted",
        reviewed_by_staff_id: staffRow.id,
        reviewed_at: reviewedAt,
      },
      { onConflict: "retailer_id,target_type,target_id,concept_id" },
    );
  if (assignmentError) throw assignmentError;
}

async function clearAcceptedAssignments(): Promise<void> {
  const admin = await requireAdmin();
  const { data: retailerRow } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailerRow) return;
  const { data: productRow } = await admin
    .from("products")
    .select("id")
    .eq("retailer_id", retailerRow.id)
    .eq("slug", TEST_PRODUCT_SLUG)
    .maybeSingle();
  if (!productRow) return;
  await admin
    .from("entity_metadata_assignments")
    .delete()
    .eq("retailer_id", retailerRow.id)
    .eq("target_type", "product")
    .eq("target_id", productRow.id);
}

async function openTestProductDetail(page: Page): Promise<void> {
  await page.goto(`/r/${TEST_RETAILER_SLUG}`);
  await page.locator("#cat-grid .cat-item", { hasText: "Outerwear" }).click();
  await page
    .locator(`.grid-card[data-product-id="${TEST_PRODUCT_SLUG}"]`)
    .click();
  await expect(page.locator("#view-detail.visible")).toBeVisible();
}

test.describe("storefront knowledge mounts", () => {
  test.beforeEach(async () => {
    await ensureAcceptedFibreAssignment();
  });

  test.afterEach(async () => {
    await clearAcceptedAssignments();
  });

  test("desktop detail view renders metadata-backed fabric education cards", async ({
    page,
  }) => {
    await openTestProductDetail(page);
    await page.locator(".dr-section", { hasText: "Fabric" }).click();

    const fabricCards = page.locator(
      "#paon-knowledge-fabric .paon-knowledge-card",
    );
    await expect(fabricCards.first()).toBeVisible();
    await expect(page.getByText(EXPECTED_FIBRE_CARD_TITLE)).toBeVisible();
    await expect(page.locator("#paon-knowledge-fabric")).toHaveAttribute(
      "role",
      "list",
    );
    await expect(
      page.locator("#paon-knowledge-fabric .paon-knowledge-card-img").first(),
    ).toHaveAttribute("alt", EXPECTED_FIBRE_CARD_TITLE);
  });

  test("mobile detail view keeps accessible knowledge cards in Fabric", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await openTestProductDetail(page);
    await page.locator(".dr-section", { hasText: "Fabric" }).click();

    const card = page
      .locator("#paon-knowledge-fabric .paon-knowledge-card")
      .first();
    await expect(card).toBeVisible();
    await card.focus();
    await expect(card).toBeFocused();
    await expect(page.getByText(EXPECTED_FIBRE_CARD_TITLE)).toBeVisible();
  });

  test("products without accepted metadata keep founder fallback panels", async ({
    page,
  }) => {
    await clearAcceptedAssignments();
    await openTestProductDetail(page);

    await expect(page.locator("#paon-knowledge-archetype")).toBeEmpty();
    await expect(page.locator("#paon-knowledge-fabric")).toBeEmpty();
    await expect(page.locator("#paon-knowledge-sizing")).toBeEmpty();
    await expect(page.locator("#dr-fabric-body")).toContainText(
      "Select your preferred fabric",
    );
  });
});
