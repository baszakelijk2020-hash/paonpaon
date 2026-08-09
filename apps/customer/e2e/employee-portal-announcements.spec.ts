import { CorporateRepository, createSupabaseAdminClient } from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import { TEST_RETAILER_SLUG } from "./fixtures";
import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "18.5-employee-portal-announcements";
const BROWSER_PROOF_SPEC =
  "apps/customer/e2e/employee-portal-announcements.spec.ts";

let proofPassed = false;

test.afterAll(async () => {
  await writeBrowserProofRun({
    phaseItemId: PHASE_ITEM_ID,
    spec: BROWSER_PROOF_SPEC,
    status: proofPassed ? "passed" : "failed",
  });
});

/**
 * Proves the wearer-facing half of PHASE 18.5's "announcements" surface:
 * a published announcement for a wearer's own programme renders on their
 * `/employee` page, a draft (never published) never does, and a wearer
 * in a DIFFERENT programme at the same retailer never sees it either —
 * the RLS boundary migration 20260809220000 adds, not just page logic.
 */
test("a wearer sees a published announcement for their own programme, never a draft or another programme's news", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  const { data: retailer } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");
  const retailerId = asId<"RetailerId">(retailer.id);

  const { data: staff } = await admin
    .from("retailer_staff_members")
    .select("id")
    .eq("retailer_id", retailerId)
    .limit(1)
    .single();
  if (!staff) throw new Error("fixture staff missing");

  const unique = Date.now();
  const repo = new CorporateRepository(admin);

  const account = await repo.createAccount(retailerId, {
    legalName: `E2E Announcement Reader Co ${unique}`,
    accountReference: `E2E-ANR-${unique}`,
  });
  const programme = await repo.createProgramme(retailerId, {
    accountId: account.id,
    name: `E2E Announcement Reader Programme ${unique}`,
    siteKeys: [],
  });
  const otherProgramme = await repo.createProgramme(retailerId, {
    accountId: account.id,
    name: `E2E Announcement Other Programme ${unique}`,
    siteKeys: [],
  });

  const loginEmail = `e2e-announcement-wearer-${unique}@paon.test`;
  const wearer = await repo.createWearer(retailerId, {
    programmeId: programme.id,
    employeeReference: `E2E-ANR-EMP-${unique}`,
    displayName: `E2E Announcement Wearer ${unique}`,
    roleKey: "associate",
    joinedOn: "2025-01-01",
  });
  await repo.setWearerLoginEmail(wearer.id, loginEmail);

  const otherLoginEmail = `e2e-announcement-other-wearer-${unique}@paon.test`;
  const otherWearer = await repo.createWearer(retailerId, {
    programmeId: otherProgramme.id,
    employeeReference: `E2E-ANR-OTHER-${unique}`,
    displayName: `E2E Announcement Other Wearer ${unique}`,
    roleKey: "associate",
    joinedOn: "2025-01-01",
  });
  await repo.setWearerLoginEmail(otherWearer.id, otherLoginEmail);

  const publishedTitle = `E2E published announcement ${unique}`;
  const published = await repo.createAnnouncement(retailerId, {
    programmeId: programme.id,
    title: publishedTitle,
    body: "This announcement has been published and should be visible.",
    authoredByStaffId: staff.id,
  });
  await repo.publishAnnouncement(published.id);

  const draftTitle = `E2E draft announcement ${unique}`;
  await repo.createAnnouncement(retailerId, {
    programmeId: programme.id,
    title: draftTitle,
    body: "This announcement is still a draft and must never be visible.",
    authoredByStaffId: staff.id,
  });

  try {
    const { error: createUserError } = await admin.auth.admin.createUser({
      email: loginEmail,
      email_confirm: true,
    });
    if (createUserError) {
      throw new Error(
        `Failed to create wearer auth user: ${createUserError.message}`,
      );
    }
    const { data: linkData, error: linkError } =
      await admin.auth.admin.generateLink({
        type: "magiclink",
        email: loginEmail,
      });
    if (linkError || !linkData.properties) {
      throw new Error(
        `Failed to generate magic link: ${linkError?.message ?? "unknown"}`,
      );
    }

    await page.goto(
      `/employee/auth/confirm?token_hash=${linkData.properties.hashed_token}&type=magiclink`,
    );
    await expect(page).toHaveURL(/\/employee$/);

    await expect(page.getByText(publishedTitle)).toBeVisible();
    await expect(page.getByText(draftTitle)).toHaveCount(0);

    // A wearer in a DIFFERENT programme at the same retailer never sees it.
    await page.context().clearCookies();

    const { error: createOtherUserError } = await admin.auth.admin.createUser({
      email: otherLoginEmail,
      email_confirm: true,
    });
    if (createOtherUserError) {
      throw new Error(
        `Failed to create other wearer auth user: ${createOtherUserError.message}`,
      );
    }
    const { data: otherLinkData, error: otherLinkError } =
      await admin.auth.admin.generateLink({
        type: "magiclink",
        email: otherLoginEmail,
      });
    if (otherLinkError || !otherLinkData.properties) {
      throw new Error(
        `Failed to generate other magic link: ${otherLinkError?.message ?? "unknown"}`,
      );
    }
    await page.goto(
      `/employee/auth/confirm?token_hash=${otherLinkData.properties.hashed_token}&type=magiclink`,
    );
    await expect(page).toHaveURL(/\/employee$/);
    await expect(page.getByText(publishedTitle)).toHaveCount(0);
    await expect(page.getByText(draftTitle)).toHaveCount(0);

    proofPassed = true;
  } finally {
    await admin.from("corporate_accounts").delete().eq("id", account.id);
  }
});
