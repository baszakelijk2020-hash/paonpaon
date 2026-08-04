import {
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
 * unapproved later draft.
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
  } finally {
    await admin
      .from("corporate_opportunities")
      .delete()
      .eq("id", opportunity.opportunity.id);
  }
});
