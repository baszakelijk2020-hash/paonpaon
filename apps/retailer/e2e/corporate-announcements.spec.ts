import { CorporateRepository, createSupabaseAdminClient } from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import {
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
  TEST_RETAILER_SLUG,
} from "./fixtures";
import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "18.5-corporate-announcements";
const BROWSER_PROOF_SPEC = "apps/retailer/e2e/corporate-announcements.spec.ts";

let proofPassed = false;

test.afterAll(async () => {
  await writeBrowserProofRun({
    phaseItemId: PHASE_ITEM_ID,
    spec: BROWSER_PROOF_SPEC,
    status: proofPassed ? "passed" : "failed",
  });
});

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

/**
 * Proves the real staff-driven half of PHASE 18.5's "announcements"
 * owner-boundary surface: a manager writes a draft and publishes it
 * through the real `/corporate/[programmeId]` form -> `createAnnouncement`/
 * `publishAnnouncement` Server Actions -> `CorporateRepository` ->
 * `corporate_announcements` write, asserted against the database, not
 * just a UI toast.
 */
test("a manager writes and publishes a programme announcement", async ({
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
    legalName: `E2E Announcement Co ${unique}`,
    accountReference: `E2E-ANN-${unique}`,
  });
  const programme = await repo.createProgramme(retailerId, {
    accountId: account.id,
    name: `E2E Announcement Programme ${unique}`,
    siteKeys: [],
  });

  try {
    await page.goto(`/corporate/${programme.id}`);
    const title = `E2E fitting week reminder ${unique}`;
    await page.locator("#announcement-title").fill(title);
    await page
      .locator("#announcement-body")
      .fill("Fitting days are next Monday through Wednesday this cycle.");
    await page.getByRole("button", { name: "Save as draft" }).click();

    await expect(page.getByText(title)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Draft", { exact: true })).toBeVisible();

    const { data: draftRow } = await admin
      .from("corporate_announcements")
      .select("id, published_at")
      .eq("programme_id", programme.id)
      .eq("title", title)
      .single();
    expect(draftRow).toBeTruthy();
    expect(draftRow!.published_at).toBeNull();

    await page
      .locator("li", { hasText: title })
      .getByRole("button", { name: "Publish" })
      .click();

    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from("corporate_announcements")
            .select("published_at")
            .eq("id", draftRow!.id)
            .single();
          return data?.published_at ?? null;
        },
        { timeout: 30_000 },
      )
      .not.toBeNull();

    await expect(page.getByText("Published", { exact: true })).toBeVisible();

    proofPassed = true;
  } finally {
    await admin.from("corporate_accounts").delete().eq("id", account.id);
  }
});
