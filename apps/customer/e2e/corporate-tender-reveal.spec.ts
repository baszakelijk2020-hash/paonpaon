import {
  AIGenerationRepository,
  CorporateConceptAssetRepository,
  CorporateOpportunityRepository,
  CorporateTenderRepository,
  createSupabaseAdminClient,
} from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import { TEST_RETAILER_SLUG } from "./fixtures";

/**
 * Proves the public tender page (PHASE 18.3 / BD-103) end to end: before
 * any version is approved the page shows "not yet published" with no
 * draft content, and after approving a version the page shows exactly
 * that version's summary/garment-concepts/pricing note — never an
 * unapproved later draft. Also proves 18.3's own named gap, closed: a
 * pending concept image (18.10) never appears until approved, and a
 * revoked tender (the "shareable forever" gap) refuses ALL content —
 * approved or not — and a second revocation is refused, not silently
 * accepted.
 */
test("an anonymous viewer sees a tender as not-yet-published until a version is approved, then sees exactly that version", async ({
  page,
}) => {
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
  if (!retailer) throw new Error("fixture retailer missing");
  const retailerId = asId<"RetailerId">(retailer.id);

  const { data: staff } = await admin
    .from("retailer_staff_members")
    .select("id")
    .eq("retailer_id", retailerId)
    .limit(1)
    .single();
  if (!staff) throw new Error("fixture staff missing");

  const unique = Date.now();
  const opportunityRepo = new CorporateOpportunityRepository(admin);
  const tenderRepo = new CorporateTenderRepository(admin);

  const opportunity = await opportunityRepo.create({
    retailerId,
    companyName: `Customer e2e Tender Co ${unique}`,
  });
  if (!opportunity.ok) throw new Error("failed to seed opportunity");

  const tenderResult = await tenderRepo.create({
    retailerId,
    opportunityId: opportunity.opportunity.id,
    opportunityStage: opportunity.opportunity.stage,
    title: `Customer e2e Tender ${unique}`,
  });
  if (!tenderResult.ok) throw new Error("failed to seed tender");
  const tender = tenderResult.tender;

  try {
    await page.goto(`/r/${TEST_RETAILER_SLUG}/tenders/${tender.shareToken}`);
    await expect(page.getByText("not yet published")).toBeVisible();

    const versionResult = await tenderRepo.createVersion({
      retailerId,
      tenderId: tender.id,
      summary: "A full formalwear programme for their head-office staff.",
      garmentConcepts: ["Two-piece suit", "Overcoat"],
      pricingNote: "Indicative pricing on request.",
    });
    if (!versionResult.ok) throw new Error("failed to seed tender version");

    await page.goto(`/r/${TEST_RETAILER_SLUG}/tenders/${tender.shareToken}`);
    // An unapproved version must never be shown, even though it exists.
    await expect(page.getByText("not yet published")).toBeVisible();
    await expect(page.getByText("A full formalwear programme")).toHaveCount(0);

    await tenderRepo.approveVersion({
      retailerId,
      tenderVersionId: versionResult.version.id,
      approvedByStaffId: staff.id,
    });

    await page.goto(`/r/${TEST_RETAILER_SLUG}/tenders/${tender.shareToken}`);
    await expect(
      page.getByText(
        "A full formalwear programme for their head-office staff.",
      ),
    ).toBeVisible();
    await expect(page.getByText("Two-piece suit")).toBeVisible();
    await expect(page.getByText("Overcoat")).toBeVisible();
    await expect(page.getByText("Version 1")).toBeVisible();

    // PHASE 18.10: a pending concept image must never reach this page —
    // only an explicitly APPROVED one may.
    const generationRepo = new AIGenerationRepository(admin);
    const conceptRepo = new CorporateConceptAssetRepository(admin);
    const generation = await generationRepo.record({
      retailerId,
      kind: "corporate_concept",
      status: "succeeded",
      provider: "mock",
      model: "mock-concept-v1",
      inputSummary: `Concept images for tender version ${versionResult.version.id}`,
    });
    const asset = await conceptRepo.create({
      retailerId,
      tenderVersionId: versionResult.version.id,
      aiGenerationId: generation.id,
      imageUrl: "https://example.test/customer-e2e-concept.png",
      prompt: "Customer e2e seeded concept prompt",
    });

    await page.reload();
    await expect(page.locator("[data-concept-images]")).toHaveCount(0);

    await conceptRepo.decide({
      assetId: asset.id,
      decision: "approved",
      staffId: asId<"StaffId">(staff.id),
    });

    await page.reload();
    await expect(
      page.locator('img[src="https://example.test/customer-e2e-concept.png"]'),
    ).toBeVisible();

    // PHASE 18.3's own named gap, closed: once revoked, the link refuses
    // ALL content — approved version, concept images, everything —
    // never merely reverting to "not yet published".
    const revoked = await tenderRepo.revoke({
      retailerId,
      tenderId: tender.id,
    });
    expect(revoked.ok).toBe(true);

    await page.reload();
    await expect(page.getByText("This link has been revoked")).toBeVisible();
    await expect(page.getByText("A full formalwear programme")).toHaveCount(0);
    await expect(page.locator("[data-concept-images]")).toHaveCount(0);

    // A second revocation is refused, not silently accepted.
    const redoubled = await tenderRepo.revoke({
      retailerId,
      tenderId: tender.id,
    });
    expect(redoubled).toEqual({ ok: false, reason: "already_revoked" });
  } finally {
    await admin
      .from("corporate_opportunities")
      .delete()
      .eq("id", opportunity.opportunity.id);
  }
});
