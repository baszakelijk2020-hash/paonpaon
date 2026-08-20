import {
  PlatformModuleRepository,
  RetailerRepository,
  createSupabaseAdminClient,
} from "@paon/database";
import { expect, test } from "@playwright/test";

import {
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
  TEST_RETAILER_SLUG,
} from "./fixtures";
import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "19.1";
const BROWSER_PROOF_SPEC = "apps/retailer/e2e/route-gating.spec.ts";

let proofPassed = false;

test.afterAll(async () => {
  await writeBrowserProofRun({
    phaseItemId: PHASE_ITEM_ID,
    spec: BROWSER_PROOF_SPEC,
    status: proofPassed ? "passed" : "failed",
  });
});

test("route gating: production and fabric-pairing blocked when garment_service_operations is off, concepts always blocked", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  // Sign in
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // Get retailer and module repository
  const retailer = await new RetailerRepository(admin).findBySlug(
    TEST_RETAILER_SLUG,
  );
  expect(retailer).not.toBeNull();
  const modules = new PlatformModuleRepository(admin);

  // Test 1: Block /production when garment_service_operations is off
  // First, disable downstream dependencies that require garment_service_operations
  for (const moduleKey of [
    "network_ecosystem",
    "enterprise_verticals",
  ] as const) {
    await modules.configure({
      retailerId: retailer!.id,
      moduleKey,
      state: "off",
      authorityMode: "co_managed",
      source: "override",
      reason: "Test route gating - disable downstream dependencies",
    });
  }

  // Now turn off garment_service_operations
  await modules.configure({
    retailerId: retailer!.id,
    moduleKey: "garment_service_operations",
    state: "off",
    authorityMode: "co_managed",
    source: "override",
    reason: "Test route gating - production",
  });
  await page.reload();

  const productionOffResponse = await page.goto("/production");
  expect(productionOffResponse?.status()).toBe(500);

  // Test 2: Allow /production when garment_service_operations is active
  await modules.configure({
    retailerId: retailer!.id,
    moduleKey: "garment_service_operations",
    state: "active",
    authorityMode: "co_managed",
    source: "override",
    reason: "Test route gating - production active",
  });
  await page.reload();

  const productionActiveResponse = await page.goto("/production");
  expect(productionActiveResponse?.status()).toBe(200);

  // Test 3: Block /fabric-pairing when garment_service_operations is off
  await modules.configure({
    retailerId: retailer!.id,
    moduleKey: "garment_service_operations",
    state: "off",
    authorityMode: "co_managed",
    source: "override",
    reason: "Test route gating - fabric-pairing",
  });
  await page.reload();

  const fabricPairingOffResponse = await page.goto("/fabric-pairing");
  expect(fabricPairingOffResponse?.status()).toBe(500);

  // Test 4: Allow /fabric-pairing when garment_service_operations is active
  await modules.configure({
    retailerId: retailer!.id,
    moduleKey: "garment_service_operations",
    state: "active",
    authorityMode: "co_managed",
    source: "override",
    reason: "Test route gating - fabric-pairing active",
  });
  await page.reload();

  const fabricPairingActiveResponse = await page.goto("/fabric-pairing");
  expect(fabricPairingActiveResponse?.status()).toBe(200);

  // Test 5: /concepts is always blocked, even with wardrobe_styling active
  await modules.configure({
    retailerId: retailer!.id,
    moduleKey: "wardrobe_styling",
    state: "active",
    authorityMode: "co_managed",
    source: "override",
    reason: "Test route gating - concepts with wardrobe_styling active",
  });
  await page.reload();

  const conceptsResponse = await page.goto("/concepts");
  expect(conceptsResponse?.status()).toBe(404);

  proofPassed = true;
});
