import { createSupabaseAdminClient } from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import {
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
  TEST_RETAILER_SLUG,
} from "./fixtures";
import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "18.1";
const BROWSER_PROOF_SPEC = "apps/retailer/e2e/business-development.spec.ts";

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
 * Proves the corporate opportunity pipeline (PHASE 18.1 / BD-101) end to
 * end: an opportunity is created, two signals compose a plain, inspectable
 * score, the stage moves forward exactly one step at a time, and winning
 * really creates the corporate account rather than just relabelling the
 * opportunity.
 */
test("a corporate opportunity is scored from its signals, staged forward, and won into a real corporate account", async ({
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
  const companyName = `E2E Opportunity Co ${unique}`;
  const accountReference = `E2E-BD-${unique}`;

  let opportunityId: string | undefined;
  let accountId: string | undefined;

  try {
    await page.goto("/business-development");
    await page.getByLabel("Company name").fill(companyName);
    await page.getByRole("button", { name: "Add opportunity" }).click();

    const row = page.locator("li", { hasText: companyName });
    await expect(row).toBeVisible();
    await expect(row.getByText("Identified")).toBeVisible();
    await row.click();

    await expect(
      page.getByRole("heading", { name: companyName }),
    ).toBeVisible();

    const { data: created } = await admin
      .from("corporate_opportunities")
      .select("id")
      .eq("retailer_id", retailerId)
      .eq("company_name", companyName)
      .single();
    if (!created) throw new Error("opportunity not found after creation");
    opportunityId = created.id;

    // First signal: existing_customer_link (weight 30).
    await page.getByLabel("Source").selectOption("existing_customer_link");
    await page
      .getByLabel("Detail")
      .fill("Their ops director already shops with us as a private client.");
    await page.getByRole("button", { name: "Add signal" }).click();
    await expect(page.getByText("Score 30")).toBeVisible();

    // Second signal: referral (weight 25) -> total 55.
    await page.getByLabel("Source").selectOption("referral");
    await page
      .getByLabel("Detail")
      .fill("Referred directly by an existing corporate account manager.");
    await page.getByRole("button", { name: "Add signal" }).click();
    await expect(page.getByText("Score 55")).toBeVisible();

    // Stage forward one step at a time: identified -> qualified -> tender_sent.
    await page.getByRole("button", { name: "Qualified" }).click();
    await expect(page.getByText("Qualified", { exact: true })).toBeVisible();
    // Skipping straight to "Won" must not be offered before a tender is sent.
    await expect(
      page.getByRole("button", { name: "Win — create corporate account" }),
    ).toHaveCount(0);

    await page.getByRole("button", { name: "Tender sent" }).click();
    await expect(page.getByText("Tender sent")).toBeVisible();

    await page
      .getByLabel("Account reference (creates the corporate account)")
      .fill(accountReference);
    await page
      .getByRole("button", { name: "Win — create corporate account" })
      .click();
    await expect(page.getByText("Won", { exact: true })).toBeVisible();

    const { data: won } = await admin
      .from("corporate_opportunities")
      .select("stage, linked_account_id")
      .eq("id", opportunityId)
      .single();
    expect(won?.stage).toBe("won");
    expect(won?.linked_account_id).toBeTruthy();
    accountId = won?.linked_account_id ?? undefined;

    const { data: account } = await admin
      .from("corporate_accounts")
      .select("legal_name, account_reference")
      .eq("id", accountId ?? "")
      .single();
    expect(account?.legal_name).toBe(companyName);
    expect(account?.account_reference).toBe(accountReference);

    proofPassed = true;
  } finally {
    if (opportunityId) {
      await admin
        .from("corporate_opportunities")
        .delete()
        .eq("id", opportunityId);
    }
    if (accountId) {
      await admin.from("corporate_accounts").delete().eq("id", accountId);
    }
  }
});
