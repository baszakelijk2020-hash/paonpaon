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

test("module lifecycle projects navigation and suppresses jobs", async ({
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
  const stockNavigation = page.locator(
    'nav[aria-label="Primary"] a[href="/inventory"]',
  );
  await expect(stockNavigation).toBeVisible();
  const previewWriteDate = new Date(
    Date.UTC(2400, 0, 1) + (Date.now() % 20_000) * 86_400_000,
  )
    .toISOString()
    .slice(0, 10);
  const previewCustomerEmail = `module-preview-${Date.now()}@example.test`;
  const previewPlanTitle = `Blocked preview plan ${Date.now()}`;
  const relationshipDependents = [
    "network_ecosystem",
    "enterprise_verticals",
    "wardrobe_styling",
    "commerce_growth",
    "garment_service_operations",
  ] as const;

  try {
    await modules.configure({
      retailerId: retailer!.id,
      moduleKey: "retail_operations",
      state: "suspended",
      authorityMode: "co_managed",
      source: "override",
      reason: "Browser proof suspension",
    });
    await page.reload();

    await expect(stockNavigation).toHaveCount(0);
    await expect(
      page.locator('nav[aria-label="Primary"] a[href="/customers"]'),
    ).toBeVisible();
    await expect(
      modules.jobEnabled({
        retailerId: retailer!.id,
        jobKey: "inventory_drift_monitor",
      }),
    ).resolves.toBe(false);

    await modules.configure({
      retailerId: retailer!.id,
      moduleKey: "retail_operations",
      state: "preview",
      authorityMode: "external",
      source: "add_on",
    });
    await page.reload();
    await expect(stockNavigation).toContainText("Stock · Preview");

    // Preview is real read-only data, not an active module. A direct route or
    // stale tab still carries callable Server Actions, so prove the server
    // boundary refuses the write instead of relying on hidden navigation.
    await page.goto(`/staff/coverage?date=${previewWriteDate}`);
    await page.getByLabel("morning headcount").fill("1");
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          new URL(response.url()).pathname === "/staff/coverage",
      ),
      page.getByRole("button", { name: "Publish coverage" }).click(),
    ]);
    await expect
      .poll(async () => {
        const { count, error } = await admin
          .from("coverage_plans")
          .select("id", { count: "exact", head: true })
          .eq("retailer_id", retailer!.id)
          .eq("plan_date", previewWriteDate);
        expect(error).toBeNull();
        return count ?? 0;
      })
      .toBe(0);

    // Garment/service operations has two downstream families. Contain those
    // first, then exercise both its read-only preview and suspended read gate.
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
      state: "preview",
      authorityMode: "co_managed",
      source: "override",
      reason: "Browser proof garment preview",
    });
    await page.reload();
    await expect(
      page.locator('nav[aria-label="Primary"] a[href="/services"]'),
    ).toContainText("Services · Preview");
    await page.goto("/services");
    await expect(
      page.getByRole("heading", {
        name: "Preferred Tailoring & HighMaintenance",
      }),
    ).toBeVisible();
    await page.getByLabel("Title").fill(previewPlanTitle);
    await page.getByLabel("Summary").fill("Must remain read-only in preview");
    await page
      .getByLabel("Explanation")
      .fill("A stale form cannot activate this module.");
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          new URL(response.url()).pathname === "/services",
      ),
      page.getByRole("button", { name: "Save plan" }).click(),
    ]);
    const { count: planCount, error: planCountError } = await admin
      .from("service_plans")
      .select("id", { count: "exact", head: true })
      .eq("retailer_id", retailer!.id)
      .eq("title", previewPlanTitle);
    expect(planCountError).toBeNull();
    expect(planCount ?? 0).toBe(0);

    await modules.configure({
      retailerId: retailer!.id,
      moduleKey: "garment_service_operations",
      state: "suspended",
      authorityMode: "co_managed",
      source: "override",
      reason: "Browser proof garment read containment",
    });
    const suspendedServiceResponse = await page.goto("/services");
    expect(suspendedServiceResponse?.status()).toBe(500);

    // Relationship Intelligence sits under several active families. Turn
    // those dependants off in dependency-safe order, then prove preview keeps
    // the direct read route useful while the customer Server Action fails
    // closed. This covers stale tabs and forged action requests, not just nav.
    for (const moduleKey of relationshipDependents) {
      await modules.configure({
        retailerId: retailer!.id,
        moduleKey,
        state: "off",
        authorityMode: "co_managed",
        source: "override",
        reason: "Browser proof relationship dependency containment",
      });
    }
    await modules.configure({
      retailerId: retailer!.id,
      moduleKey: "relationship_intelligence",
      state: "preview",
      authorityMode: "co_managed",
      source: "override",
      reason: "Browser proof relationship preview",
    });
    await page.goto("/dashboard");
    await expect(
      page.locator('nav[aria-label="Primary"] a[href="/customers"]'),
    ).toContainText("Clients · Preview");

    await page.goto("/customers/new");
    await expect(
      page.getByRole("heading", { name: "New customer" }),
    ).toBeVisible();
    await page.getByLabel("Full name").fill("Blocked Preview Client");
    await page.getByLabel("Email").fill(previewCustomerEmail);
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          new URL(response.url()).pathname === "/customers/new",
      ),
      page.getByRole("button", { name: "Add client" }).click(),
    ]);
    await expect
      .poll(async () => {
        const { count, error } = await admin
          .from("customers")
          .select("id", { count: "exact", head: true })
          .eq("retailer_id", retailer!.id)
          .eq("email", previewCustomerEmail);
        expect(error).toBeNull();
        return count ?? 0;
      })
      .toBe(0);

    await modules.configure({
      retailerId: retailer!.id,
      moduleKey: "relationship_intelligence",
      state: "suspended",
      authorityMode: "co_managed",
      source: "override",
      reason: "Browser proof relationship read containment",
    });
    const suspendedResponse = await page.goto("/customers/new");
    expect(suspendedResponse?.status()).toBe(500);
    await expect(
      page.getByRole("heading", { name: "New customer" }),
    ).toHaveCount(0);
  } finally {
    await modules.configure({
      retailerId: retailer!.id,
      moduleKey: "relationship_intelligence",
      state: "active",
      authorityMode: "co_managed",
      source: "add_on",
    });
    for (const moduleKey of [
      "wardrobe_styling",
      "commerce_growth",
      "garment_service_operations",
      "enterprise_verticals",
      "network_ecosystem",
    ] as const) {
      await modules.configure({
        retailerId: retailer!.id,
        moduleKey,
        state: "active",
        authorityMode: "co_managed",
        source: "add_on",
      });
    }
    await modules.configure({
      retailerId: retailer!.id,
      moduleKey: "retail_operations",
      state: "active",
      authorityMode: "co_managed",
      source: "add_on",
    });
  }
});
