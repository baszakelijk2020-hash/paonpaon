import { createSupabaseAdminClient } from "@paon/database";
import {
  CANONICAL_KNOWLEDGE_FIXTURES,
  type CanonicalKnowledgeFixture,
} from "@paon/domain";
import { expect, test, type Page } from "@playwright/test";

import {
  TEST_PRODUCT_SLUG,
  TEST_RETAILER_DISPLAY_NAME,
  TEST_RETAILER_SLUG,
} from "./fixtures";

const DESKTOP_VIEWPORT = { width: 1280, height: 800 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };

const PANEL_FIXTURES: CanonicalKnowledgeFixture[] =
  CANONICAL_KNOWLEDGE_FIXTURES.filter((fixture) =>
    ["mill", "styling", "construction", "fibre", "occasion", "care"].includes(
      fixture.topic,
    ),
  ).filter((fixture) => fixture.active);

async function selectTestProductCategory(page: Page): Promise<void> {
  await page.locator("#cat-grid .cat-item", { hasText: "Outerwear" }).click();
}

async function openTestProductDetail(page: Page): Promise<void> {
  await page.goto(`/r/${TEST_RETAILER_SLUG}`);
  const isMobile = (page.viewportSize()?.width ?? 1280) < 768;
  if (isMobile) {
    // Mobile hides the desktop category rail; open the seeded product
    // through the same founder openDetail hook the grid cards use.
    await page.waitForFunction(
      () =>
        typeof (window as unknown as { openDetail?: unknown }).openDetail ===
        "function",
    );
    await page.evaluate((productId) => {
      (
        window as unknown as {
          openDetail: (id: string) => void;
        }
      ).openDetail(productId);
    }, TEST_PRODUCT_SLUG);
  } else {
    await expect(
      page.getByText(TEST_RETAILER_DISPLAY_NAME).first(),
    ).toBeVisible();
    await selectTestProductCategory(page);
    const card = page.locator(
      `.grid-card[data-product-id="${TEST_PRODUCT_SLUG}"]`,
    );
    await expect(card).toBeVisible();
    await card.click();
  }
  await expect(page.locator("#view-detail.visible")).toBeVisible();
}

async function openSection(
  page: Page,
  section: "archetype" | "fabric" | "sizing",
): Promise<void> {
  const labels = {
    archetype: "Archetype",
    fabric: "Fabric",
    sizing: "Sizing",
  } as const;
  const body = page.locator(`#body-${section}`);
  const isOpen = await body.evaluate((el) => !el.classList.contains("closed"));
  if (!isOpen) {
    await page
      .locator(".dr-section", { hasText: labels[section] })
      .first()
      .click();
  }
  await expect(body).not.toHaveClass(/closed/);
}

async function clearKnowledgeAssignments(): Promise<void> {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
  const { data: retailer } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) return;
  const { data: product } = await admin
    .from("products")
    .select("id")
    .eq("retailer_id", retailer.id)
    .eq("slug", TEST_PRODUCT_SLUG)
    .single();
  if (!product) return;
  await admin
    .from("entity_metadata_assignments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("retailer_id", retailer.id)
    .eq("target_type", "product")
    .eq("target_id", product.id)
    .is("deleted_at", null);
}

async function seedKnowledgeAssignments(): Promise<void> {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
  const { data: retailer, error: retailerError } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (retailerError || !retailer) {
    throw new Error(retailerError?.message ?? "missing e2e retailer");
  }
  const { data: product, error: productError } = await admin
    .from("products")
    .select("id")
    .eq("retailer_id", retailer.id)
    .eq("slug", TEST_PRODUCT_SLUG)
    .single();
  if (productError || !product) {
    throw new Error(productError?.message ?? "missing e2e product");
  }
  const { data: staff, error: staffError } = await admin
    .from("retailer_staff_members")
    .select("id")
    .eq("retailer_id", retailer.id)
    .limit(1)
    .maybeSingle();
  if (staffError || !staff) {
    throw new Error(
      staffError?.message ??
        "missing e2e staff member for accepted assignment review",
    );
  }

  await clearKnowledgeAssignments();

  const now = new Date().toISOString();
  const rows = PANEL_FIXTURES.map((fixture) => ({
    retailer_id: retailer.id,
    target_type: "product" as const,
    target_id: product.id,
    concept_id: fixture.conceptId,
    source: "paon" as const,
    confidence: null,
    review_status: "accepted" as const,
    supplier_value: null,
    evidence: { summary: `E2E knowledge mount seed for ${fixture.topic}` },
    reviewed_by_staff_id: staff.id,
    reviewed_at: now,
  }));

  const { error: insertError } = await admin
    .from("entity_metadata_assignments")
    .insert(rows);
  if (insertError) {
    throw new Error(insertError.message);
  }
}

