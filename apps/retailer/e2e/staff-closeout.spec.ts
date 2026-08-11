import { createSupabaseAdminClient } from "@paon/database";
import { expect, test, type Page } from "@playwright/test";

import { TEST_OWNER_EMAIL, TEST_OWNER_PASSWORD } from "./fixtures";

/**
 * A second staff member for testing: same reason as in staff-recognition.spec.ts,
 * the owner needs a colleague to close out to see in the manager view.
 */
const COLLEAGUE_EMAIL = "e2e-closeout-colleague@paon.test";
const COLLEAGUE_NAME = "E2E Closeout Colleague";

async function ensureColleague(retailerId: string): Promise<string> {
  const admin = createSupabaseAdminClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
  );
  const { data: existing } = await admin
    .from("retailer_staff_members")
    .select("id")
    .eq("retailer_id", retailerId)
    .eq("email", COLLEAGUE_EMAIL)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: newMember, error } = await admin
    .from("retailer_staff_members")
    .insert({
      retailer_id: retailerId,
      user_id: null,
      full_name: COLLEAGUE_NAME,
      email: COLLEAGUE_EMAIL,
      role: "sales_associate",
      accepted_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  return newMember.id;
}

async function signInOwner(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test("a shift closeout is submitted, persists on revisit, and manager sees it", async ({
  page,
}) => {
  test.setTimeout(180_000);

  await signInOwner(page);

  const admin = createSupabaseAdminClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
  );
  const { data: ownerRow, error: ownerError } = await admin
    .from("retailer_staff_members")
    .select("retailer_id")
    .eq("email", TEST_OWNER_EMAIL)
    .single();
  if (ownerError) throw ownerError;

  const colleagueId = await ensureColleague(ownerRow.retailer_id);

  await page.goto("/staff/closeout");
  await expect(
    page.getByRole("heading", { name: "Shift Closeout", exact: true }),
  ).toBeVisible();

  const marker = `PAON-CLOSEOUT-${Date.now()}`;

  // 1. Submit a closeout with just the two required fields.
  const promisesText = `Call back three clients about sales event. ${marker}`;
  const whatWorkedText = `Morning stock audit caught a discrepancy before inventory opened. ${marker}`;

  await page.locator("textarea[name='promisesNote']").fill(promisesText);
  await page.locator("textarea[name='whatWorkedNote']").fill(whatWorkedText);
  await page.getByRole("button", { name: "Save closeout" }).click();
  await expect(page.getByText(/Shift closeout saved/i)).toBeVisible({
    timeout: 15_000,
  });

  // 2. Reload and verify the closeout persists (upsert works).
  await page.reload();
  const promisesField = page.locator("textarea[name='promisesNote']");
  await expect(promisesField).toHaveValue(promisesText);
  const whatWorkedField = page.locator("textarea[name='whatWorkedNote']");
  await expect(whatWorkedField).toHaveValue(whatWorkedText);

  // 3. As a manager, submit a closeout for the colleague first (via direct API
  // call to avoid another login flow) so we can test the manager view.
  const today = new Date().toISOString().slice(0, 10);
  const { error: colleagueCloseoutError } = await admin
    .from("staff_shift_closeouts")
    .upsert(
      {
        retailer_id: ownerRow.retailer_id,
        staff_id: colleagueId,
        closeout_date: today,
        promises_note: `Help train new associate on point-of-sale system. ${marker}`,
        what_worked_note: `Strong customer engagement during afternoon rush. ${marker}`,
      },
      {
        onConflict: "retailer_id,staff_id,closeout_date",
      },
    );
  if (colleagueCloseoutError) throw colleagueCloseoutError;

  // 4. Reload the closeout page and verify the manager sees both closeouts
  // in the team view (the owner's own and the colleague's).
  await page.reload();
  const teamCloseouts = page.locator("#team-closeouts li");
  await expect(teamCloseouts.first()).toBeVisible();

  // The owner's closeout should be visible
  const ownerCloseout = teamCloseouts.filter({
    hasText: promisesText,
  });
  await expect(ownerCloseout).toBeVisible();

  // The colleague's closeout should also be visible
  const colleagueCloseout = teamCloseouts.filter({
    hasText: `Help train new associate on point-of-sale system`,
  });
  await expect(colleagueCloseout).toBeVisible();

  // 5. Updating a closeout (upsert on conflict) must work: change one field
  // and resubmit the same day.
  const updatedPromises = `Call back three clients. Called two so far. ${marker}`;
  await page.locator("textarea[name='promisesNote']").fill(updatedPromises);
  await page.getByRole("button", { name: "Save closeout" }).click();
  await expect(page.getByText(/Shift closeout saved/i)).toBeVisible({
    timeout: 15_000,
  });

  await page.reload();
  const updatedField = page.locator("textarea[name='promisesNote']");
  await expect(updatedField).toHaveValue(updatedPromises);
});
