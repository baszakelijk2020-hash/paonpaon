import { createSupabaseAdminClient } from "@paon/database";
import { expect, test, type Page } from "@playwright/test";

import {
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
  TEST_RETAILER_SLUG,
} from "./fixtures";

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
  const { data: retailer, error: retailerError } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (retailerError) throw retailerError;
  const { data: owner, error: ownerError } = await admin
    .from("retailer_staff_members")
    .select("id, retailer_id")
    .eq("email", TEST_OWNER_EMAIL)
    .eq("retailer_id", retailer.id)
    .is("deleted_at", null)
    .single();
  if (ownerError) throw ownerError;
  const { data: staleEntries, error: staleEntriesError } = await admin
    .from("staff_time_entries")
    .select("id, clock_in_at")
    .eq("retailer_id", owner.retailer_id)
    .eq("staff_id", owner.id)
    .is("clock_out_at", null);
  if (staleEntriesError) throw staleEntriesError;
  for (const entry of staleEntries) {
    const { error: closeStaleEntryError } = await admin
      .from("staff_time_entries")
      .update({
        clock_out_at: new Date(
          Date.parse(entry.clock_in_at) + 60 * 1_000,
        ).toISOString(),
      })
      .eq("id", entry.id)
      .eq("retailer_id", owner.retailer_id)
      .eq("staff_id", owner.id)
      .is("clock_out_at", null);
    if (closeStaleEntryError) throw closeStaleEntryError;
  }
  const marker = `PAON-PAYROLL-${Date.now()}`;
  const periodDay = new Date(
    Date.now() - (31 + Math.floor(Math.random() * 300)) * 86_400_000,
  );
  periodDay.setUTCHours(9, 0, 0, 0);
  const clockInAt = periodDay.toISOString();
  const clockOutAt = new Date(Date.parse(clockInAt) + 8 * 60 * 60 * 1_000)
    .toISOString()
    .slice(0, 16);
  const day = clockInAt.slice(0, 10);
  const { data: entry, error: entryError } = await admin
    .from("staff_time_entries")
    .insert({
      retailer_id: owner.retailer_id,
      staff_id: owner.id,
      clock_in_at: clockInAt,
    })
    .select("id")
    .single();
  if (entryError) throw entryError;

  let cleanupError: Error | null = null;

  try {
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
    await expect(period.getByText("resolved", { exact: true })).toBeVisible();
    await period
      .locator("textarea[name='reason']")
      .fill(`${marker}: confirmed late close.`);
    await period.locator("input[name='clockOutAt']").fill(clockOutAt);
    await period.getByRole("button", { name: "Correct entry" }).first().click();
    await expect(period.getByText("Version 2 · draft")).toBeVisible();
    await period.getByRole("button", { name: "Approve period" }).click();
    await expect(
      period.getByRole("alert").filter({ hasText: /different manager/i }),
    ).toBeVisible();
  } finally {
    const { error: closeSourceEntryError } = await admin
      .from("staff_time_entries")
      .update({ clock_out_at: new Date(clockOutAt).toISOString() })
      .eq("id", entry.id)
      .eq("retailer_id", owner.retailer_id)
      .eq("staff_id", owner.id)
      .is("clock_out_at", null);
    cleanupError = closeSourceEntryError;
  }

  if (cleanupError) throw cleanupError;
});
