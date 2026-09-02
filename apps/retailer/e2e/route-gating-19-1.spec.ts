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

test("route gating for production, fabric-pairing (garment_service_operations), and concepts (deleted FT-03)", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
  const retailer = await new RetailerRepository(admin).findBySlug(
    TEST_RETAILER_SLUG,
  );
  expect(retailer).not.toBeNull();
  const modules = new PlatformModuleRepository(admin);

  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  try {
    // Test 1: /production and /fabric-pairing are accessible when
    // garment_service_operations is active (the expected state).
    // This is the positive baseline.
    let response = await page.goto("/production");
    expect(response?.status()).toBe(200);

    response = await page.goto("/fabric-pairing");
    expect(response?.status()).toBe(200);

    // Test 2: Turn off garment_service_operations and verify both routes
    // are now refused (500 status, same as module-navigation.spec.ts pattern).
    // First, turn off the downstream modules that depend on garment_service_operations.
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
        reason: "Browser proof garment dependency containment",
      });
    }

    await modules.configure({
      retailerId: retailer!.id,
      moduleKey: "garment_service_operations",
      state: "suspended",
      authorityMode: "co_managed",
      source: "override",
      reason: "Browser proof garment suspension",
    });
    await page.reload();

    response = await page.goto("/production");
    expect(response?.status()).toBe(500);

    response = await page.goto("/fabric-pairing");
    expect(response?.status()).toBe(500);

    // Test 3: /concepts is unconditionally blocked regardless of module state.
    // Even though wardrobe_styling is active, FT-03 (deleted tool) must not
    // become reachable. This tests the notFound() unconditional block.
    response = await page.goto("/concepts");
    expect(response?.status()).toBe(404);

    // Verify it stays blocked even after reactivating a related module.
    // The point is: a deleted route's block is not dependent on any module state.
    await modules.configure({
      retailerId: retailer!.id,
      moduleKey: "wardrobe_styling",
      state: "active",
      authorityMode: "co_managed",
      source: "add_on",
    });
    await page.reload();

    response = await page.goto("/concepts");
    expect(response?.status()).toBe(404);

    // Turn garment_service_operations back on to confirm /production and
    // /fabric-pairing are accessible again.
    await modules.configure({
      retailerId: retailer!.id,
      moduleKey: "garment_service_operations",
      state: "active",
      authorityMode: "co_managed",
      source: "add_on",
    });
    await page.reload();

    response = await page.goto("/production");
    expect(response?.status()).toBe(200);

    response = await page.goto("/fabric-pairing");
    expect(response?.status()).toBe(200);

    // /concepts remains blocked (deleted forever).
    response = await page.goto("/concepts");
    expect(response?.status()).toBe(404);
  } finally {
    // Restore to clean state
    for (const moduleKey of [
      "garment_service_operations",
      "network_ecosystem",
      "enterprise_verticals",
      "wardrobe_styling",
    ] as const) {
      await modules.configure({
        retailerId: retailer!.id,
        moduleKey,
        state: "active",
        authorityMode: "co_managed",
        source: "add_on",
      });
    }
  }
});
