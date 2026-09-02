import {
  createSupabaseAdminClient,
  ProductRepository,
  ProductVariantRepository,
  StylePortraitConsentRepository,
  StylePortraitRepository,
  WardrobeRepository,
} from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test, type Page } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL, TEST_RETAILER_SLUG } from "./fixtures";
import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "17.13";
const BROWSER_PROOF_SPEC =
  "apps/customer/e2e/item-specific-complete-the-look.spec.ts";

// A genuine minimal 1x1 PNG — same fixture bytes already proven against
// this codebase's own magic-byte validation (silhouette-analysis.spec.ts,
// virtual-studio.spec.ts).
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

async function signIn(
  page: Page,
  admin: ReturnType<typeof createSupabaseAdminClient>,
): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: TEST_CUSTOMER_EMAIL,
    });
    if (error || !data.properties) {
      throw error ?? new Error("magic link missing");
    }
    await page.goto(
      `/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`,
    );
    const hasAuthCookie = (await page.context().cookies()).some(
      (cookie) =>
        cookie.name.startsWith("sb-") &&
        cookie.name.includes("auth-token") &&
        !cookie.name.includes("code-verifier"),
    );
    const isCustomerShell = await page
      .locator("[data-customer-shell]")
      .isVisible();
    if (/\/dashboard$/.test(page.url()) && hasAuthCookie && isCustomerShell) {
      return;
    }
  }
  throw new Error(`local magic-link sign-in did not complete: ${page.url()}`);
}

let proofPassed = false;

test.afterAll(async () => {
  await writeBrowserProofRun({
    phaseItemId: PHASE_ITEM_ID,
    spec: BROWSER_PROOF_SPEC,
    status: proofPassed ? "passed" : "failed",
  });
});

/**
 * The QR wardrobe card's item-specific "Complete the look" end to end
 * (PHASE 17.13 / ADV-113, vision spec §17) — distinct from PHASE 17.10's
 * wardrobe-level card: scoped to what pairs with one owned item
 * specifically, via the approved canonical sartorial rules seeded in
 * migration `20260730170000` (never a generic assumption). An owned
 * jacket with no owned trousers surfaces a trousers suggestion in its own
 * card's `Actions +` deck under "Complete the look" (V3 §5.4 relocated it
 * there from the old card-face disclosure) — a real approved jacket/
 * trousers pairing rule — and tapping "See it on me" reaches the same real
 * enqueue pipeline `complete-the-look.spec.ts` already proves.
 */
