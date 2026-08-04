import {
  CorporateOpportunityRepository,
  CorporateProjectRepository,
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

const PHASE_ITEM_ID = "18.7";
const BROWSER_PROOF_SPEC =
  "apps/retailer/e2e/corporate-project-lifecycle.spec.ts";

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
 * Proves PHASE 18.7's lifecycle state machine end to end: creating an
 * opportunity really creates its project at `opportunity`, authoring a
 * tender really auto-advances it to `tender`, winning the opportunity
 * really auto-advances it to `award` and links the real account, and a
 * staff member advancing a later checkpoint through the UI really writes
 * an audited transition — not just a page that claims it did.
 */
test("an opportunity's project lifecycle auto-advances on tender/win and a staff member can advance later checkpoints", async ({
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
  const companyName = `E2E Lifecycle Co ${unique}`;

  const opportunityRepo = new CorporateOpportunityRepository(admin);
  const projectRepo = new CorporateProjectRepository(admin);
  const tenderRepo = new CorporateTenderRepository(admin);

  const created = await opportunityRepo.create({ retailerId, companyName });
  if (!created.ok) throw new Error("failed to seed opportunity");
  const opportunity = created.opportunity;

  try {
    // 1. Creating the opportunity really created its project at
    // `opportunity` — not left absent until some later page load.
    let project = await projectRepo.findByOpportunity(opportunity.id);
    expect(project?.stage).toBe("opportunity");

    // 2. Move the opportunity to `tender_sent` so a tender can be
    // authored (mirrors the real UI's own `checkCreateTender` gate).
    await opportunityRepo.transitionStage({
      retailerId,
      opportunityId: opportunity.id,
      to: "qualified",
    });
    await opportunityRepo.transitionStage({
      retailerId,
      opportunityId: opportunity.id,
      to: "tender_sent",
    });

    // 3. Authoring the first tender really auto-advances the project to
    // `tender` — the real trigger this item names, not a manual claim.
    const tenderCreated = await tenderRepo.create({
      retailerId,
      opportunityId: opportunity.id,
      opportunityStage: "tender_sent",
      title: "E2E lifecycle tender",
    });
    if (!tenderCreated.ok) throw new Error("failed to seed tender");
    project = await projectRepo.findByOpportunity(opportunity.id);
    expect(project?.stage).toBe("tender");

    // 4. Winning the opportunity through the real UI really auto-advances
    // the project to `award` and links the real account.
    await page.goto(`/business-development/${opportunity.id}`);
    await expect(
      page.getByRole("heading", { name: "Project lifecycle" }),
    ).toBeVisible();
    await expect(page.getByText("Tender", { exact: true })).toBeVisible();

    await page
      .getByLabel("Account reference (creates the corporate account)")
      .fill(`E2E-LIFECYCLE-${unique}`);
    await page
      .getByRole("button", { name: "Win — create corporate account" })
      .click();
    await expect(page.getByText("Award", { exact: true })).toBeVisible();

    project = await projectRepo.findByOpportunity(opportunity.id);
    expect(project?.stage).toBe("award");
    expect(project?.accountId).toBeTruthy();

    // 5. A staff member advances the next checkpoint through the real
    // UI, with a note — proving the manual half of the state machine,
    // not just the automatic half.
    await page
      .getByLabel(/Note \(optional\)/)
      .fill("Design approved by client contact.");
    await page
      .getByRole("button", { name: "Advance to Design approval" })
      .click();
    await expect(
      page.getByText("Design approval", { exact: true }),
    ).toBeVisible();

    project = await projectRepo.findByOpportunity(opportunity.id);
    expect(project?.stage).toBe("design_approval");

    const events = project ? await projectRepo.listEvents(project.id) : [];
    const latest = events[0];
    expect(latest?.fromStage).toBe("award");
    expect(latest?.toStage).toBe("design_approval");
    expect(latest?.note).toContain("Design approved");
    expect(latest?.staffId).toBeTruthy();

    // 6. Skip-ahead is refused at the repository/domain layer, not just
    // withheld by the UI's own choice of which button to show.
    const skip = await projectRepo.advanceStage({
      retailerId,
      opportunityId: opportunity.id,
      to: "production",
    });
    expect(skip.ok).toBe(false);

    proofPassed = true;
  } finally {
    const finalProject = await projectRepo.findByOpportunity(opportunity.id);
    await admin
      .from("corporate_opportunities")
      .delete()
      .eq("id", opportunity.id);
    if (finalProject?.accountId) {
      await admin
        .from("corporate_accounts")
        .delete()
        .eq("id", finalProject.accountId);
    }
  }
});
