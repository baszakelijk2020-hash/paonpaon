import {
  CorporateOpportunityRepository,
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

const PHASE_ITEM_ID = "18.1";
const BROWSER_PROOF_SPEC = "apps/retailer/e2e/business-development.spec.ts";

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

/**
 * Proves tenant isolation (ADR-003) for corporate opportunities: a staff member
 * at retailer B cannot access opportunities authored by retailer A, even with
 * direct API access — RLS filters the request to zero rows, triggering a
 * 404. The correct tenant's request succeeds and sees the opportunity.
 */
test("cross-tenant opportunity access is denied by RLS; same-tenant access succeeds", async ({
  browser,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
  const unique = Date.now();

  // Retailer A: create it with staff and an opportunity
  const retailerA = await new RetailerRepository(admin).create({
    legalName: `E2E Opportunity Isolation A ${unique}, Inc.`,
    displayName: `E2E Opportunity Isolation A ${unique}`,
    slug: `e2e-opp-iso-a-${unique}`,
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

  const emailA = `e2e-opp-iso-a-staff-${unique}@paon.test`;
  const passwordA = "E2E-opportunity-isolation-password-789!";
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
    fullName: "E2E Opportunity Isolation A Staff",
    email: emailA,
    role: "manager",
  });
  await admin
    .from("retailer_staff_members")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", staffA.id);

  // Create an opportunity for Retailer A
  const opportunityA = await new CorporateOpportunityRepository(admin).create({
    retailerId: retailerA.id,
    companyName: `E2E Isolation Test Company A ${unique}`,
  });
  if (!opportunityA.ok) throw new Error("failed to create opportunity A");

  // Retailer B: create it with different staff
  const retailerB = await new RetailerRepository(admin).create({
    legalName: `E2E Opportunity Isolation B ${unique}, Inc.`,
    displayName: `E2E Opportunity Isolation B ${unique}`,
    slug: `e2e-opp-iso-b-${unique}`,
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

  const emailB = `e2e-opp-iso-b-staff-${unique}@paon.test`;
  const passwordB = "E2E-opportunity-isolation-password-789!";
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
    fullName: "E2E Opportunity Isolation B Staff",
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
    expect(pageContentB).not.toContain(opportunityA.opportunity.companyName);
    await sessionB.context.close();

    // Test 2: Retailer A staff logs in and can see their own opportunity.
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
    await sessionA.context.close();
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