test.describe("desktop knowledge mounts", () => {
  test.use({ viewport: DESKTOP_VIEWPORT });

  test("keeps founder Archetype/Fabric/Sizing fallback when no knowledge is linked", async ({
    page,
  }) => {
    await clearKnowledgeAssignments();
    await openTestProductDetail(page);

    await expect(page.locator("#paon-knowledge-archetype")).toBeHidden();
    await expect(page.locator("#paon-knowledge-fabric")).toBeHidden();
    await expect(page.locator("#paon-knowledge-sizing")).toBeHidden();

    await openSection(page, "archetype");
    await expect(page.locator("#archetype-cards-fallback")).toBeVisible();
    await expect(page.getByText("The Essentialist").first()).toBeVisible();

    await openSection(page, "sizing");
    await expect(page.locator("#dr-sizing-body")).toHaveText(
      "Book your complimentary fitting after checkout.",
    );
  });

  test("renders square knowledge cards in Archetype, Fabric, and Sizing", async ({
    page,
  }) => {
    await seedKnowledgeAssignments();
    await openTestProductDetail(page);

    await openSection(page, "archetype");
    await expect(page.locator("#paon-knowledge-archetype")).toBeVisible();
    await expect(
      page.locator("#paon-knowledge-archetype .paon-knowledge-card").first(),
    ).toBeVisible();
    await expect(page.locator("#archetype-cards-fallback")).toBeHidden();
    await expect(
      page
        .locator("#paon-knowledge-archetype .paon-knowledge-card-title")
        .first(),
    ).toBeVisible();
    await expect(
      page
        .locator("#paon-knowledge-archetype .paon-knowledge-card-summary")
        .first(),
    ).toBeVisible();

    await openSection(page, "fabric");
    await expect(page.locator("#paon-knowledge-fabric")).toBeVisible();
    await expect(
      page.locator("#paon-knowledge-fabric .paon-knowledge-card").first(),
    ).toBeVisible();
    await expect(page.locator("#dr-fabric-body")).toBeVisible();

    await openSection(page, "sizing");
    await expect(page.locator("#paon-knowledge-sizing")).toBeVisible();
    await expect(
      page.locator("#paon-knowledge-sizing .paon-knowledge-card").first(),
    ).toBeVisible();
    await expect(page.locator("#dr-sizing-body")).toBeVisible();

    const card = page
      .locator("#paon-knowledge-fabric .paon-knowledge-card")
      .first();
    await card.focus();
    await expect(card).toBeFocused();
  });
});

test.describe("mobile knowledge mounts", () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test("shows knowledge cards inside mobile detail accordion panels", async ({
    page,
  }) => {
    await seedKnowledgeAssignments();
    await openTestProductDetail(page);

    await openSection(page, "fabric");
    await expect(
      page.locator("#paon-knowledge-fabric .paon-knowledge-card-title").first(),
    ).toBeVisible();

    await openSection(page, "sizing");
    await expect(
      page
        .locator("#paon-knowledge-sizing .paon-knowledge-card-summary")
        .first(),
    ).toBeVisible();

    await openSection(page, "archetype");
    await expect(
      page.locator("#paon-knowledge-archetype .paon-knowledge-card").first(),
    ).toBeVisible();
  });
});
