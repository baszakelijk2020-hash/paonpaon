import {
  CorporateRepository,
  createSupabaseAdminClient,
  CustomerRepository,
} from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import {
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
  TEST_RETAILER_SLUG,
} from "./fixtures";
import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "18.5-corporate-wearer-customer-link";
const BROWSER_PROOF_SPEC =
  "apps/retailer/e2e/employee-portal-customer-link.spec.ts";

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
 * Proves the real staff-driven half of PHASE 18.5's linked-customer gap:
 * a manager types an existing customer's email into the "Linked customer
 * account" form on the corporate programme page and the real
 * `setWearerCustomerId` Server Action -> `CorporateRepository` ->
 * `corporate_wearers.customer_id` write actually lands — asserted against
 * the database, not just a UI toast. Also proves the tenant-invariant
 * trigger: an email belonging to a customer at a DIFFERENT retailer is
 * silently not linked (the trigger raises, the Server Action's minimal-
 * feedback shape swallows it exactly like an unmatched email does).
 */
test("a manager links a wearer to a real customer account by email, and cross-tenant linking is refused", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
  const repo = new CorporateRepository(admin);
  const customerRepo = new CustomerRepository(admin);

  const { data: retailer } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");
  const retailerId = asId<"RetailerId">(retailer.id);

  const unique = Date.now();
  const account = await repo.createAccount(retailerId, {
    legalName: `E2E Wearer Link Co ${unique}`,
    accountReference: `E2E-WL-${unique}`,
  });
  const programme = await repo.createProgramme(retailerId, {
    accountId: account.id,
    name: `E2E Wearer Link Programme ${unique}`,
    siteKeys: [],
  });
  const wearer = await repo.createWearer(retailerId, {
    programmeId: programme.id,
    employeeReference: `E2E-WL-EMP-${unique}`,
    displayName: `E2E Wearer Link ${unique}`,
    roleKey: "associate",
    joinedOn: "2025-01-01",
  });
  const customerEmail = `e2e-wearer-link-customer-${unique}@paon.test`;
  const customer = await customerRepo.create({
    retailerId,
    fullName: `E2E Wearer Link Customer ${unique}`,
    email: customerEmail,
    lifecycleStage: "prospect",
  });

  try {
    await page.goto(`/corporate/${programme.id}`);
    await expect(page.locator(`#customerEmail-${wearer.id}`)).toBeVisible();

    const emailInput = page.locator(`#customerEmail-${wearer.id}`);
    await emailInput.fill(customerEmail);
    await page
      .locator(`#customerEmail-${wearer.id}`)
      .locator("xpath=ancestor::form[1]")
      .getByRole("button", { name: "Link customer" })
      .click();

    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from("corporate_wearers")
            .select("customer_id")
            .eq("id", wearer.id)
            .single();
          return data?.customer_id ?? null;
        },
        { timeout: 30_000 },
      )
      .toBe(customer.id);

    await expect(page.getByText(`Linked: ${customer.fullName}`)).toBeVisible({
      timeout: 30_000,
    });

    // Cross-tenant refusal: an email belonging to a customer at a
    // different retailer must never link.
    const { data: otherRetailer } = await admin
      .from("retailers")
      .insert({
        legal_name: `Other House ${unique}`,
        display_name: `Other House ${unique}`,
        slug: `e2e-wearer-link-other-house-${unique}`,
        status: "active",
      })
      .select("id")
      .single();
    if (!otherRetailer) throw new Error("could not seed other retailer");
    const otherCustomerEmail = `e2e-wearer-link-cross-tenant-${unique}@paon.test`;
    await customerRepo.create({
      retailerId: asId<"RetailerId">(otherRetailer.id),
      fullName: `Cross Tenant Customer ${unique}`,
      email: otherCustomerEmail,
      lifecycleStage: "prospect",
    });

    await page.goto(`/corporate/${programme.id}`);
    await page.locator(`#customerEmail-${wearer.id}`).fill(otherCustomerEmail);
    await page
      .locator(`#customerEmail-${wearer.id}`)
      .locator("xpath=ancestor::form[1]")
      .getByRole("button", { name: "Update link" })
      .click();
    await page.waitForLoadState("networkidle");

    const { data: afterCrossTenantAttempt } = await admin
      .from("corporate_wearers")
      .select("customer_id")
      .eq("id", wearer.id)
      .single();
    expect(afterCrossTenantAttempt?.customer_id).toBe(customer.id);

    await admin.from("retailers").delete().eq("id", otherRetailer.id);

    proofPassed = true;
  } finally {
    await admin.from("corporate_accounts").delete().eq("id", account.id);
    await admin.from("customers").delete().eq("id", customer.id);
  }
});
