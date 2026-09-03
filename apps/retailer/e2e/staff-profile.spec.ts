import { createSupabaseAdminClient } from "@paon/database";
import { expect, test, type Page } from "@playwright/test";

import { TEST_OWNER_EMAIL, TEST_OWNER_PASSWORD } from "./fixtures";

const REVIEWER_EMAIL = "e2e-staff-profile-reviewer@paon.test";
const REVIEWER_NAME = "E2E Profile Reviewer";

async function signInOwner(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test("a staff member can read their own closeout and reviewed recognition evidence", async ({
  page,
}) => {
  test.setTimeout(120_000);

  const admin = createSupabaseAdminClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
  );
  const { data: owner, error: ownerError } = await admin
    .from("retailer_staff_members")
    .select("id, retailer_id, full_name, role")
    .eq("email", TEST_OWNER_EMAIL)
    .single();
  if (ownerError) throw ownerError;

  const { data: existingReviewer, error: reviewerLookupError } = await admin
    .from("retailer_staff_members")
    .select("id")
    .eq("retailer_id", owner.retailer_id)
    .eq("email", REVIEWER_EMAIL)
    .maybeSingle();
  if (reviewerLookupError) throw reviewerLookupError;

  const createdReviewer = existingReviewer
    ? null
    : await admin
        .from("retailer_staff_members")
        .insert({
          retailer_id: owner.retailer_id,
          user_id: null,
          full_name: REVIEWER_NAME,
          email: REVIEWER_EMAIL,
          role: "manager",
          accepted_at: new Date().toISOString(),
        })
        .select("id")
        .single();
  if (createdReviewer?.error) throw createdReviewer.error;
  const reviewer = existingReviewer ?? createdReviewer?.data;
  if (!reviewer) throw new Error("Profile reviewer fixture was not created");

  const marker = `PAON-STAFF-PROFILE-${Date.now()}`;
  const today = new Date().toISOString().slice(0, 10);
  const closeoutPromises = `Follow up on the alteration collection. ${marker}`;
  const recognitionNarrative = `Stayed late to prepare a client collection. ${marker}`;
  const coachingNote = `Confirm collection timing before the client arrives. ${marker}`;

  const { error: closeoutError } = await admin
    .from("staff_shift_closeouts")
    .upsert(
      {
        retailer_id: owner.retailer_id,
        staff_id: owner.id,
        closeout_date: today,
        promises_note: closeoutPromises,
        what_worked_note: `The handover notes were clear. ${marker}`,
      },
      { onConflict: "retailer_id,staff_id,closeout_date" },
    );
  if (closeoutError) throw closeoutError;

  const { error: recognitionError } = await admin
    .from("staff_recognition_acts")
    .insert({
      retailer_id: owner.retailer_id,
      staff_id: owner.id,
      authored_by_staff_id: owner.id,
      narrative: recognitionNarrative,
      occurred_on: today,
      review_state: "coached",
      reviewed_by_staff_id: reviewer.id,
      reviewed_at: new Date().toISOString(),
      coaching_note: coachingNote,
    });
  if (recognitionError) throw recognitionError;

  await signInOwner(page);
  await page.goto("/staff/today");
  const profileLink = page.getByRole("link", { name: "My profile →" });
  await expect(profileLink).toBeVisible();
  await profileLink.click();
  await expect(page).toHaveURL(/\/staff\/profile$/);

  await expect(
    page.getByRole("heading", { name: "My Profile", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(owner.full_name)).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expect(
    page.locator("dd").filter({ hasText: owner.role.replaceAll("_", " ") }),
  ).toBeVisible();
  await expect(page.getByText(closeoutPromises)).toBeVisible();

  const recognitionEvidence = page.getByLabel("Recognition evidence");
  await expect(
    recognitionEvidence.getByText(recognitionNarrative),
  ).toBeVisible();
  await expect(recognitionEvidence.getByText("coached")).toBeVisible();
  await expect(recognitionEvidence.getByText(coachingNote)).toBeVisible();
  await expect(
    recognitionEvidence.getByText(`by ${REVIEWER_NAME}`),
  ).toBeVisible();
});
