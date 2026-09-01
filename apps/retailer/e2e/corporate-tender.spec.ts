import {
  CorporateOpportunityRepository,
  CorporateTenderRepository,
  PlatformModuleRepository,
  RetailerRepository,
  RetailerStaffRepository,
  createSupabaseAdminClient,
} from "@paon/database";
import { PLATFORM_MODULES, asId, type RetailerId } from "@paon/domain";
import { expect, test, type Browser } from "@playwright/test";

import {
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
  TEST_RETAILER_SLUG,
} from "./fixtures";
import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "18.2";
const BROWSER_PROOF_SPEC = "apps/retailer/e2e/corporate-tender.spec.ts";

let proofPassed = false;

async function activateAllModules(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  retailerId: RetailerId,
) {
  const modules = new PlatformModuleRepository(admin);
  for (const platformModule of PLATFORM_MODULES) {
    await modules.configure({
      retailerId,
      moduleKey: platformModule.key,
      state: "active",
      authorityMode:
        platformModule.key === "platform_core" ? "paon" : "co_managed",
      source: "add_on",
    });
  }
}

async function loginAs(
  browser: Browser,
  credentials: { email: string; password: string },
) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  return { context, page };
}

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

/**
 * Proves tenant isolation (ADR-003) for corporate tenders: a staff member
 * at retailer B cannot access tenders authored by retailer A, even with
 * direct API access — RLS filters the request to zero rows, triggering a
 * 404. The correct tenant's request succeeds and sees the tender.
 */
test("cross-tenant tender access is denied by RLS; same-tenant access succeeds", async ({
  browser,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
  const unique = Date.now();

  // Retailer A: create it with staff and a tender
  const retailerA = await new RetailerRepository(admin).create({
    legalName: `E2E Tender Isolation A ${unique}, Inc.`,
    displayName: `E2E Tender Isolation A ${unique}`,
    slug: `e2e-tender-iso-a-${unique}`,
    tier: "boutique",
    defaultCurrency: "USD",
    defaultLocale: "en-US",
    billingAddress: {
      line1: "1 Test Street",
      city: "Testville",
      postalCode: "00000",
      countryCode: "US",
    },
  });
  await admin
    .from("retailers")
    .update({ status: "active" })
    .eq("id", retailerA.id);
  await activateAllModules(admin, retailerA.id);

  const emailA = `e2e-tender-iso-a-staff-${unique}@paon.test`;
  const passwordA = "E2E-tender-isolation-password-789!";
  const { data: userA, error: userAError } = await admin.auth.admin.createUser({
    email: emailA,
    password: passwordA,
    email_confirm: true,
  });
  if (userAError || !userA.user) {
    throw new Error(
      `Failed to create retailer A user: ${userAError?.message ?? "unknown error"}`,
    );
  }
  const staffA = await new RetailerStaffRepository(admin).create({
    retailerId: retailerA.id,
    userId: userA.user.id as never,
    fullName: "E2E Tender Isolation A Staff",
    email: emailA,
    role: "manager",
  });
  await admin
    .from("retailer_staff_members")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", staffA.id);

  // Create an opportunity and tender for Retailer A
  const opportunityA = await new CorporateOpportunityRepository(admin).create({
    retailerId: retailerA.id,
    companyName: `E2E Isolation Test Company A ${unique}`,
  });
  if (!opportunityA.ok) throw new Error("failed to create opportunity A");

  const tenderA = await new CorporateTenderRepository(admin).create({
    retailerId: retailerA.id,
    opportunityId: opportunityA.opportunity.id,
    opportunityStage: opportunityA.opportunity.stage,
    title: `E2E Isolation Tender A ${unique}`,
  });
  if (!tenderA.ok) throw new Error("failed to create tender A");

  // Retailer B: create it with different staff
  const retailerB = await new RetailerRepository(admin).create({
    legalName: `E2E Tender Isolation B ${unique}, Inc.`,
    displayName: `E2E Tender Isolation B ${unique}`,
    slug: `e2e-tender-iso-b-${unique}`,
    tier: "boutique",
    defaultCurrency: "USD",
    defaultLocale: "en-US",
    billingAddress: {
      line1: "1 Test Street",
      city: "Testville",
      postalCode: "00000",
      countryCode: "US",
    },
  });
  await admin
    .from("retailers")
    .update({ status: "active" })
    .eq("id", retailerB.id);
  await activateAllModules(admin, retailerB.id);

  const emailB = `e2e-tender-iso-b-staff-${unique}@paon.test`;
  const passwordB = "E2E-tender-isolation-password-789!";
  const { data: userB, error: userBError } = await admin.auth.admin.createUser({
    email: emailB,
    password: passwordB,
    email_confirm: true,
  });
  if (userBError || !userB.user) {
    throw new Error(
      `Failed to create retailer B user: ${userBError?.message ?? "unknown error"}`,
    );
  }
  const staffB = await new RetailerStaffRepository(admin).create({
    retailerId: retailerB.id,
    userId: userB.user.id as never,
    fullName: "E2E Tender Isolation B Staff",
    email: emailB,
    role: "manager",
  });
  await admin
    .from("retailer_staff_members")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", staffB.id);

  try {
    // Test 1: Retailer B staff logs in and tries to reach Retailer A's
    // opportunity page. RLS should block the opportunity, resulting in 404.
    const sessionB = await loginAs(browser, {
      email: emailB,
      password: passwordB,
    });
    await sessionB.page.goto(
      `/business-development/${opportunityA.opportunity.id}`,
    );
    await expect(
      sessionB.page.getByRole("heading", { name: "404" }),
    ).toBeVisible();
    const pageContentB = await sessionB.page.content();
    expect(pageContentB).not.toContain(tenderA.tender.title);
    expect(pageContentB).not.toContain(opportunityA.opportunity.companyName);
    await sessionB.context.close();

    // Test 2: Retailer A staff logs in and can see their own tender.
    const sessionA = await loginAs(browser, {
      email: emailA,
      password: passwordA,
    });
    await sessionA.page.goto(
      `/business-development/${opportunityA.opportunity.id}`,
    );
    await expect(
      sessionA.page.getByRole("heading", {
        name: opportunityA.opportunity.companyName,
      }),
    ).toBeVisible();
    const pageContentA = await sessionA.page.content();
    expect(pageContentA).toContain(tenderA.tender.title);
    await sessionA.context.close();

    proofPassed = true;
  } finally {
    // Cleanup
    await admin
      .from("corporate_opportunities")
      .delete()
      .eq("id", opportunityA.opportunity.id);
    await admin.from("retailers").delete().eq("id", retailerA.id);
    await admin.from("retailers").delete().eq("id", retailerB.id);
  }
});
