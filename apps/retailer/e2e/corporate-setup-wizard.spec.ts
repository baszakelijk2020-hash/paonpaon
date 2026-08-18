import { createSupabaseAdminClient } from "@paon/database";
import { expect, test } from "@playwright/test";

import { TEST_OWNER_EMAIL, TEST_OWNER_PASSWORD } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

/**
 * corporate setup wizard — proves a non-technical account manager can build a
 * whole corporate programme (account, roles/entitlements, employees) through
 * the guided UI alone, and that the review step's readiness banner reflects
 * state computed live from the same domain functions the programme detail
 * page uses.
 */
test("corporate setup wizard: owner builds a programme end to end", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  const unique = Date.now();
  const legalName = `E2E Wizard Client ${unique}`;
  const accountReference = `E2E-WIZ-${unique}`;
  const programmeName = `E2E Wizard Programme ${unique}`;
  let accountId: string | undefined;

  try {
    await page.goto("/corporate/setup-wizard");
    await expect(
      page.getByRole("heading", { name: "Set up a new corporate programme" }),
    ).toBeVisible();

    await page.getByText("Create a new account").click();
    await page.getByLabel("Legal name").fill(legalName);
    await page.getByLabel("Account reference").fill(accountReference);
    await page.getByLabel("Programme name").fill(programmeName);
    await page
      .getByLabel("Departments or sites (optional, comma-separated)")
      .fill("Warehouse");
    await page.getByRole("button", { name: "Continue to roles" }).click();

    await expect(page).toHaveURL(/\/corporate\/setup-wizard\/.+\?step=roles/);
    const programmeId = new URL(page.url()).pathname.split("/").pop()!;

    const { data: account } = await admin
      .from("corporate_accounts")
      .select("id")
      .eq("account_reference", accountReference)
      .single();
    accountId = account?.id;

    await page.getByLabel("Role").fill("Warehouse Associate — Permanent");
    await page.getByLabel("Garment").fill("jacket");
    await page.getByLabel("Quantity").fill("2");
    await page.getByLabel("Period").selectOption("annual");
    await page
      .getByRole("button", { name: /Save roles and entitlements/ })
      .click();

    await expect(page).toHaveURL(
      /\/corporate\/setup-wizard\/.+\?step=employees/,
    );

    const employeeName = `E2E Wizard Employee ${unique}`;
    await page.getByLabel("Full name").fill(employeeName);
    await page.getByLabel("Employee reference").fill(`E2E-EMP-${unique}`);
    await page
      .getByLabel("Role")
      .selectOption("Warehouse Associate — Permanent");
    await page.getByLabel("Department or site").selectOption("Warehouse");
    await page.getByRole("button", { name: "Add employee" }).click();

    await expect(page.getByText(employeeName).first()).toBeVisible();

    await page.getByRole("link", { name: "Continue to review →" }).click();
    await expect(page).toHaveURL(/\/corporate\/setup-wizard\/.+\?step=review/);

    await expect(page.getByText("1 wearer")).toBeVisible();
    await expect(page.getByText("0 issued at least one garment")).toBeVisible();
    await expect(page.getByText(`Not started: ${employeeName}`)).toBeVisible();

    await page
      .getByRole("link", { name: "Finish setup — go to programme →" })
      .click();
    await expect(page).toHaveURL(`/corporate/${programmeId}`);
    await expect(
      page.getByRole("heading", { name: programmeName }),
    ).toBeVisible();
    await expect(page.getByText(employeeName).first()).toBeVisible();
  } finally {
    if (accountId) {
      await admin.from("corporate_accounts").delete().eq("id", accountId);
    }
  }
});
