import { CorporateRepository, createSupabaseAdminClient } from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import {
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
  TEST_RETAILER_SLUG,
} from "./fixtures";
import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "18.9";
const BROWSER_PROOF_SPEC =
  "apps/retailer/e2e/corporate-renewal-analytics.spec.ts";

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
 * Proves the corporate analytics and renewal engine (PHASE 18.9 /
 * BD-109) end to end: recomputing produces a real, cited
 * `cited_recommendations` row (reusing 14.2's own mechanism, not a
 * second one), a struggling programme's high renewal risk really
 * auto-creates a task (not just displays a warning), and marking that
 * task done is real — asserted against the database.
 */
test("a struggling programme's renewal risk is computed and cited, auto-creates a task, and the task can be closed", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
  const repo = new CorporateRepository(admin);

  const { data: retailer } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");
  const retailerId = asId<"RetailerId">(retailer.id);

  const unique = Date.now();
  const account = await repo.createAccount(retailerId, {
    legalName: `E2E Renewal Co ${unique}`,
    accountReference: `E2E-REN-${unique}`,
  });
  const programme = await repo.createProgramme(retailerId, {
    accountId: account.id,
    name: `E2E Renewal Programme ${unique}`,
    siteKeys: [],
  });
  // A struggling programme: only one of two wearers active, and damage
  // exceptions logged against them — low participation, low fulfilment,
  // real damage rate.
  const wearer1 = await repo.createWearer(retailerId, {
    programmeId: programme.id,
    employeeReference: `E2E-REN1-${unique}`,
    displayName: `E2E Renewal Wearer One ${unique}`,
    roleKey: "associate",
    joinedOn: "2025-01-01",
  });
  const wearer2 = await repo.createWearer(retailerId, {
    programmeId: programme.id,
    employeeReference: `E2E-REN2-${unique}`,
    displayName: `E2E Renewal Wearer Two ${unique}`,
    roleKey: "associate",
    joinedOn: "2025-01-01",
  });
  await repo.setWearerActive(wearer2.id, false);
  await repo.createException(retailerId, {
    programmeId: programme.id,
    wearerId: wearer1.id,
    kind: "damaged",
    detail: `E2E damaged jacket for renewal risk ${unique}`,
  });
  await repo.createException(retailerId, {
    programmeId: programme.id,
    wearerId: wearer2.id,
    kind: "missing",
    detail: `E2E missing garment for renewal risk ${unique}`,
  });
  await repo.createException(retailerId, {
    programmeId: programme.id,
    wearerId: wearer1.id,
    kind: "repair",
    detail: `E2E repair needed for renewal risk ${unique}`,
  });

  try {
    await page.goto(`/corporate/${programme.id}`);

    // Set contract value and verify it persists.
    await page.getByLabel("Contract value (minor units)").fill("250000");
    await page.getByLabel("Currency").fill("GBP");
    await page.getByRole("button", { name: "Set contract value" }).click();
    await expect(page).toHaveURL(/\/corporate\/[^/]+$/);
    await page.reload();
    await expect(page.getByLabel("Contract value (minor units)")).toHaveValue(
      "250000",
    );
    await expect(page.getByLabel("Currency")).toHaveValue("GBP");

    const { data: programmeFetched } = await admin
      .from("corporate_programmes")
      .select("contract_value_minor_units, contract_value_currency")
      .eq("id", programme.id)
      .single();
    expect(programmeFetched?.contract_value_minor_units).toBe(250000);
    expect(programmeFetched?.contract_value_currency).toBe("GBP");

    await page.getByRole("button", { name: "Recompute" }).click();
    await expect(
      page.getByText(/renewal risk (medium|high)/).first(),
    ).toBeVisible();

    // The shared fixture retailer accumulates one live
    // corporate_renewal_risk row per programme across runs, so this
    // must be scoped by this test's own programme marker, not .single()
    // over every live row of the kind for the retailer.
    const marker = `corporate_programme:${programme.id}`;
    const { data: liveRenewalRiskRows } = await admin
      .from("cited_recommendations")
      .select("kind, sources, withdrawn_at")
      .eq("retailer_id", retailerId)
      .eq("kind", "corporate_renewal_risk")
      .is("withdrawn_at", null);
    const recommendation = (liveRenewalRiskRows ?? []).find((row) =>
      (row.sources as unknown as { sourceRef: string }[]).some(
        (s) => s.sourceRef === marker,
      ),
    );
    expect(recommendation).toBeTruthy();

    await expect(page.getByText("Renewal task open")).toBeVisible();

    const { data: task } = await admin
      .from("corporate_renewal_tasks")
      .select("id, status")
      .eq("programme_id", programme.id)
      .eq("status", "open")
      .single();
    expect(task).toBeTruthy();

    await page.getByRole("button", { name: "Mark done" }).click();
    await expect(page.getByText("Renewal task open")).toHaveCount(0);

    const { data: resolvedTask } = await admin
      .from("corporate_renewal_tasks")
      .select("status, resolved_at")
      .eq("id", task?.id ?? "")
      .single();
    expect(resolvedTask?.status).toBe("done");
    expect(resolvedTask?.resolved_at).toBeTruthy();

    // Recomputing again must not create a second task while the first
    // is still... already resolved here, so a fresh one is allowed; the
    // real guarantee (no duplicate while one is open) is enforced by
    // the unique index and covered by domain unit tests directly.

    proofPassed = true;
  } finally {
    await admin.from("corporate_accounts").delete().eq("id", account.id);
  }
});
