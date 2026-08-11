import { createSupabaseAdminClient } from "@paon/database";
import { expect, test, type Page } from "@playwright/test";

import { TEST_OWNER_EMAIL, TEST_OWNER_PASSWORD } from "./fixtures";

async function signInOwner(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** PHASE 11.1: real manager UI opens a period, resolves the captured missing
 * punch, versions a correction, and receives an accessible self-approval
 * denial. A separate-manager approval/export is covered by the database
 * invariant; this browser proof intentionally never uses customer records. */
test("manager resolves payroll time exception and a correction creates a successor", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await signInOwner(page);
  const admin = createSupabaseAdminClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
  );
  const { data: owner, error: ownerError } = await admin
    .from("retailer_staff_members")
    .select("id, retailer_id")
    .eq("email", TEST_OWNER_EMAIL)
    .single();
  if (ownerError) throw ownerError;
  const marker = `PAON-PAYROLL-${Date.now()}`;
  const clockInAt = new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString();
  const day = clockInAt.slice(0, 10);
  const { error: entryError } = await admin.from("staff_time_entries").insert({
    retailer_id: owner.retailer_id,
    staff_id: owner.id,
    clock_in_at: clockInAt,
  });
  if (entryError) throw entryError;

  await page.goto("/staff/payroll");
  await expect(
    page.getByRole("heading", { name: "Payroll", exact: true }),
  ).toBeVisible();
  await page.locator("input[name='periodStart']").fill(day);
  await page.locator("input[name='periodEnd']").fill(day);
  await page.getByRole("button", { name: "Open payroll period" }).click();
  await expect(
    page.getByText(/Payroll period opened as version 1/i),
  ).toBeVisible({ timeout: 15_000 });
  const period = page
    .locator("#payroll-periods > *")
    .filter({ hasText: day })
    .first();
  await expect(period.getByText("missing clock out")).toBeVisible();
  await period.getByRole("button", { name: "Resolve exception" }).click();
  await expect(period.getByText("Exception resolved.")).toBeVisible();
  await period
    .locator("textarea[name='reason']")
    .fill(`${marker}: confirmed late close.`);
  await period.getByRole("button", { name: "Correct entry" }).first().click();
  await expect(
    period.getByText(/Correction saved in a new payroll version/i),
  ).toBeVisible();
  await page.reload();
  await expect(period.getByText("Version 2 · draft")).toBeVisible();
  await period.getByRole("button", { name: "Approve period" }).click();
  await expect(
    period.getByRole("alert").filter({ hasText: /different manager/i }),
  ).toBeVisible();
});
