import {
  AdvisorCaptureRepository,
  CustomerRepository,
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

const PHASE_ITEM_ID = "advisor-capture";
const BROWSER_PROOF_SPEC = "apps/retailer/e2e/advisor-capture.spec.ts";

let proofPassed = false;

test.afterAll(async () => {
  await writeBrowserProofRun({
    phaseItemId: PHASE_ITEM_ID,
    spec: BROWSER_PROOF_SPEC,
    status: proofPassed ? "passed" : "failed",
  });
});

test("advisor capture reviews AI-proposed bundles: confirming writes the Self-Portrait fact and the follow-up, dismissing writes neither", async ({
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

  const { data: ownerAuthUser } = await admin
    .from("retailer_staff_members")
    .select("id")
    .eq("retailer_id", retailerId)
    .eq("email", TEST_OWNER_EMAIL)
    .single();
  if (!ownerAuthUser) throw new Error("owner staff record missing");
  const staffId = asId<"StaffId">(ownerAuthUser.id);

  const unique = Date.now();
  const customer = await new CustomerRepository(admin).create({
    retailerId,
    fullName: `E2E Capture Client ${unique}`,
    email: `capture-${unique}@paon.test`,
    lifecycleStage: "prospect",
  });

  const rawText = `Mr ${customer.fullName.split(" ").pop()} loves black oxford shoes ${unique}. Promised to call him Friday when the linen jackets arrive ${unique}. Also mentioned he collects vintage watches ${unique}.`;

  const captureRepo = new AdvisorCaptureRepository(admin);
  const captureSession = await captureRepo.startSession({
    retailerId,
    staffId,
    customerId: customer.id,
    source: "text",
    rawText,
  });

  const bundles = await captureRepo.proposeBundles({
    retailerId,
    session: captureSession,
    proposals: [
      {
        kind: "self_portrait_fact",
        summary: "Prefers black oxford shoes",
        sourceExcerpt: "loves black oxford shoes",
        confidence: 0.92,
        payload: { factType: "colour_interest", valueLabel: "Black oxfords" },
      },
      {
        kind: "follow_up",
        summary: "Call about linen jackets",
        sourceExcerpt:
          "Promised to call him Friday when the linen jackets arrive",
        confidence: 0.87,
        payload: {
          whyNow: "Promised a call once linen jackets arrive",
          suggestedAction: "Call about the new linen jackets",
          channel: "phone",
        },
      },
      {
        kind: "task_note",
        summary: "Collects vintage watches",
        sourceExcerpt: "he collects vintage watches",
        confidence: 0.7,
        payload: {
          note: "Collects vintage watches — worth a mention next visit.",
        },
      },
    ],
  });
  expect(bundles).toHaveLength(3);
  const factBundle = bundles.find((b) => b.kind === "self_portrait_fact")!;
  const followUpBundle = bundles.find((b) => b.kind === "follow_up")!;
  const taskNoteBundle = bundles.find((b) => b.kind === "task_note")!;

  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  try {
    await page.goto(`/customers/${customer.id}`);

    const review = page.locator("[data-capture-review]");
    await expect(review).toBeVisible({ timeout: 15_000 });

    // ---- every proposal shows its real, quoted evidence -------------------
    const factCard = page.locator(`[data-bundle-id="${factBundle.id}"]`);
    await expect(factCard).toContainText("loves black oxford shoes");
    const followUpCard = page.locator(
      `[data-bundle-id="${followUpBundle.id}"]`,
    );
    await expect(followUpCard).toContainText(
      "Promised to call him Friday when the linen jackets arrive",
    );

    // ---- confirm the fact, confirm the follow-up, dismiss the note --------
    // Each mutation is a real server action keyed by bundleId in a hidden
    // input, so it succeeds regardless of what the page currently shows;
    // only the *display* needs a fresh render, proven below via reload
    // rather than relying on client-side router revalidation timing.
    const taskNoteCard = page.locator(
      `[data-bundle-id="${taskNoteBundle.id}"]`,
    );
    await factCard.getByRole("button", { name: "Confirm" }).click();
    await followUpCard.getByRole("button", { name: "Confirm" }).click();
    await taskNoteCard.getByRole("button", { name: "Dismiss" }).click();

    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from("advisor_capture_bundles")
            .select("id, status")
            .in("id", [factBundle.id, followUpBundle.id, taskNoteBundle.id]);
          return (data ?? [])
            .map((row) => row.status)
            .sort()
            .join(",");
        },
        { timeout: 30_000 },
      )
      .toBe("confirmed,confirmed,dismissed");

    const { data: factRows } = await admin
      .from("customer_facts")
      .select("fact_type, value_label, provenance_class, evidence")
      .eq("retailer_id", retailerId)
      .eq("customer_id", customer.id);
    expect(factRows).toHaveLength(1);
    expect(factRows?.[0]?.fact_type).toBe("colour_interest");
    expect(factRows?.[0]?.value_label).toBe("Black oxfords");
    expect(factRows?.[0]?.provenance_class).toBe("advisor_observed");
    expect(factRows?.[0]?.evidence).toEqual([
      { note: "loves black oxford shoes" },
    ]);

    const { data: opportunityRows } = await admin
      .from("clienteling_opportunities")
      .select("opportunity_type, why_now, suggested_action, channel, status")
      .eq("retailer_id", retailerId)
      .eq("customer_id", customer.id)
      .eq("opportunity_type", "advisor_commitment");
    expect(opportunityRows).toHaveLength(1);
    expect(opportunityRows?.[0]?.suggested_action).toBe(
      "Call about the new linen jackets",
    );
    expect(opportunityRows?.[0]?.status).toBe("draft");

    const { data: noteRows } = await admin
      .from("clienteling_notes")
      .select("id")
      .eq("retailer_id", retailerId)
      .eq("customer_id", customer.id);
    expect(noteRows ?? []).toHaveLength(0);

    const { data: dismissedBundle } = await admin
      .from("advisor_capture_bundles")
      .select("linked_note_id")
      .eq("id", taskNoteBundle.id)
      .single();
    expect(dismissedBundle?.linked_note_id).toBeNull();

    // ---- the confirmed follow-up shows in the existing opportunity inbox --
    // one canonical follow-up system, not a second one — and every
    // resolved bundle has genuinely left "needs your review".
    await page.reload();
    await expect(
      page.getByText("Call about the new linen jackets"),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Advisor commitment")).toBeVisible();
    await expect(page.locator("[data-capture-review]")).toHaveCount(0);

    proofPassed = true;
  } finally {
    await admin
      .from("clienteling_opportunities")
      .delete()
      .eq("retailer_id", retailerId)
      .eq("customer_id", customer.id);
    // `customer_facts` has no DELETE grant for any role, including
    // service_role — append-only by design, soft-delete only (see
    // docs/PROJECT_STATE.md's 2026-08-05 handoff). A plain `.delete()`
    // here silently fails and does nothing; the actual cleanup happens
    // below when the customer row itself is deleted (`customer_id`
    // cascades `on delete cascade`), but this soft-delete is kept as
    // the correct, non-misleading write in case that ordering ever
    // changes.
    await admin
      .from("customer_facts")
      .update({ deleted_at: new Date().toISOString() })
      .eq("retailer_id", retailerId)
      .eq("customer_id", customer.id);
    // advisor_capture_sessions/bundles cascade from the customer via
    // ON DELETE SET NULL (session) — deleted independently since the
    // session's customer_id is nullable, not cascading.
    await admin
      .from("advisor_capture_sessions")
      .delete()
      .eq("retailer_id", retailerId)
      .eq("customer_id", customer.id);
    await admin.from("customers").delete().eq("id", customer.id);
  }
});
