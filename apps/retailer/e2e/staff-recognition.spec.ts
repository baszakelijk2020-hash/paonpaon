import { createSupabaseAdminClient } from "@paon/database";
import { expect, test, type Page } from "@playwright/test";

import { TEST_OWNER_EMAIL, TEST_OWNER_PASSWORD } from "./fixtures";

/**
 * A second staff member is required for this journey: the owner cannot
 * review an act about themselves (the self-review guard), and the e2e
 * fixture retailer ships with exactly one member. Seeded with a null
 * user_id — the real state of an invited-but-not-yet-accepted colleague —
 * rather than provisioning a whole auth user this test never signs in as.
 */
const COLLEAGUE_EMAIL = "e2e-recognition-colleague@paon.test";
const COLLEAGUE_NAME = "E2E Colleague";

async function ensureColleague(retailerId: string): Promise<void> {
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
  if (existing) return;

  const { error } = await admin.from("retailer_staff_members").insert({
    retailer_id: retailerId,
    user_id: null,
    full_name: COLLEAGUE_NAME,
    email: COLLEAGUE_EMAIL,
    role: "sales_associate",
    accepted_at: new Date().toISOString(),
  });
  if (error) throw error;
}

/**
 * PHASE 11.2 / WFM-104 browser proof. Drives the real recognition page
 * against this branch's live Supabase project: an act is logged through the
 * actual form, appears in the real review queue, is coached with a note,
 * and moves to the recognised list — and the two guardrails that make this
 * surface trustworthy (a too-short narrative, and coaching with no note)
 * are both refused by the running app, not just by a unit test.
 */

async function signInOwner(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test("an extra-mile act is logged, refused when thin, then coached with a note", async ({
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
  await ensureColleague(ownerRow.retailer_id);

  await page.goto("/staff/recognition");
  await expect(
    page.getByRole("heading", { name: "Recognition", exact: true }),
  ).toBeVisible();

  const marker = `PAON-RECOG-${Date.now()}`;

  // 1. A narrative too short to mean anything is refused by the running
  //    app, with a readable reason rather than a raw constraint violation.
  //    minLength on the input is bypassed deliberately (fill + JS submit
  //    would trip browser validation first) by using a value that clears
  //    the HTML floor but not the trimmed domain floor.
  // Scoped by text rather than by role: Next.js renders its own
  // `role="alert"` route announcer, so a bare getByRole("alert") matches
  // two elements and fails strict mode.
  await page.locator("textarea[name='narrative']").fill("   short   ");
  await page.getByRole("button", { name: "Log act" }).click();
  await expect(page.getByText(/Describe what actually happened/i)).toBeVisible({
    timeout: 15_000,
  });

  // 2. A real act logs successfully and lands in the review queue.
  //    Logged ABOUT the colleague, not the signed-in owner — the owner is
  //    the reviewer, and reviewing an act about yourself is refused by
  //    design. Selected here rather than earlier so the preceding failed
  //    submit cannot have reset it.
  await page
    .getByLabel("Who went the extra mile")
    .selectOption({ label: COLLEAGUE_NAME });
  await page
    .locator("textarea[name='narrative']")
    .fill(`Stayed late to re-press a jacket before a flight. ${marker}`);
  await page.getByRole("button", { name: "Log act" }).click();
  await expect(page.getByText(/Logged\. A manager will see it/i)).toBeVisible({
    timeout: 15_000,
  });

  await page.reload();
  const queueItem = page
    .locator("#recognition-review-queue li")
    .filter({ hasText: marker });
  // The row itself is the readiness condition. `networkidle` never settles
  // reliably in an RSC application and previously timed out after the row
  // was already usable on screen.
  await expect(queueItem).toBeVisible({ timeout: 30_000 });

  // 3. Coaching with no note is refused — a coaching state carrying no
  //    guidance is the empty gesture this surface must not produce.
  await queueItem.getByRole("button", { name: "Coach" }).click();
  await expect(
    queueItem.getByText(/Coaching needs an actual note/i),
  ).toBeVisible({ timeout: 15_000 });

  // The refusal must be real, not just a message: the act stays in the
  // queue and never reaches the recognised list.
  await expect(
    page.locator("#recognition-reviewed li").filter({ hasText: marker }),
  ).toHaveCount(0);

  // 4. Coaching WITH a note succeeds and moves the act out of the queue
  //    into the recognised list, carrying its note.
  await queueItem
    .locator("input[name='coachingNote']")
    .fill(`Offer the loan garment next time. ${marker}`);
  await queueItem.getByRole("button", { name: "Coach" }).click();

  await expect
    .poll(
      async () => {
        await page.reload();
        return page
          .locator("#recognition-reviewed li")
          .filter({ hasText: marker })
          .count();
      },
      { timeout: 30_000 },
    )
    .toBeGreaterThan(0);

  const reviewedItem = page
    .locator("#recognition-reviewed li")
    .filter({ hasText: marker });
  await expect(reviewedItem).toContainText("coached");
  await expect(reviewedItem).toContainText("Offer the loan garment next time");

  // 5. The act is gone from the awaiting-review queue — reviewed once,
  //    not left available for a second manager to review again.
  await expect(
    page.locator("#recognition-review-queue li").filter({ hasText: marker }),
  ).toHaveCount(0);

  // 6. No leaderboard anywhere on the page. This item's non-goal is
  //    enforced in schema and domain; this asserts the rendered surface
  //    never reintroduces it either.
  const pageText = (await page.locator("body").innerText()).toLowerCase();
  expect(pageText).not.toContain("leaderboard");
  expect(pageText).not.toContain("top performer");
  expect(pageText).toContain("not a scoreboard");
});
