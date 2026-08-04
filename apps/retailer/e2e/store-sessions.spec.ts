import { CustomerRepository, createSupabaseAdminClient } from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import {
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
  TEST_RETAILER_SLUG,
} from "./fixtures";
import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "16.4";
const BROWSER_PROOF_SPEC = "apps/retailer/e2e/store-sessions.spec.ts";

let proofPassed = false;

test.afterAll(async () => {
  await writeBrowserProofRun({
    phaseItemId: PHASE_ITEM_ID,
    spec: BROWSER_PROOF_SPEC,
    status: proofPassed ? "passed" : "failed",
  });
});

test("a guided comparison records why the customer preferred full canvas, and a mirror failure closes normally once finished on paper", async ({
  page,
}) => {
  test.setTimeout(180_000);

  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  const { data: retailer } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");
  const retailerId = asId<"RetailerId">(retailer.id);

  const unique = Date.now();
  const customer = await new CustomerRepository(admin).create({
    retailerId,
    fullName: `E2E Store Session Client ${unique}`,
    email: `store-session-${unique}@paon.test`,
    lifecycleStage: "prospect",
  });
  const lookRef = `navy full-canvas two-piece ${unique}`;
  const reason = `the chest felt softer ${unique}`;

  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  try {
    // ---- open a session for this customer ----------------------------
    await page.goto("/store-sessions");
    await page
      .locator("#open-session-customer")
      .selectOption({ label: `E2E Store Session Client ${unique}` });
    await page
      .locator("#open-session-form")
      .getByRole("button", { name: "Open a session" })
      .click();

    const sessionCard = page.locator('[data-session-state="open"]', {
      hasText: `E2E Store Session Client ${unique}`,
    });
    await expect(sessionCard).toBeVisible({ timeout: 15_000 });
    const sessionId = await sessionCard.getAttribute("data-session-id");
    if (!sessionId) throw new Error("session id missing from the card");

    // ---- a comparison the customer did NOT prefer ----------------------
    await sessionCard
      .locator("select[id^='construction-']")
      .selectOption("half_canvas");
    await sessionCard
      .getByRole("button", { name: "Record comparison" })
      .click();
    await expect(sessionCard.getByText("Comparison recorded.")).toBeVisible({
      timeout: 15_000,
    });

    // ---- the one the customer preferred, with a real reason ------------
    await sessionCard
      .locator("select[id^='construction-']")
      .selectOption("full_canvas");
    await sessionCard.getByLabel("Customer preferred this").check();
    await sessionCard.locator("input[name='notedReason']").fill(reason);
    await sessionCard
      .getByRole("button", { name: "Record comparison" })
      .click();
    await expect(sessionCard.getByText(reason)).toBeVisible({
      timeout: 15_000,
    });

    // ---- device failure with no fallback confirmed is refused ----------
    await sessionCard
      .locator("input[name='customerApprovedLookRef']")
      .fill(lookRef);
    await sessionCard.getByLabel("The mirror/display failed").check();
    await sessionCard.getByRole("button", { name: "Close session" }).click();
    await expect(
      sessionCard.getByText(/finished on paper before closing/i),
    ).toBeVisible({ timeout: 15_000 });

    const { data: stillOpen } = await admin
      .from("store_sessions")
      .select("closed_at")
      .eq("id", sessionId)
      .single();
    expect(stillOpen?.closed_at).toBeNull();

    // ---- confirming the paper fallback closes it normally ---------------
    await sessionCard
      .locator("input[name='customerApprovedLookRef']")
      .fill(lookRef);
    await sessionCard.getByLabel("The mirror/display failed").check();
    await sessionCard.getByLabel("Finished on paper instead").check();
    await sessionCard.getByRole("button", { name: "Close session" }).click();

    // The closed session moves out of the "open" list entirely (revalidated
    // by the same action), so its own success notice is not checked here —
    // the closed card asserted below is the real proof it landed.
    const closedCard = page.locator(
      `[data-session-id="${sessionId}"][data-session-state="closed"]`,
    );
    await expect
      .poll(
        async () => {
          await page.goto("/store-sessions");
          return closedCard.count();
        },
        { timeout: 30_000 },
      )
      .toBeGreaterThan(0);
    await expect(closedCard.getByText(lookRef)).toBeVisible();
    await expect(closedCard.getByText("Finished on paper")).toBeVisible();

    const { data: closedRow } = await admin
      .from("store_sessions")
      .select(
        "closed_at, device_failed, manual_fallback_used, customer_approved_look_ref",
      )
      .eq("id", sessionId)
      .single();
    expect(closedRow?.closed_at).not.toBeNull();
    expect(closedRow?.device_failed).toBe(true);
    expect(closedRow?.manual_fallback_used).toBe(true);
    expect(closedRow?.customer_approved_look_ref).toBe(lookRef);

    const { data: comparisonRows } = await admin
      .from("store_comparison_records")
      .select("construction_kind, customer_preferred, noted_reason")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    expect(comparisonRows).toEqual([
      {
        construction_kind: "half_canvas",
        customer_preferred: false,
        noted_reason: null,
      },
      {
        construction_kind: "full_canvas",
        customer_preferred: true,
        noted_reason: reason,
      },
    ]);

    proofPassed = true;
  } finally {
    // store_sessions.customer_id is ON DELETE SET NULL, not CASCADE, so
    // deleting the customer alone would orphan this run's session rather
    // than remove it. store_comparison_records references store_sessions
    // ON DELETE CASCADE, so deleting the session cleans up both.
    const { data: sessionsToClean } = await admin
      .from("store_sessions")
      .select("id")
      .eq("retailer_id", retailerId)
      .eq("customer_id", customer.id);
    for (const row of sessionsToClean ?? []) {
      await admin.from("store_sessions").delete().eq("id", row.id);
    }
    await admin.from("customers").delete().eq("id", customer.id);
  }
});
