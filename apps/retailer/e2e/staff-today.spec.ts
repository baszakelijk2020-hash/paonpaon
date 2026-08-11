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

test.describe.configure({ mode: "serial" });

test("a staff member sees their own unified role home", async ({ page }) => {
  test.setTimeout(120_000);

  const admin = createSupabaseAdminClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
  );
  const { data: ownerRow, error: ownerError } = await admin
    .from("retailer_staff_members")
    .select("id, retailer_id")
    .eq("email", TEST_OWNER_EMAIL)
    .single();
  if (ownerError) throw ownerError;

  // Clean state: no closeout for today yet, so the page's "not yet
  // completed" branch is deterministic rather than depending on whatever
  // an earlier test run in this same suite left behind.
  const today = new Date().toISOString().slice(0, 10);
  const { error: deleteCloseoutError } = await admin
    .from("staff_shift_closeouts")
    .delete()
    .eq("retailer_id", ownerRow.retailer_id)
    .eq("staff_id", ownerRow.id)
    .eq("closeout_date", today);
  if (deleteCloseoutError) throw deleteCloseoutError;

  // A service-role write from this process (the test) is, on this local
  // stack, sometimes briefly invisible to an immediate read from a
  // different process (the Next.js server) — the same timing quirk
  // PHASE 12.2's own status text already documented and worked around
  // with expect.poll. Confirm the delete is actually visible before
  // navigating, rather than fighting it from inside the page.
  await expect
    .poll(
      async () => {
        const { count } = await admin
          .from("staff_shift_closeouts")
          .select("id", { count: "exact", head: true })
          .eq("retailer_id", ownerRow.retailer_id)
          .eq("staff_id", ownerRow.id)
          .eq("closeout_date", today);
        return count ?? 0;
      },
      { timeout: 15_000 },
    )
    .toBe(0);

  await signInOwner(page);
  await page.goto("/staff/today");

  await expect(
    page.getByRole("heading", { name: "My Day", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Shift & Clock Status")).toBeVisible();
  await expect(page.getByText("Shift Closeout")).toBeVisible();

  // Deterministic: we just deleted today's closeout, so this must show
  // the not-yet-completed state with a link to /staff/closeout.
  await expect(page.getByText("Not yet completed")).toBeVisible();
  const closeoutLink = page.getByRole("link", { name: /Close out/ });
  await expect(closeoutLink).toBeVisible();

  // The link genuinely navigates, not just renders text that looks right.
  await closeoutLink.click();
  await expect(page).toHaveURL(/\/staff\/closeout$/);
});

test("a completed closeout shows on the role home instead of the prompt", async ({
  page,
}) => {
  test.setTimeout(120_000);

  const admin = createSupabaseAdminClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
  );
  const { data: ownerRow, error: ownerError } = await admin
    .from("retailer_staff_members")
    .select("id, retailer_id")
    .eq("email", TEST_OWNER_EMAIL)
    .single();
  if (ownerError) throw ownerError;

  const today = new Date().toISOString().slice(0, 10);
  const marker = `PAON-TODAY-${Date.now()}`;
  const promisesText = `Follow up with two waitlisted clients. ${marker}`;
  const whatWorkedText = `Fitting room turnover was fast today. ${marker}`;

  const { error: closeoutError } = await admin
    .from("staff_shift_closeouts")
    .upsert(
      {
        retailer_id: ownerRow.retailer_id,
        staff_id: ownerRow.id,
        closeout_date: today,
        promises_note: promisesText,
        what_worked_note: whatWorkedText,
      },
      { onConflict: "retailer_id,staff_id,closeout_date" },
    );
  if (closeoutError) throw closeoutError;

  await signInOwner(page);
  await page.goto("/staff/today");

  await expect(page.getByText("Closeout submitted")).toBeVisible();
  await expect(page.getByText(promisesText)).toBeVisible();
  await expect(page.getByText(whatWorkedText)).toBeVisible();
  // The not-yet-completed prompt must NOT also be showing.
  await expect(page.getByText("Not yet completed")).not.toBeVisible();
});
