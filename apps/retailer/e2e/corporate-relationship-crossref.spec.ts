import {
  CorporateOpportunityRepository,
  CustomerFactRepository,
  CustomerRepository,
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

const PHASE_ITEM_ID = "18.12";
const BROWSER_PROOF_SPEC =
  "apps/retailer/e2e/corporate-relationship-crossref.spec.ts";
// A second, genuinely different retailer already seeded for the
// customer app's own e2e suite — reused here as "another tenant" for
// the cross-tenant-leakage check, rather than seeding a throwaway one.
const OTHER_RETAILER_SLUG = "e2e-customer-workspace";

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
 * Proves relationship cross-referencing (PHASE 18.12 / BD-112) end to
 * end: an existing client who lists the target company as their
 * employer is surfaced as a citable match, adding it as a signal really
 * moves the score by the existing_customer_link weight (30), and a
 * matching employer fact recorded under a DIFFERENT retailer is never
 * surfaced — no cross-tenant leakage, not just reasoned about.
 */
test("an existing client's employer fact surfaces as a citable match, and a match under a different retailer never leaks", async ({
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

  const { data: otherRetailer } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", OTHER_RETAILER_SLUG)
    .single();
  if (!otherRetailer) throw new Error("other fixture retailer missing");
  const otherRetailerId = asId<"RetailerId">(otherRetailer.id);

  const unique = Date.now();
  const companyName = `E2E Crossref Target Co ${unique}`;

  const customerRepo = new CustomerRepository(admin);
  const factRepo = new CustomerFactRepository(admin);
  const opportunityRepo = new CorporateOpportunityRepository(admin);

  const { data: staff } = await admin
    .from("retailer_staff_members")
    .select("id")
    .eq("retailer_id", retailerId)
    .limit(1)
    .single();
  if (!staff) throw new Error("fixture staff missing");

  const ourClient = await customerRepo.create({
    retailerId,
    fullName: `E2E Crossref Client ${unique}`,
    email: `e2e-crossref-${unique}@paon.test`,
    lifecycleStage: "prospect",
  });
  const ourFact = await factRepo.record({
    retailerId,
    customerId: ourClient.id,
    staffId: asId<"StaffId">(staff.id),
    factType: "employer",
    valueLabel: companyName,
  });

  // Same company name, but a DIFFERENT retailer's own client — this
  // must never surface on the first retailer's opportunity page.
  const otherClient = await customerRepo.create({
    retailerId: otherRetailerId,
    fullName: `E2E Crossref Other-Tenant Client ${unique}`,
    email: `e2e-crossref-other-${unique}@paon.test`,
    lifecycleStage: "prospect",
  });
  const { data: otherStaff } = await admin
    .from("retailer_staff_members")
    .select("id")
    .eq("retailer_id", otherRetailerId)
    .limit(1)
    .single();
  if (otherStaff) {
    await factRepo.record({
      retailerId: otherRetailerId,
      customerId: otherClient.id,
      staffId: asId<"StaffId">(otherStaff.id),
      factType: "employer",
      valueLabel: companyName,
    });
  }

  const opportunity = await opportunityRepo.create({
    retailerId,
    companyName,
  });
  if (!opportunity.ok) throw new Error("failed to seed opportunity");

  try {
    await page.goto(`/business-development/${opportunity.opportunity.id}`);
    await expect(
      page.getByRole("heading", { name: "Existing customer match" }),
    ).toBeVisible();
    await expect(page.getByText(ourClient.fullName)).toBeVisible();
    // No cross-tenant leakage: the other retailer's client never appears.
    await expect(page.getByText(otherClient.fullName)).toHaveCount(0);

    await page.getByRole("button", { name: "Add as signal" }).click();
    await expect(page.getByText("Score 30")).toBeVisible();

    const { data: signals } = await admin
      .from("corporate_opportunity_signals")
      .select("source, detail")
      .eq("opportunity_id", opportunity.opportunity.id);
    expect(signals).toHaveLength(1);
    expect(signals?.[0]?.source).toBe("existing_customer_link");
    expect(signals?.[0]?.detail).toContain(ourFact.id);

    proofPassed = true;
  } finally {
    await admin
      .from("corporate_opportunities")
      .delete()
      .eq("id", opportunity.opportunity.id);
    await admin.from("customers").delete().eq("id", ourClient.id);
    await admin.from("customers").delete().eq("id", otherClient.id);
  }
});
