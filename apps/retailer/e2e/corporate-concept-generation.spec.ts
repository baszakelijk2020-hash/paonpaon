import {
  AIGenerationRepository,
  CorporateConceptAssetRepository,
  CorporateOpportunityRepository,
  CorporateTenderRepository,
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

const PHASE_ITEM_ID = "18.10";
const BROWSER_PROOF_SPEC =
  "apps/retailer/e2e/corporate-concept-generation.spec.ts";

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
 * Proves PHASE 18.10's "not a black box" persistence half end to end:
 * requesting concept images with no AI image provider configured in
 * this environment (a genuine local condition, not simulated) records a
 * real, honest `failed` ai_generations row and creates no asset rather
 * than fabricating one; a pending concept asset (seeded directly,
 * mirroring 17.1's own advisor-capture e2e precedent of seeding
 * proposals rather than driving a live model call in a browser test)
 * can be approved exactly once through the real UI, and a second
 * decision attempt at the repository layer — the same write path the
 * UI itself uses — is refused. Whether an approved image actually
 * reaches 18.3's public page is proven separately by extending
 * `apps/customer/e2e/corporate-tender-reveal.spec.ts`, the existing
 * dedicated proof for that surface.
 */
test("concept generation without a configured provider is recorded honestly, and a pending image is approved exactly once", async ({
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
  const opportunityRepo = new CorporateOpportunityRepository(admin);
  const tenderRepo = new CorporateTenderRepository(admin);
  const generationRepo = new AIGenerationRepository(admin);
  const conceptRepo = new CorporateConceptAssetRepository(admin);

  const created = await opportunityRepo.create({
    retailerId,
    companyName: `E2E Concept Co ${unique}`,
  });
  if (!created.ok) throw new Error("failed to seed opportunity");
  const opportunity = created.opportunity;

  const tenderResult = await tenderRepo.create({
    retailerId,
    opportunityId: opportunity.id,
    opportunityStage: opportunity.stage,
    title: `E2E Concept Tender ${unique}`,
  });
  if (!tenderResult.ok) throw new Error("failed to seed tender");

  const versionResult = await tenderRepo.createVersion({
    retailerId,
    tenderId: tenderResult.tender.id,
    summary: "A formalwear programme for head-office staff.",
    garmentConcepts: ["Two-piece suit", "Overcoat"],
  });
  if (!versionResult.ok) throw new Error("failed to seed tender version");
  const version = versionResult.version;

  try {
    await page.goto(`/business-development/${opportunity.id}`);

    // 1. No AI image provider is configured in this local environment
    // (a genuine condition, not simulated) — requesting generation must
    // record a real, honest failure, never a fabricated image.
    const beforeCount =
      (
        await admin
          .from("ai_generations")
          .select("id", { count: "exact", head: true })
          .eq("retailer_id", retailerId)
          .eq("kind", "corporate_concept")
      ).count ?? 0;

    await page.getByRole("button", { name: "Generate concept images" }).click();

    // The server action is a Next.js form POST with no client-side
    // signal to wait on (nothing visibly changes on this failure path —
    // "None generated yet." reads the same before and after) — poll the
    // database directly for the row it is responsible for writing.
    await expect
      .poll(
        async () =>
          (
            await admin
              .from("ai_generations")
              .select("id", { count: "exact", head: true })
              .eq("retailer_id", retailerId)
              .eq("kind", "corporate_concept")
          ).count ?? 0,
        { timeout: 15_000 },
      )
      .toBe(beforeCount + 1);

    const { data: generations } = await admin
      .from("ai_generations")
      .select("status, error_message")
      .eq("retailer_id", retailerId)
      .eq("kind", "corporate_concept")
      .order("created_at", { ascending: false })
      .limit(1);
    const latestGeneration = generations?.[0];
    expect(latestGeneration?.status).toBe("failed");
    expect(latestGeneration?.error_message).toContain("not configured");

    const assetsAfterFailure = await conceptRepo.listByTenderVersion(
      version.id,
    );
    expect(assetsAfterFailure).toHaveLength(0);

    // 2. A pending asset, seeded directly (mirroring 17.1's own
    // precedent of seeding AI output rather than driving a live call in
    // a browser test), is approved exactly once through the real UI.
    const seededGeneration = await generationRepo.record({
      retailerId,
      kind: "corporate_concept",
      status: "succeeded",
      provider: "mock",
      model: "mock-concept-v1",
      inputSummary: `Concept images for tender version ${version.id}`,
    });
    const asset = await conceptRepo.create({
      retailerId,
      tenderVersionId: version.id,
      aiGenerationId: seededGeneration.id,
      imageUrl: "https://example.test/e2e-concept.png",
      prompt: "E2E seeded concept prompt",
    });

    await page.reload();
    await expect(page.getByText("Pending approval")).toBeVisible();

    await page.getByRole("button", { name: "Approve image" }).click();
    await expect(page.getByText("Approved", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Approve image" }),
    ).toHaveCount(0);

    const decided = await conceptRepo.findById(asset.id);
    expect(decided?.status).toBe("approved");
    expect(decided?.approvedByStaffId).toBeTruthy();

    // A second decision at the same write path the UI uses is refused —
    // not just withheld by which button the page happens to render.
    const redecide = await conceptRepo.decide({
      assetId: asset.id,
      decision: "rejected",
      staffId: decided!.approvedByStaffId!,
    });
    expect(redecide).toEqual({ ok: false, reason: "already_decided" });

    proofPassed = true;
  } finally {
    await admin
      .from("corporate_opportunities")
      .delete()
      .eq("id", opportunity.id);
  }
});
