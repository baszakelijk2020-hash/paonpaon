import { CorporateRepository, createSupabaseAdminClient } from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import {
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
  TEST_RETAILER_SLUG,
} from "./fixtures";
import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "18.8";
const BROWSER_PROOF_SPEC = "apps/retailer/e2e/corporate-service-desk.spec.ts";

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
 * Proves the corporate service desk (PHASE 18.8 / BD-108) end to end:
 * a ticket's SLA due date is real (backdated here to simulate time
 * passing, then shown overdue), assigning and reprioritizing are both
 * audited (asserted against corporate_exception_events, not just the
 * UI), and resolving closes it out.
 */
test("a service-desk ticket shows overdue once past its SLA, and every state change is audited", async ({
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

  const { data: staff } = await admin
    .from("retailer_staff_members")
    .select("id, full_name")
    .eq("retailer_id", retailerId)
    .limit(1)
    .single();
  if (!staff) throw new Error("fixture staff missing");

  const unique = Date.now();
  const account = await repo.createAccount(retailerId, {
    legalName: `E2E Service Desk Co ${unique}`,
    accountReference: `E2E-SD-${unique}`,
  });
  const programme = await repo.createProgramme(retailerId, {
    accountId: account.id,
    name: `E2E Service Desk Programme ${unique}`,
    siteKeys: [],
  });
  const detail = `E2E damaged jacket ${unique}`;
  const exception = await repo.createException(retailerId, {
    programmeId: programme.id,
    kind: "damaged",
    detail,
  });

  try {
    // Simulate the SLA window having already passed — real time
    // manipulation, not a shortcut around the domain logic under test.
    await admin
      .from("corporate_exceptions")
      .update({ due_at: "2020-01-01T00:00:00.000Z" })
      .eq("id", exception.id);

    await page.goto(`/corporate/${programme.id}`);
    const row = page.locator("li", { hasText: detail });
    await expect(row.getByText("Overdue", { exact: true })).toBeVisible();

    await row.locator("select[name=staffId]").selectOption(staff.id);
    await row.getByRole("button", { name: "Assign" }).click();
    await expect(row.getByText(`assigned to ${staff.full_name}`)).toBeVisible();

    await row.locator("select[name=priority]").selectOption("urgent");
    await row.getByRole("button", { name: "Update priority" }).click();
    await expect(row.getByText("Urgent priority")).toBeVisible();

    await row.getByRole("button", { name: "Resolve" }).click();
    await expect(row.getByText("Resolved", { exact: true })).toBeVisible();

    const { data: events } = await admin
      .from("corporate_exception_events")
      .select("event_type")
      .eq("exception_id", exception.id)
      .order("created_at", { ascending: true });
    expect(events?.map((e) => e.event_type)).toEqual([
      "created",
      "assigned",
      "priority_changed",
      "resolved",
    ]);

    const { data: updated } = await admin
      .from("corporate_exceptions")
      .select("assigned_staff_id, priority, resolved_at")
      .eq("id", exception.id)
      .single();
    expect(updated?.assigned_staff_id).toBe(staff.id);
    expect(updated?.priority).toBe("urgent");
    expect(updated?.resolved_at).toBeTruthy();

    proofPassed = true;
  } finally {
    await admin.from("corporate_accounts").delete().eq("id", account.id);
  }
});
