import {
  CorporateOpportunityRepository,
  CorporateProjectRepository,
  CorporateRepository,
  CorporateRolloutRepository,
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

let stateMachineProofPassed = false;
let rolloutAutoAdvanceProofPassed = false;

test.afterAll(async () => {
  await writeBrowserProofRun({
    phaseItemId: PHASE_ITEM_ID,
    spec: BROWSER_PROOF_SPEC,
    status:
      stateMachineProofPassed && rolloutAutoAdvanceProofPassed
        ? "passed"
        : "failed",
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

    stateMachineProofPassed = true;
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

/**
 * Proves 18.7's own previously-named gap: the `fitting` and `production`
 * checkpoints had no automatic trigger from 18.6's real rollout events,
 * only a staff button. Assigning the first wearer to a rollout day now
 * really auto-advances an `employee_import` project to `fitting`, and
 * completing the last still-`planned` slot for the programme really
 * auto-advances it to `production` — proven by NOT clicking either
 * "Advance to Fitting"/"Advance to Production" button, only calling the
 * real rollout write path (`CorporateRolloutRepository`) the retailer UI
 * itself uses, and reading the project stage back from the database.
 * Also proves completing one of two assigned wearers does NOT yet
 * advance the project — only when every planned slot is accounted for.
 */
test("assigning the first rollout wearer and completing the last planned slot auto-advance the project", async () => {
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
  const companyName = `E2E Rollout Auto-Advance Co ${unique}`;

  const opportunityRepo = new CorporateOpportunityRepository(admin);
  const projectRepo = new CorporateProjectRepository(admin);
  const tenderRepo = new CorporateTenderRepository(admin);
  const corporateRepo = new CorporateRepository(admin);
  const rolloutRepo = new CorporateRolloutRepository(admin);

  const created = await opportunityRepo.create({ retailerId, companyName });
  if (!created.ok) throw new Error("failed to seed opportunity");
  const opportunity = created.opportunity;
  let accountId: ReturnType<typeof asId<"CorporateAccountId">> | undefined;

  try {
    // Walk the opportunity to `award` with a real linked account the
    // same way the first test does, then advance the remaining
    // checkpoints up to `employee_import` at the repository layer —
    // already proven at the UI layer above and in
    // corporate-full-lifecycle.spec.ts, so this test starts from
    // exactly the stage its own new behaviour cares about.
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
    const tenderCreated = await tenderRepo.create({
      retailerId,
      opportunityId: opportunity.id,
      opportunityStage: "tender_sent",
      title: "E2E rollout auto-advance tender",
    });
    if (!tenderCreated.ok) throw new Error("failed to seed tender");
    const won = await opportunityRepo.winAndCreateAccount({
      retailerId,
      opportunityId: opportunity.id,
      accountReference: `E2E-ROLLOUT-ADV-${unique}`,
    });
    if (!won.ok || !won.opportunity.linkedAccountId) {
      throw new Error("failed to win opportunity");
    }
    accountId = won.opportunity.linkedAccountId;

    for (const to of [
      "design_approval",
      "sample_approval",
      "material_approval",
      "employee_import",
    ] as const) {
      const advanced = await projectRepo.advanceStage({
        retailerId,
        opportunityId: opportunity.id,
        to,
      });
      expect(advanced.ok).toBe(true);
    }
    let project = await projectRepo.findByOpportunity(opportunity.id);
    expect(project?.stage).toBe("employee_import");

    // A real programme and two real wearers for that account — the
    // rollout event this test actually proves needs a genuine programme
    // to plan against, not a stand-in id.
    const programme = await corporateRepo.createProgramme(retailerId, {
      accountId,
      name: `E2E Rollout Auto-Advance Programme ${unique}`,
      siteKeys: [],
    });
    const wearer1 = await corporateRepo.createWearer(retailerId, {
      programmeId: programme.id,
      employeeReference: `E2E-ADV-1-${unique}`,
      displayName: `E2E Auto-Advance Wearer One ${unique}`,
      roleKey: "associate",
      joinedOn: "2025-01-01",
    });
    const wearer2 = await corporateRepo.createWearer(retailerId, {
      programmeId: programme.id,
      employeeReference: `E2E-ADV-2-${unique}`,
      displayName: `E2E Auto-Advance Wearer Two ${unique}`,
      roleKey: "associate",
      joinedOn: "2025-01-01",
    });
    const day = await rolloutRepo.createDay({
      retailerId,
      programmeId: programme.id,
      fittingDate: "2026-09-15",
      capacity: 2,
    });

    // Assigning the FIRST wearer to the rollout is the real-world
    // signal that fitting has begun — the project moves from
    // `employee_import` to `fitting` with no button clicked.
    const slot1 = await rolloutRepo.assignWearer({
      retailerId,
      programmeId: programme.id,
      rolloutDayId: day.id,
      wearerId: wearer1.id,
      capacity: day.capacity,
    });
    expect(slot1.ok).toBe(true);
    project = await projectRepo.findByOpportunity(opportunity.id);
    expect(project?.stage).toBe("fitting");

    const slot2 = await rolloutRepo.assignWearer({
      retailerId,
      programmeId: programme.id,
      rolloutDayId: day.id,
      wearerId: wearer2.id,
      capacity: day.capacity,
    });
    expect(slot2.ok).toBe(true);

    // Completing only one of the two planned slots must NOT yet advance
    // the project — one wearer is still waiting to be fitted.
    if (!slot1.ok) throw new Error("unreachable");
    await rolloutRepo.markCompleted({
      retailerId,
      programmeId: programme.id,
      slotId: slot1.slot.id,
    });
    project = await projectRepo.findByOpportunity(opportunity.id);
    expect(project?.stage).toBe("fitting");

    // Completing the LAST planned slot really does advance the project
    // to `production` — the honest "everyone fitted" signal, not a
    // fabricated one.
    if (!slot2.ok) throw new Error("unreachable");
    await rolloutRepo.markCompleted({
      retailerId,
      programmeId: programme.id,
      slotId: slot2.slot.id,
    });
    project = await projectRepo.findByOpportunity(opportunity.id);
    expect(project?.stage).toBe("production");

    const events = project ? await projectRepo.listEvents(project.id) : [];
    const productionEvent = events.find((e) => e.toStage === "production");
    expect(productionEvent?.fromStage).toBe("fitting");
    // Automatic transitions are attributed to the system, not to
    // whichever staff member's session happened to trigger them.
    expect(productionEvent?.staffId).toBeNull();

    rolloutAutoAdvanceProofPassed = true;
  } finally {
    await admin
      .from("corporate_opportunities")
      .delete()
      .eq("id", opportunity.id);
    if (accountId) {
      await admin.from("corporate_accounts").delete().eq("id", accountId);
    }
  }
});
