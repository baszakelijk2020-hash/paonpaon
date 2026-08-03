import { CorporateRepository, createSupabaseAdminClient } from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import {
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
  TEST_RETAILER_SLUG,
} from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

/**
 * Proves the retailer-staff Métier workspace end to end against its own
 * disposable fixture data: entitlement balances are really computed (not
 * just displayed), issuing a garment really consumes the balance, and an
 * exception really moves from open to resolved.
 */
test("retailer staff view entitlement balances, issue a garment, and resolve an exception", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
  const repo = new CorporateRepository(admin);

  const { data: retailer } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");
  const retailerId = asId<"RetailerId">(retailer.id);

  const unique = Date.now();
  const account = await repo.createAccount(retailerId, {
    legalName: "E2E Corporate Client",
    accountReference: `E2E-CORP-${unique}`,
  });
  const programme = await repo.createProgramme(retailerId, {
    accountId: account.id,
    name: `E2E Wardrobe Programme ${unique}`,
    siteKeys: [],
  });
  await repo.createEntitlementVersion(retailerId, {
    programmeId: programme.id,
    effectiveFrom: "2026-01-01",
    rules: [
      {
        roleKey: "associate",
        garmentKey: "suit",
        quantity: 2,
        period: "annual",
      },
    ],
  });
  await repo.createWearer(retailerId, {
    programmeId: programme.id,
    employeeReference: "E2E-1",
    displayName: "E2E Wearer",
    roleKey: "associate",
    joinedOn: "2025-01-01",
  });

  try {
    await page.goto(`/corporate/${programme.id}`);
    await expect(
      page.getByRole("heading", { name: programme.name }),
    ).toBeVisible();

    const wearerRow = page.locator("li", { hasText: "E2E Wearer" }).first();
    await expect(wearerRow.getByText("suit: 2/2 left")).toBeVisible();

    await wearerRow.locator("select[name=garmentKey]").selectOption("suit");
    await wearerRow.locator("input[name=quantity]").fill("1");
    await wearerRow.getByRole("button", { name: "Issue" }).click();
    await expect(wearerRow.getByText("suit: 1/2 left")).toBeVisible();

    const detail = `E2E exception ${unique}`;
    await page.getByText("Log an exception").click();
    await page.getByLabel("Kind").selectOption("fit_issue");
    await page.getByLabel("Detail").fill(detail);
    await page.getByRole("button", { name: "Log exception" }).click();

    const exceptionRow = page.locator("li", { hasText: detail });
    await expect(exceptionRow).toBeVisible();
    await exceptionRow.getByRole("button", { name: "Resolve" }).click();
    await expect(exceptionRow.getByText("Resolved")).toBeVisible();
  } finally {
    // Cascades through programme -> entitlement versions/wearers/exceptions
    // -> issue records (see 20260801000012's FKs).
    await admin.from("corporate_accounts").delete().eq("id", account.id);
  }
});
