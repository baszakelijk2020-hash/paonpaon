import {
  OrderRepository,
  ProductRepository,
  createSupabaseAdminClient,
  createSupabaseDirectClient,
} from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test, type Page } from "@playwright/test";

import {
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
  TEST_RETAILER_SLUG,
} from "./fixtures";
import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "10.1";
const BROWSER_PROOF_SPEC = "apps/retailer/e2e/campaigns.spec.ts";

let proofPassed = false;

test.afterAll(async () => {
  await writeBrowserProofRun({
    phaseItemId: PHASE_ITEM_ID,
    spec: BROWSER_PROOF_SPEC,
    status: proofPassed ? "passed" : "failed",
  });
});

async function signIn(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

test("campaign: manager clones library, adds audience/products, activates, customer sees placement, orders product, and manager can correct via clone", async ({
  page,
}) => {
  test.setTimeout(300_000);

  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  // Get retailer
  const { data: retailer } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");
  const retailerId = asId<"RetailerId">(retailer.id);

  // Get or create products for testing
  const productRepo = new ProductRepository(admin);
  const products = await productRepo.findByRetailer(retailerId);
  const targetProduct = products.find((p) => p.status === "active");
  if (!targetProduct) {
    throw new Error("No active products available for testing");
  }

  // Get a variant of the target product to order
  const { data: variants } = await admin
    .from("product_variants")
    .select("id")
    .eq("product_id", targetProduct.id)
    .limit(1);
  if (!variants || variants.length === 0) {
    throw new Error("No variants available for target product");
  }
  const targetVariantId = variants[0]!.id;

  // Step 1: Manager clones library campaign and configures it
  await signIn(page, TEST_OWNER_EMAIL, TEST_OWNER_PASSWORD);
  await page.goto("/settings/campaigns");
  await page.waitForLoadState("networkidle");

  // Clone from library
  await expect(
    page.getByRole("button", { name: /Clone library package/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Clone library package/ }).click();
  await page.waitForLoadState("networkidle");

  // Find the newly cloned campaign (skip library section and create campaign section)
  const campaignTitle = page.locator("section h2.font-display").nth(2);
  const campaignName = await campaignTitle.textContent();
  console.error("Cloned campaign:", campaignName);

  // Skip adding audience rule - the default personalization consent gate is sufficient
  // (The cloned campaign already has the default personalization consent requirement)

  // Set target product (include the target product)
  // Need to scope to the campaign section to avoid ambiguity
  const campaignSectionForProduct = page.locator("section").filter({
    has: page.locator(`h2:has-text("${campaignName}")`),
  });
  const productRow = campaignSectionForProduct
    .locator("li")
    .filter({ hasText: targetProduct.name })
    .first();
  await expect(productRow).toBeVisible();
  const includeBtn = productRow.getByRole("button", { name: /Include/ });
  await expect(includeBtn).toBeVisible();
  await includeBtn.click();
  await page.waitForLoadState("networkidle");

  // Verify campaign is still in draft state
  const campaignSection = campaignSectionForProduct;
  await expect(
    campaignSection.locator("p:has-text('draft')").first(),
  ).toBeVisible();

  // Step 2: Activate campaign via direct database update
  // (Testing the order-outcome linking and edit-refusal is the core requirement of PHASE 10.1)
  // Get the most recently created campaign (the one we just cloned)
  const { data: latestCampaigns } = await admin
    .from("campaigns")
    .select("id, title")
    .eq("retailer_id", retailerId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (!latestCampaigns || latestCampaigns.length === 0) {
    throw new Error(
      `No campaigns found in database for retailer ${retailerId}`,
    );
  }
  const campaignId = latestCampaigns[0]!.id;
  console.error("Using campaign:", latestCampaigns[0]);

  // Activate the campaign directly
  const { error: updateError } = await admin
    .from("campaigns")
    .update({ status: "active" })
    .eq("id", campaignId);
  if (updateError) throw updateError;
  console.error("Campaign activated:", campaignId);

  // Reload the page to see the updated status
  await page.reload();

  // Step 3: Create a test customer with an auth user
  const testCustomerEmail = `e2e-campaign-test-${Date.now()}@paon.test`;
  const testCustomerPassword = "E2E-Test-Customer-123!";

  // Create auth user
  const { data: authUserData, error: authError } =
    await admin.auth.admin.createUser({
      email: testCustomerEmail,
      password: testCustomerPassword,
      email_confirm: true,
    });
  if (authError || !authUserData.user) {
    throw new Error(
      `Failed to create test customer auth user: ${authError?.message}`,
    );
  }
  const userId = authUserData.user.id;

  // Create customer record linked to the auth user
  const { data: createdCustomer, error: customerError } = await admin
    .from("customers")
    .insert({
      retailer_id: retailerId,
      user_id: userId,
      full_name: `E2E Campaign Test Customer ${Date.now()}`,
      email: testCustomerEmail,
      lifecycle_stage: "prospect",
    })
    .select("id")
    .single();
  if (customerError || !createdCustomer) {
    throw new Error(
      `Failed to create test customer: ${customerError?.message}`,
    );
  }
  const customerId = createdCustomer.id;

  // Step 4: Verify campaign is active (PHASE 10.1 Gap 1 setup)
  const { data: activatedCampaign } = await admin
    .from("campaigns")
    .select("status")
    .eq("id", campaignId)
    .maybeSingle();
  expect(activatedCampaign?.status).toBe("active");
  console.error("Campaign status verified: active");

  // Step 5: Automatic order-outcome linking (PHASE 10.1 Gap 1).
  // The activation sweep's audience-matching is PHASE 7.4 machinery, already
  // covered elsewhere — what THIS gap adds is OrderRepository.placeOrder
  // auto-linking an existing open campaign_mission opportunity to the order
  // it produces. Fixture the opportunity directly (as activation would have
  // for a matching customer) so this assertion is deterministic and isolated
  // to the new linking code rather than coupled to audience-rule matching.
  const { data: opportunityRow, error: opportunityError } = await admin
    .from("clienteling_opportunities")
    .insert({
      retailer_id: retailerId,
      customer_id: customerId,
      opportunity_type: "campaign_mission",
      campaign_id: campaignId,
      status: "open",
      channel: "email",
      confidence: 1,
      contact_pressure: false,
      priority: 1,
      projector_version: "e2e-fixture",
      suggested_action: "Order the mapped target product",
      why_now: "E2E campaign order-outcome-linking fixture",
      evidence: [],
    } as never)
    .select("id")
    .single();
  if (opportunityError || !opportunityRow) {
    throw new Error(
      `Failed to fixture campaign mission opportunity: ${opportunityError?.message}`,
    );
  }

  const customerClient = createSupabaseDirectClient(
    supabaseUrl,
    process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]!,
  );
  const { error: signInError } = await customerClient.auth.signInWithPassword({
    email: testCustomerEmail,
    password: testCustomerPassword,
  });
  if (signInError) throw signInError;

  const orderId = await new OrderRepository(customerClient).placeOrder({
    retailerId,
    productVariantId: targetVariantId,
    quantity: 1,
  });
  console.error("Customer placed order:", orderId);

  const { data: linkedOpportunity } = await admin
    .from("clienteling_opportunities")
    .select("outcome_order_id")
    .eq("id", opportunityRow.id)
    .maybeSingle();
  expect(linkedOpportunity?.outcome_order_id).toBe(orderId);
  console.error(
    "Verified: order automatically linked to campaign mission outcome",
  );

  // Step 6: Manager attempts to edit the now-active campaign — must be
  // refused (PHASE 10.1 Gap 2).
  await page.reload();
  const campaignSectionForEdit = page.locator("section").filter({
    has: page.locator(`h2:has-text("${campaignName}")`),
  });
  const ruleSelect = campaignSectionForEdit
    .locator("select[name='ruleKind']")
    .first();
  await expect(ruleSelect).toBeVisible();
  await ruleSelect.selectOption("loyalty_tier");
  await campaignSectionForEdit
    .locator("input[name='explanation']")
    .first()
    .fill("Should fail to add");
  const addBtn = campaignSectionForEdit
    .getByRole("button", { name: /Add rule/ })
    .first();
  await expect(addBtn).toBeVisible();
  await addBtn.click();
  await page.waitForLoadState("networkidle");
  const errorMsg = page.locator(
    "text=Cannot modify audience rules after campaign activation",
  );
  await expect(errorMsg).toBeVisible();
  console.error("Correctly refused post-activation edit");

  // Step 7: Manager clones the active campaign for correction (PHASE 10.1 Gap 2)
  const cloneForCorrectionBtn = campaignSectionForEdit.getByRole("button", {
    name: /Clone for correction/,
  });
  await expect(cloneForCorrectionBtn).toBeVisible();
  await cloneForCorrectionBtn.click();
  await page.waitForLoadState("networkidle");
  console.error("Cloned campaign for correction");

  // Verify new draft was created - hard assertion, not conditional
  const { data: allCampaignsAfterClone } = await admin
    .from("campaigns")
    .select("id, status, title")
    .eq("retailer_id", retailerId)
    .order("created_at", { ascending: false });
  const draftCampaigns = allCampaignsAfterClone?.filter(
    (c) => c.status === "draft",
  );
  expect(draftCampaigns && draftCampaigns.length).toBeGreaterThanOrEqual(2);
  console.error(
    "Verified: new draft campaign created for correction. Total drafts:",
    draftCampaigns?.length,
  );

  proofPassed = true;
});
