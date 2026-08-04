import {
  CorporateOpportunityRepository,
  createSupabaseAdminClient,
} from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import {
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
  TEST_RETAILER_SLUG,
} from "./fixtures";
import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "18.2";
const BROWSER_PROOF_SPEC = "apps/retailer/e2e/corporate-tender.spec.ts";

let proofPassed = false;

test.afterAll(async () => {
  await writeBrowserProofRun({
    phaseItemId: PHASE_ITEM_ID,
    spec: BROWSER_PROOF_SPEC,
    status: proofPassed ? "passed" : "failed",
  });
});

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

/**
 * Proves the tender and pitch builder (PHASE 18.2 / BD-102) end to end: a
 * tender is authored against a live opportunity, a version is added and is
 * shown unapproved, approving it is real (asserted in the database against
 * the unique-constraint-backed approvals table), and a second approve
 * attempt on the same version is refused rather than silently duplicated.
 */
test("a tender version is authored, approved once, and a second approval is refused", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  const { data: retailer } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");
  const retailerId = asId<"RetailerId">(retailer.id);

  const unique = Date.now();
  const opportunity = await new CorporateOpportunityRepository(admin).create({
    retailerId,
    companyName: `E2E Tender Co ${unique}`,
  });
  if (!opportunity.ok) throw new Error("failed to seed opportunity");
  const opportunityId = opportunity.opportunity.id;

  const tenderTitle = `E2E Tender ${unique}`;

  try {
    await page.goto(`/business-development/${opportunityId}`);
    await page.getByLabel("Tender title").fill(tenderTitle);
    await page.getByRole("button", { name: "Start a tender" }).click();
    await expect(
      page.getByRole("heading", { name: tenderTitle, level: 3 }),
    ).toBeVisible();

    await page
      .getByLabel("Summary")
      .fill("A full formalwear programme for their head-office staff.");
    await page
      .getByLabel("Garment concepts (one per line)")
      .fill("Two-piece suit\nOvercoat");
    await page.getByRole("button", { name: "Add version" }).click();

    await expect(page.getByText("Version 1")).toBeVisible();
    await expect(page.getByText("Not approved")).toBeVisible();

    const { data: version } = await admin
      .from("corporate_tender_versions")
      .select("id, tender_id")
      .eq(
        "tender_id",
        (
          await admin
            .from("corporate_tenders")
            .select("id")
            .eq("opportunity_id", opportunityId)
            .eq("title", tenderTitle)
            .single()
        ).data?.id ?? "",
      )
      .single();
    if (!version) throw new Error("tender version not found after creation");

    await page.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("Approved", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);

    const { data: approvals } = await admin
      .from("corporate_tender_approvals")
      .select("id")
      .eq("tender_version_id", version.id);
    expect(approvals).toHaveLength(1);

    // A second approval attempt against the same version must be refused,
    // not silently accepted as a duplicate — the unique constraint on
    // tender_version_id is the actual enforcement, exercised directly here
    // since the UI no longer offers the button once approved.
    const { data: firstApproval } = await admin
      .from("corporate_tender_approvals")
      .select("approved_by_staff_id")
      .eq("tender_version_id", version.id)
      .single();
    if (!firstApproval) throw new Error("approval not found after approving");
    const { error: secondApprovalError } = await admin
      .from("corporate_tender_approvals")
      .insert({
        retailer_id: retailerId,
        tender_version_id: version.id,
        approved_by_staff_id: firstApproval.approved_by_staff_id,
      });
    expect(secondApprovalError?.code).toBe("23505");

    proofPassed = true;
  } finally {
    await admin
      .from("corporate_opportunities")
      .delete()
      .eq("id", opportunityId);
  }
});
