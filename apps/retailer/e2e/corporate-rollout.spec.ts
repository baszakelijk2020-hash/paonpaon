import {
  CorporateRepository,
  CorporateRolloutRepository,
  createSupabaseAdminClient,
} from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import {
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
  TEST_RETAILER_SLUG,
} from "./fixtures";
import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "18.6";
const BROWSER_PROOF_SPEC = "apps/retailer/e2e/corporate-rollout.spec.ts";

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
 * Proves fitting rollout planning (PHASE 18.6 / BD-106) end to end: a
 * day at capacity refuses a further assignment (DB-level, the actual
 * enforcement), and a no-show is never silently dropped — it reslots
 * onto a different, earlier-dated day with spare capacity, and the
 * original miss stays on record rather than being edited away.
 */
test("a full fitting day refuses another assignment, and a no-show reslots onto a different day instead of disappearing", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
  const repo = new CorporateRepository(admin);
  const rolloutRepo = new CorporateRolloutRepository(admin);

  const { data: retailer } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");
  const retailerId = asId<"RetailerId">(retailer.id);

  const unique = Date.now();
  const account = await repo.createAccount(retailerId, {
    legalName: `E2E Rollout Co ${unique}`,
    accountReference: `E2E-ROLL-${unique}`,
  });
  const programme = await repo.createProgramme(retailerId, {
    accountId: account.id,
    name: `E2E Rollout Programme ${unique}`,
    siteKeys: [],
  });
  const wearer1 = await repo.createWearer(retailerId, {
    programmeId: programme.id,
    employeeReference: `E2E-R1-${unique}`,
    displayName: `E2E Rollout Wearer One ${unique}`,
    roleKey: "associate",
    joinedOn: "2025-01-01",
  });
  const wearer2 = await repo.createWearer(retailerId, {
    programmeId: programme.id,
    employeeReference: `E2E-R2-${unique}`,
    displayName: `E2E Rollout Wearer Two ${unique}`,
    roleKey: "associate",
    joinedOn: "2025-01-01",
  });

  // day1 is earlier and starts empty — the reslot target. day2 is later
  // and starts full with wearer1.
  const dayEarly = await rolloutRepo.createDay({
    retailerId,
    programmeId: programme.id,
    fittingDate: "2026-03-01",
    capacity: 1,
  });
  const dayLate = await rolloutRepo.createDay({
    retailerId,
    programmeId: programme.id,
    fittingDate: "2026-03-05",
    capacity: 1,
  });
  await rolloutRepo.assignWearer({
    retailerId,
    rolloutDayId: dayLate.id,
    wearerId: wearer1.id,
    capacity: dayLate.capacity,
  });

  try {
    // DB-level capacity refusal: dayLate is already full.
    const refused = await rolloutRepo.assignWearer({
      retailerId,
      rolloutDayId: dayLate.id,
      wearerId: wearer2.id,
      capacity: dayLate.capacity,
    });
    expect(refused).toEqual({ ok: false, reason: "day_at_capacity" });

    await page.goto(`/corporate/${programme.id}`);
    const lateDayCard = page.locator('[data-rollout-day="2026-03-05"]');
    const earlyDayCard = page.locator('[data-rollout-day="2026-03-01"]');
    await expect(lateDayCard.getByText(wearer1.displayName)).toBeVisible();

    await lateDayCard.getByRole("button", { name: "No-show" }).click();
    await expect(earlyDayCard.getByText(wearer1.displayName)).toBeVisible();

    const { data: slots } = await admin
      .from("corporate_rollout_slots")
      .select("status, rollout_day_id")
      .eq("wearer_id", wearer1.id)
      .order("created_at", { ascending: true });
    expect(slots).toHaveLength(2);
    expect(slots?.[0]).toMatchObject({
      status: "no_show",
      rollout_day_id: dayLate.id,
    });
    expect(slots?.[1]).toMatchObject({
      status: "planned",
      rollout_day_id: dayEarly.id,
    });

    proofPassed = true;
  } finally {
    await admin.from("corporate_accounts").delete().eq("id", account.id);
  }
});
