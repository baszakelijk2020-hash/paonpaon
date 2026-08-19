import {
  ClientelingRepository,
  CustomerRepository,
  PlatformModuleRepository,
  RetailerRepository,
  RetailerStaffRepository,
  createSupabaseAdminClient,
} from "@paon/database";
import { PLATFORM_MODULES, type RetailerId } from "@paon/domain";
import { expect, test, type Browser } from "@playwright/test";

import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "R0.7";
const BROWSER_PROOF_SPEC = "apps/retailer/e2e/customer-access-boundary.spec.ts";
const PROTECTED_NOTE = "PROTECTED-NOTE-CONTENT";
const SHARED_NOTE = "SHARED-NOTE-CONTENT";
const RAW_PHONE = "+1 555 234 5238";
const MASKED_PHONE = "+1 ••• ••• 238";

let proofPassed = false;

// A fresh retailer starts with zero active modules (production retailers
// receive them through plans/add-ons) — the customer detail page composes
// several module-gated repositories, so this spec's Houses activate the
// full platform, same as the shared e2e fixture retailers in
// global-setup.ts.
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

test.afterAll(async () => {
  await writeBrowserProofRun({
    phaseItemId: PHASE_ITEM_ID,
    spec: BROWSER_PROOF_SPEC,
    status: proofPassed ? "passed" : "failed",
  });
});

/**
 * ADR-074 Slice 1 — real browser proof, own retailer(s) per run (this
 * seeds cross-staff assignment/visibility state that must not race with
 * other specs running in parallel, same isolation reasoning as
 * accept-invite.spec.ts).
 */
