import {
  CorporateOfficeVisitRepository,
  CorporateRepository,
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

const PHASE_ITEM_ID = "18.4";
const BROWSER_PROOF_SPEC = "apps/retailer/e2e/corporate-office-visit.spec.ts";

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
 * Proves the office-visit request queue (PHASE 18.4 / BD-104) end to
 * end: a request lands in the programme's intake queue, and marking it
 * "Scheduled" is real — asserted against the database, including that
 * `resolved_at` is actually set, not just the badge text changing.
 */
test("an office-visit request appears in the programme's queue and can be marked scheduled", async ({
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
    legalName: `E2E Office Visit Co ${unique}`,
    accountReference: `E2E-OV-${unique}`,
  });
  const programme = await repo.createProgramme(retailerId, {
    accountId: account.id,
    name: `E2E Office Visit Programme ${unique}`,
    siteKeys: [],
  });
  const requesterName = `E2E Requester ${unique}`;
  await new CorporateOfficeVisitRepository(admin).submit({
    programmeId: programme.id,
    requesterName,
    note: "Would like to book a fitting during the office visit.",
  });

  try {
    await page.goto(`/corporate/${programme.id}`);
    const row = page.locator("li", { hasText: requesterName });
    await expect(row).toBeVisible();
    await expect(row.getByText("Open")).toBeVisible();

    await row.getByRole("button", { name: "Scheduled" }).click();
    await expect(row.getByRole("button", { name: "Scheduled" })).toHaveCount(0);
    await expect(row.getByText("Scheduled", { exact: true })).toBeVisible();

    const { data: requestRow } = await admin
      .from("corporate_office_visit_requests")
      .select("status, resolved_at")
      .eq("programme_id", programme.id)
      .eq("requester_name", requesterName)
      .single();
    expect(requestRow?.status).toBe("scheduled");
    expect(requestRow?.resolved_at).toBeTruthy();

    proofPassed = true;
  } finally {
    await admin.from("corporate_accounts").delete().eq("id", account.id);
  }
});
