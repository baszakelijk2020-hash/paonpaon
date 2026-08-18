import {
  CorporateOfficeVisitRepository,
  CorporateRepository,
  createSupabaseAdminClient,
} from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import { TEST_RETAILER_SLUG } from "./fixtures";

/**
 * Proves the cross-company isolation on the public office-visit landing page
 * (PHASE 18.4 / BD-104): the RPC validates p_programme_id against a real active
 * programme/account/retailer and returns only that scoped data. This test
 * verifies that company A cannot see company B's page — neither via UI
 * (the page's heading/name text) nor via database (submitted requests are
 * attributed only to the accessed programme_id).
 */
test("corporate-office-visit-isolation: an anonymous visitor cannot see another company's data", async ({
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

  const unique = Date.now();
  const repo = new CorporateRepository(admin);

  // Create Company A
  const accountA = await repo.createAccount(retailerId, {
    legalName: `Company A Isolation Test ${unique}`,
    accountReference: `E2E-ISO-A-${unique}`,
  });
  const programmeA = await repo.createProgramme(retailerId, {
    accountId: accountA.id,
    name: `Office Visit Programme A ${unique}`,
    siteKeys: [],
  });

  // Create Company B
  const accountB = await repo.createAccount(retailerId, {
    legalName: `Company B Isolation Test ${unique}`,
    accountReference: `E2E-ISO-B-${unique}`,
  });
  const programmeB = await repo.createProgramme(retailerId, {
    accountId: accountB.id,
    name: `Office Visit Programme B ${unique}`,
    siteKeys: [],
  });

  const requesterName = `Isolation Test Requester ${unique}`;

  try {
    // ========== STEP 1: Navigate to Company A's page and verify isolation ==========
    await page.goto(`/r/${TEST_RETAILER_SLUG}/corporate/${programmeA.id}`);

    // Company A's data MUST be visible
    await expect(
      page.getByRole("heading", { name: accountA.legalName }),
    ).toBeVisible();
    await expect(page.getByText(programmeA.name)).toBeVisible();

    // Company B's data MUST NOT be visible anywhere on the page
    await expect(page.getByText(accountB.legalName)).toHaveCount(0);
    await expect(page.getByText(programmeB.name)).toHaveCount(0);

    // ========== STEP 2: Submit a visit request on Company A's page ==========
    await page.getByLabel("Your name").fill(requesterName);
    await page.getByLabel("Note (optional)").fill("Isolation test visit.");
    await page.getByRole("button", { name: "Request a visit" }).click();
    await expect(page.getByRole("status")).toBeVisible();

    // ========== STEP 3: Verify database-level isolation ==========
    const visitRepo = new CorporateOfficeVisitRepository(admin);

    // Company A's programme should have exactly 1 request
    const requestsA = await visitRepo.findByProgramme(programmeA.id);
    expect(requestsA).toHaveLength(1);
    const [requestA] = requestsA;
    expect(requestA?.requesterName).toBe(requesterName);
    expect(requestA?.note).toBe("Isolation test visit.");

    // Company B's programme should have 0 requests (complete isolation)
    const requestsB = await visitRepo.findByProgramme(programmeB.id);
    expect(requestsB).toHaveLength(0);

    // ========== STEP 4: Navigate to Company B's page and verify symmetric isolation ==========
    await page.goto(`/r/${TEST_RETAILER_SLUG}/corporate/${programmeB.id}`);

    // Company B's data MUST be visible
    await expect(
      page.getByRole("heading", { name: accountB.legalName }),
    ).toBeVisible();
    await expect(page.getByText(programmeB.name)).toBeVisible();

    // Company A's data MUST NOT be visible anywhere on Company B's page
    await expect(page.getByText(accountA.legalName)).toHaveCount(0);
    await expect(page.getByText(programmeA.name)).toHaveCount(0);
  } finally {
    // Clean up both corporate accounts (cascades to programmes and requests)
    await admin.from("corporate_accounts").delete().eq("id", accountA.id);
    await admin.from("corporate_accounts").delete().eq("id", accountB.id);
  }
});