async function provisionHouseWithBoundaryFixture() {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "customer-access-boundary.spec.ts requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
  const unique = Date.now();

  const retailer = await new RetailerRepository(admin).create({
    legalName: `E2E Access Boundary ${unique}, Inc.`,
    displayName: `E2E Access Boundary ${unique}`,
    slug: `e2e-access-boundary-${unique}`,
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
    .eq("id", retailer.id);
  await activateAllModules(admin, retailer.id);

  async function createStaff(label: string) {
    const email = `e2e-access-${label}-${unique}@paon.test`;
    const password = "E2E-access-password-789!";
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user) {
      throw new Error(
        `Failed to create ${label} user: ${error?.message ?? "unknown error"}`,
      );
    }
    const staff = await new RetailerStaffRepository(admin).create({
      retailerId: retailer.id,
      userId: data.user.id as never,
      fullName: `E2E ${label}`,
      email,
      role: "sales_associate",
    });
    // Fixture-only: force straight to "accepted" — see global-setup.ts for
    // why a service-role client cannot legitimately call
    // accept_retailer_staff_invite itself (no auth.uid() to satisfy its
    // own-record check).
    await admin
      .from("retailer_staff_members")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", staff.id);
    return { email, password, staff };
  }

  const assignedAdvisor = await createStaff("assigned-advisor");
  const unassignedAssociate = await createStaff("unassigned-associate");

  const customer = await new CustomerRepository(admin).create({
    retailerId: retailer.id,
    fullName: `E2E Boundary Client ${unique}`,
    email: `e2e-boundary-client-${unique}@paon.test`,
    phone: RAW_PHONE,
    lifecycleStage: "prospect",
    assignedStaffId: assignedAdvisor.staff.id,
  });

  const clienteling = new ClientelingRepository(admin);
  await clienteling.create({
    retailerId: retailer.id,
    customerId: customer.id,
    authorStaffId: assignedAdvisor.staff.id,
    body: PROTECTED_NOTE,
    pinned: false,
    visibility: "assigned_advisor",
  });
  await clienteling.create({
    retailerId: retailer.id,
    customerId: customer.id,
    authorStaffId: assignedAdvisor.staff.id,
    body: SHARED_NOTE,
    pinned: false,
    visibility: "retailer_shared",
  });

  return { admin, retailer, customer, assignedAdvisor, unassignedAssociate };
}

async function provisionOtherHouseStaff() {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
  const unique = Date.now();

  const otherRetailer = await new RetailerRepository(admin).create({
    legalName: `E2E Other House ${unique}, Inc.`,
    displayName: `E2E Other House ${unique}`,
    slug: `e2e-other-house-${unique}`,
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
    .eq("id", otherRetailer.id);
  await activateAllModules(admin, otherRetailer.id);

  const email = `e2e-other-house-staff-${unique}@paon.test`;
  const password = "E2E-access-password-789!";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(
      `Failed to create other-House user: ${error?.message ?? "unknown error"}`,
    );
  }
  const staff = await new RetailerStaffRepository(admin).create({
    retailerId: otherRetailer.id,
    userId: data.user.id as never,
    fullName: "E2E Other House Staff",
    email,
    role: "sales_associate",
  });
  await admin
    .from("retailer_staff_members")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", staff.id);

  return { email, password };
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

test("assigned advisor reads full relationship intelligence; an unassigned associate and a different House are both refused it", async ({
  browser,
}) => {
  const { customer, assignedAdvisor, unassignedAssociate } =
    await provisionHouseWithBoundaryFixture();

  // Scenario A — the assigned advisor sees everything: raw phone, both
  // note tiers.
  const advisorSession = await loginAs(browser, assignedAdvisor);
  await advisorSession.page.goto(`/customers/${customer.id}`);
  await expect(advisorSession.page.getByText(RAW_PHONE)).toBeVisible();
  await expect(advisorSession.page.getByText(PROTECTED_NOTE)).toBeVisible();
  await expect(advisorSession.page.getByText(SHARED_NOTE)).toBeVisible();
  await advisorSession.context.close();

  // Scenario B — an unassigned, non-management associate at the SAME
  // House opens the same customer: the assigned_advisor-tier note and
  // the raw contact value must both be absent; the retailer_shared note
  // and the masked contact form must both still be present (minimal
  // operational identity stays visible, ADR-074's own stated
  // consequence).
  const unassignedSession = await loginAs(browser, unassignedAssociate);
  await unassignedSession.page.goto(`/customers/${customer.id}`);
  const detailBody = await unassignedSession.page.content();
  expect(detailBody).not.toContain(PROTECTED_NOTE);
  expect(detailBody).not.toContain(RAW_PHONE);
  expect(detailBody).toContain(SHARED_NOTE);
  await expect(unassignedSession.page.getByText(MASKED_PHONE)).toBeVisible();

  // Scenario C — the same unassigned associate's /customers list also
  // never renders the raw phone, only the masked form.
  await unassignedSession.page.goto("/customers");
  const listBody = await unassignedSession.page.content();
  expect(listBody).not.toContain(RAW_PHONE);
  expect(listBody).toContain(MASKED_PHONE);
  await unassignedSession.context.close();

  // Scenario D — cross-retailer denial: a staff member at a completely
  // different House cannot reach this customer's detail page at all.
  // `CustomerRepository.findById` runs on the request-scoped (RLS-bound)
  // client, so the RLS-filtered null triggers `notFound()`. Asserting on
  // the rendered "404 / This page could not be found" heading rather than
  // the HTTP status code: this app's nested dynamic route under a layout
  // that has already begun streaming keeps the response status at 200
  // even once `notFound()` fires deeper in the tree — a Next.js App
  // Router streaming characteristic, not a data leak (confirmed no
  // customer content of any kind reaches the response body below).
  const otherHouseStaff = await provisionOtherHouseStaff();
  const otherSession = await loginAs(browser, otherHouseStaff);
  await otherSession.page.goto(`/customers/${customer.id}`);
  await expect(
    otherSession.page.getByRole("heading", { name: "404" }),
  ).toBeVisible();
  const otherBody = await otherSession.page.content();
  expect(otherBody).not.toContain(RAW_PHONE);
  expect(otherBody).not.toContain(PROTECTED_NOTE);
  expect(otherBody).not.toContain(SHARED_NOTE);
  await otherSession.context.close();

  proofPassed = true;
});
