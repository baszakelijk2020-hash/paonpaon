import { createSupabaseAdminClient } from "@paon/database";
import { expect, test } from "@playwright/test";

import {
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
  TEST_RETAILER_SLUG,
} from "./fixtures";
import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "18.13";
const BROWSER_PROOF_SPEC = "apps/retailer/e2e/corporate-full-lifecycle.spec.ts";

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
 * PHASE 18.13: one fixture company runs the retailer-side chain the
 * founder specified — signal -> opportunity -> qualification -> tender
 * -> win/corporate account -> programme -> wearer/employee -> portal
 * access grant -> fitting rollout -> service desk exception -> account
 * monitoring/renewal -> every named lifecycle checkpoint through to
 * renewal — end to end through the real UI, asserting the real
 * table/row each step is supposed to produce, not a rendered claim.
 *
 * Deliberately NOT re-proven here (each already has its own dedicated
 * browser proof and this spec stays retailer-app-only, no cross-app
 * auth switching):
 *  - the public tender "share" reveal (18.3,
 *    apps/customer/e2e/corporate-tender-reveal.spec.ts)
 *  - the office-visit landing page submission (18.4,
 *    apps/customer/e2e/corporate-office-visit.spec.ts)
 *  - employee portal sign-in and self-service (18.5,
 *    apps/customer/e2e/employee-portal.spec.ts) — raising a request
 *    from that side has a known, separately-documented open bug (see
 *    18.8's PHASE.md status), not attempted here.
 *
 * Real, named gaps this run does not paper over: no bulk "employee
 * import" exists (one wearer is added, not a batch), and
 * production/qc/distribution/launch advance as staff-decided
 * checkpoints with no live production-order or measurement object
 * behind them yet (18.7's own named gap) — this proves every stage
 * has a real, audited transition, not that those specific stages are
 * wired to Stage 12 production.
 */
test("one fixture company runs the built portion of the corporate lifecycle end to end", async ({
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
  const retailerId = retailer.id as string;

  const unique = Date.now();
  const companyName = `E2E Full Lifecycle Co ${unique}`;
  let opportunityId: string | undefined;
  let accountId: string | undefined;

  try {
    // 1. Signal -> opportunity.
    await page.goto("/business-development");
    await page.getByLabel("Company name").fill(companyName);
    await page.getByRole("button", { name: "Add opportunity" }).click();
    await expect(page.getByText(companyName)).toBeVisible();

    const { data: opportunity } = await admin
      .from("corporate_opportunities")
      .select("id")
      .eq("retailer_id", retailerId)
      .eq("company_name", companyName)
      .single();
    if (!opportunity) throw new Error("opportunity not created");
    opportunityId = opportunity.id as string;

    const { data: projectAfterCreate } = await admin
      .from("corporate_projects")
      .select("stage")
      .eq("opportunity_id", opportunityId)
      .single();
    expect(projectAfterCreate?.stage).toBe("opportunity");

    await page.goto(`/business-development/${opportunityId}`);
    await page.getByLabel("Source").selectOption("referral");
    await page
      .getByLabel("Detail")
      .fill("Referred by an existing corporate account manager.");
    await page.getByRole("button", { name: "Add signal" }).click();
    await expect(page.getByText("Score 25")).toBeVisible();

    // 2. Qualification.
    await page.getByRole("button", { name: "Qualified" }).click();
    await expect(page.getByText("Qualified", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Tender sent" }).click();
    await expect(page.getByText("Tender sent")).toBeVisible();

    // 3. Tender, authored and approved (project -> tender automatically).
    await page.getByLabel("Tender title").fill("E2E full-lifecycle tender");
    await page.getByRole("button", { name: "Start a tender" }).click();
    await page
      .getByLabel(/^Summary$/)
      .fill("Full corporate wardrobe programme proposal.");
    await page
      .getByLabel("Garment concepts (one per line)")
      .fill("Two-piece suit\nDress shirt");
    await page.getByRole("button", { name: "Add version" }).click();
    await page.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("Approved", { exact: true })).toBeVisible();

    const { data: projectAfterTender } = await admin
      .from("corporate_projects")
      .select("stage")
      .eq("opportunity_id", opportunityId)
      .single();
    expect(projectAfterTender?.stage).toBe("tender");

    // 4. Win -> real corporate account (project -> award automatically).
    const accountReference = `E2E-FULL-${unique}`;
    await page
      .getByLabel("Account reference (creates the corporate account)")
      .fill(accountReference);
    await page
      .getByRole("button", { name: "Win — create corporate account" })
      .click();
    await expect(page.getByText("Won", { exact: true })).toBeVisible();

    const { data: won } = await admin
      .from("corporate_opportunities")
      .select("linked_account_id")
      .eq("id", opportunityId)
      .single();
    accountId = won?.linked_account_id ?? undefined;
    expect(accountId).toBeTruthy();

    const { data: projectAfterWin } = await admin
      .from("corporate_projects")
      .select("stage, account_id")
      .eq("opportunity_id", opportunityId)
      .single();
    expect(projectAfterWin?.stage).toBe("award");
    expect(projectAfterWin?.account_id).toBe(accountId);

    // 5. Programme, for the real account just created.
    await page.goto("/corporate");
    await page
      .getByLabel("Account", { exact: true })
      .selectOption({ label: companyName });
    const programmeName = `E2E Full Lifecycle Programme ${unique}`;
    await page.getByLabel("Programme name").fill(programmeName);
    await page.getByRole("button", { name: "Add programme" }).click();
    await expect(page.getByText(programmeName)).toBeVisible();

    const { data: programme } = await admin
      .from("corporate_programmes")
      .select("id")
      .eq("account_id", accountId ?? "")
      .single();
    if (!programme) throw new Error("programme not created");
    const programmeId = programme.id as string;

    await page.goto(`/corporate/${programmeId}`);
    await expect(
      page.getByRole("heading", { name: programmeName }),
    ).toBeVisible();

    // 6. Employee (wearer), and portal access.
    const wearerName = `E2E Full Lifecycle Wearer ${unique}`;
    await page.getByText("Add a wearer").click();
    await page.getByLabel("Employee reference").fill(`E2E-EMP-${unique}`);
    await page.getByLabel("Display name").fill(wearerName);
    await page.getByLabel("Role key").fill("associate");
    await page.getByLabel("Joined on").fill("2025-01-01");
    await page.getByRole("button", { name: "Add wearer" }).click();

    const wearerRow = page.locator("li", { hasText: wearerName }).first();
    await expect(wearerRow).toBeVisible();
    await wearerRow
      .getByLabel("Employee Portal login email")
      .fill(`e2e-full-wearer-${unique}@paon.test`);
    await wearerRow.getByRole("button", { name: "Grant access" }).click();
    await expect(wearerRow.getByText(/Portal access:/)).toBeVisible();

    // 7. Fitting rollout: a day, and the wearer assigned to it.
    await page.getByText("Add a fitting day").click();
    await page.getByLabel("Date").fill("2026-09-01");
    await page.getByLabel("Capacity").fill("2");
    await page.getByRole("button", { name: "Add fitting day" }).click();

    const dayCard = page.locator('[data-rollout-day="2026-09-01"]');
    await expect(dayCard).toBeVisible();
    await dayCard
      .getByLabel("Assign wearer")
      .selectOption({ label: wearerName });
    await dayCard.getByRole("button", { name: "Assign" }).click();
    await expect(dayCard.getByText(wearerName)).toBeVisible();

    // 8. Corporate service desk: an exception logged and resolved.
    const exceptionDetail = `E2E full-lifecycle exception ${unique}`;
    await page.getByText("Log an exception").click();
    await page.getByLabel("Kind").selectOption("fit_issue");
    await page.getByLabel("Detail").fill(exceptionDetail);
    await page.getByRole("button", { name: "Log exception" }).click();
    const exceptionRow = page.locator("li", { hasText: exceptionDetail });
    await expect(exceptionRow).toBeVisible();
    await exceptionRow.getByRole("button", { name: "Resolve" }).click();
    await expect(exceptionRow.getByText("Resolved")).toBeVisible();

    // 9. Account monitoring / renewal analytics.
    await page.getByRole("button", { name: "Recompute" }).click();
    await expect(page.getByText(/Sample size/)).toBeVisible();

    // 10. Every remaining named checkpoint, one audited transition at a
    // time, through to renewal — the manual half of 18.7's state
    // machine, proven here for the full remaining chain rather than
    // just the first step.
    await page.goto(`/business-development/${opportunityId}`);
    const remainingStages = [
      "Design approval",
      "Sample approval",
      "Material approval",
      "Employee import",
      "Fitting",
      "Production",
      "QC",
      "Distribution",
      "Launch",
      "Renewal",
    ];
    for (const stageLabel of remainingStages) {
      await page
        .getByRole("button", { name: `Advance to ${stageLabel}` })
        .click();
      await expect(page.getByText(stageLabel, { exact: true })).toBeVisible();
    }

    const { data: project } = await admin
      .from("corporate_projects")
      .select("id, stage")
      .eq("opportunity_id", opportunityId)
      .single();
    expect(project?.stage).toBe("renewal");

    const { data: finalEvents } = await admin
      .from("corporate_project_events")
      .select("from_stage, to_stage")
      .eq("project_id", project?.id ?? "")
      .order("created_at", { ascending: true });
    // Every named stage was really visited, in order, with a real
    // audit row for each transition — not a status jumped in place.
    expect(finalEvents?.map((e) => e.to_stage)).toEqual([
      "opportunity",
      "tender",
      "award",
      "design_approval",
      "sample_approval",
      "material_approval",
      "employee_import",
      "fitting",
      "production",
      "qc",
      "distribution",
      "launch",
      "renewal",
    ]);

    proofPassed = true;
  } finally {
    if (accountId) {
      await admin.from("corporate_accounts").delete().eq("id", accountId);
    }
    if (opportunityId) {
      await admin
        .from("corporate_opportunities")
        .delete()
        .eq("id", opportunityId);
    }
  }
});