test("an owned item's card suggests an approved complementary category, and tapping it enqueues a real job", async ({
  page,
}) => {
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
  const retailerId = asId<"RetailerId">(retailer.id);

  const { data: customerRow } = await admin
    .from("customers")
    .select("id")
    .eq("retailer_id", retailerId)
    .eq("email", TEST_CUSTOMER_EMAIL)
    .single();
  if (!customerRow) throw new Error("fixture customer missing");
  const customerId = asId<"CustomerId">(customerRow.id);

  const productSlug = "e2e-item-specific-ctl-trousers";
  const productRepo = new ProductRepository(admin);
  let product = await productRepo.findBySlug(retailerId, productSlug);
  if (!product) {
    product = await productRepo.create({
      retailerId,
      name: "E2E Item-Specific CTL Trousers",
      slug: productSlug,
      description: "Fixture trousers product for item-specific CTL e2e.",
      status: "active",
      isMadeToOrder: false,
      isAlterable: false,
    });
  }
  const variantRepo = new ProductVariantRepository(admin);
  const existingVariants = await variantRepo.findByProduct(product.id);
  if (!existingVariants.some((v) => v.inventoryQuantity > 0)) {
    await variantRepo.create({
      productId: product.id,
      sku: "E2E-ITEM-CTL-TROUSERS-1",
      price: { amountMinorUnits: 25000, currency: "USD" },
      inventoryQuantity: 5,
    });
  }

  const conceptSlug = "e2e-item-ctl-trousers";
  let { data: concept } = await admin
    .from("metadata_concepts")
    .select("id")
    .eq("retailer_id", retailerId)
    .eq("kind", "garment_type")
    .eq("slug", conceptSlug)
    .maybeSingle();
  if (!concept) {
    const { data: created, error: conceptError } = await admin
      .from("metadata_concepts")
      .insert({
        retailer_id: retailerId,
        kind: "garment_type",
        slug: conceptSlug,
        canonical_name: "Trousers",
        attributes: {},
        active: true,
      })
      .select("id")
      .single();
    if (conceptError) throw conceptError;
    concept = created;
  } else {
    await admin
      .from("metadata_concepts")
      .update({ active: true, deleted_at: null })
      .eq("id", concept.id);
  }
  const { data: reviewer } = await admin
    .from("retailer_staff_members")
    .select("id")
    .eq("retailer_id", retailerId)
    .limit(1)
    .single();
  if (!reviewer) throw new Error("fixture metadata reviewer missing");

  await admin
    .from("entity_metadata_assignments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("retailer_id", retailerId)
    .eq("concept_id", concept.id)
    .eq("target_id", product.id)
    .is("deleted_at", null);
  const { error: assignmentError } = await admin
    .from("entity_metadata_assignments")
    .insert({
      retailer_id: retailerId,
      target_type: "product",
      target_id: product.id,
      concept_id: concept.id,
      source: "paon",
      confidence: 1,
      review_status: "accepted",
      evidence: { summary: "E2E reviewed item-specific CTL fixture" },
      reviewed_by_staff_id: reviewer.id,
      reviewed_at: new Date().toISOString(),
    });
  if (assignmentError) throw assignmentError;

  const wardrobeRepo = new WardrobeRepository(admin);
  const jacketItem = await wardrobeRepo.createExternalItem({
    retailerId,
    customerId,
    categoryCode: "jacket",
    displayName: "E2E Item-Specific CTL Jacket",
    condition: "good",
    careState: "current",
    fitPerception: "unknown",
  });

  const consent = await new StylePortraitConsentRepository(admin).grant(
    retailerId,
    customerId,
  );
  expect(consent.status).toBe("granted");

  const stylePortraitRepo = new StylePortraitRepository(admin);
  const unique = Date.now();
  const facePath = `${retailerId}/${customerId}/references/e2e-item-ctl-face-${unique}.png`;
  const fullBodyPath = `${retailerId}/${customerId}/references/e2e-item-ctl-body-${unique}.png`;
  const { error: faceUploadError } = await admin.storage
    .from("wardrobe-studio")
    .upload(facePath, PNG, { contentType: "image/png" });
  if (faceUploadError) throw faceUploadError;
  const { error: bodyUploadError } = await admin.storage
    .from("wardrobe-studio")
    .upload(fullBodyPath, PNG, { contentType: "image/png" });
  if (bodyUploadError) throw bodyUploadError;
  const portrait = await stylePortraitRepo.create({
    retailerId,
    customerId,
    references: [
      { kind: "face", storageBucket: "wardrobe-studio", storagePath: facePath },
      {
        kind: "full_body",
        storageBucket: "wardrobe-studio",
        storagePath: fullBodyPath,
      },
    ],
  });
  await stylePortraitRepo.approve(portrait.id);

  const outfitIds: string[] = [];

  try {
    await signIn(page, admin);

    await page.goto("/wardrobe");
    const card = page
      .locator("article", { hasText: "E2E Item-Specific CTL Jacket" })
      .first();
    await expect(card).toBeVisible();

    // V3 §5.4 — item-specific "Complete the look" now lives in the owned
    // card's `Actions +` progressive deck, not a card-face disclosure. The
    // suggestion is still scoped to what pairs with *this* item
    // (item-specific-complete-the-look-data.ts).
    await card.getByRole("button", { name: "Actions +" }).click();
    await card.getByRole("button", { name: "Complete the look" }).click();
    const tile = card.locator("li", {
      hasText: "E2E Item-Specific CTL Trousers",
    });
    await expect(tile).toBeVisible();

    await tile.getByRole("button", { name: "See it on me" }).click();

    await expect
      .poll(async () => {
        const { data } = await admin
          .from("outfits")
          .select("id")
          .eq("customer_id", customerId)
          .eq("title", "See it on me: E2E Item-Specific CTL Trousers")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        return data?.id ?? null;
      })
      .not.toBeNull();

    const { data: outfitAfterCreate } = await admin
      .from("outfits")
      .select("id")
      .eq("customer_id", customerId)
      .eq("title", "See it on me: E2E Item-Specific CTL Trousers")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (!outfitAfterCreate) throw new Error("outfit was not created");
    outfitIds.push(outfitAfterCreate.id);

    await expect
      .poll(async () => {
        const { data } = await admin
          .from("wardrobe_visualization_jobs")
          .select("id")
          .eq("outfit_id", outfitAfterCreate.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        return data?.id ?? null;
      })
      .not.toBeNull();

    proofPassed = true;
  } finally {
    if (outfitIds.length > 0) {
      await admin
        .from("wardrobe_visualization_jobs")
        .delete()
        .in("outfit_id", outfitIds);
      await admin.from("outfit_slots").delete().in("outfit_id", outfitIds);
      await admin.from("outfits").delete().in("id", outfitIds);
    }
    await admin.from("wardrobe_items").delete().eq("id", jacketItem.id);
    await admin
      .from("wardrobe_visualization_jobs")
      .delete()
      .eq("style_portrait_id", portrait.id);
    await admin
      .from("style_portrait_references")
      .delete()
      .eq("style_portrait_id", portrait.id);
    const { data: refObjects } = await admin.storage
      .from("wardrobe-studio")
      .list(`${retailerId}/${customerId}/references`);
    if (refObjects && refObjects.length > 0) {
      await admin.storage
        .from("wardrobe-studio")
        .remove(
          refObjects
            .filter((object) => object.name.includes("e2e-item-ctl-"))
            .map(
              (object) =>
                `${retailerId}/${customerId}/references/${object.name}`,
            ),
        );
    }
    await admin.from("style_portraits").delete().eq("id", portrait.id);
    await admin
      .from("style_portrait_consents")
      .delete()
      .eq("customer_id", customerId);
    await admin
      .from("entity_metadata_assignments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("retailer_id", retailerId)
      .eq("concept_id", concept.id)
      .eq("target_id", product.id);
  }
});
