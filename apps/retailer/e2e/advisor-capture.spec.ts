import {
  AdvisorCaptureRepository,
  AppointmentRepository,
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

// Both tests below write their pass/fail into module-level flags that a
// shared `test.afterAll` reads. `fullyParallel: true` can otherwise assign
// this file's two tests to different worker processes, each with its own
// copy of these flags — the other test's flag would read as its untouched
// `false` default and overwrite that test's real result with a false
// "failed". Serial mode keeps both tests in one worker so the flags stay
// accurate.
test.describe.configure({ mode: "serial" });

const PHASE_ITEM_ID = "advisor-capture";
const BROWSER_PROOF_SPEC = "apps/retailer/e2e/advisor-capture.spec.ts";
const APPOINTMENT_PROOF_SPEC =
  "apps/retailer/e2e/advisor-capture.spec.ts (appointment capture)";

let appointmentProofPassed = false;

test.afterAll(async () => {
  await writeBrowserProofRun({
    phaseItemId: `${PHASE_ITEM_ID}-appointment-capture`,
    spec: APPOINTMENT_PROOF_SPEC,
    status: appointmentProofPassed ? "passed" : "failed",
  });
});

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

test("advisor capture on an appointment page: confirming an appointment_proposal books a real appointment, acknowledging an unresolved item writes nothing", async ({
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
    fullName: `E2E Appointment Capture Client ${unique}`,
    email: `appt-capture-${unique}@paon.test`,
    lifecycleStage: "prospect",
  });

  const fittingStartsAt = new Date();
  fittingStartsAt.setMinutes(0, 0, 0);
  fittingStartsAt.setHours(fittingStartsAt.getHours() + 1);
  const fittingEndsAt = new Date(fittingStartsAt.getTime() + 30 * 60_000);
  const appointment = await new AppointmentRepository(admin).create({
    retailerId,
    customerId: customer.id,
    type: "fitting",
    startsAt: fittingStartsAt.toISOString(),
    endsAt: fittingEndsAt.toISOString(),
  });

  const proposedStartsAt = new Date();
  proposedStartsAt.setDate(proposedStartsAt.getDate() + 14);
  proposedStartsAt.setHours(11, 0, 0, 0);

  const rawText = `Fitting went well today ${unique}. Book him a styling consultation in two weeks to look at odd jackets ${unique}. Not sure if he wants peak lapel or notch on the next jacket ${unique}.`;

  const captureRepo = new AdvisorCaptureRepository(admin);
  const captureSession = await captureRepo.startSession({
    retailerId,
    staffId,
    customerId: customer.id,
    appointmentId: appointment.id,
    source: "text",
    rawText,
  });
  expect(captureSession.appointmentId).toBe(appointment.id);

  const bundles = await captureRepo.proposeBundles({
    retailerId,
    session: captureSession,
    proposals: [
      {
        kind: "appointment_proposal",
        summary: "Book a styling consultation in two weeks",
        sourceExcerpt:
          "Book him a styling consultation in two weeks to look at odd jackets",
        confidence: 0.8,
        payload: {
          appointmentType: "styling_consultation",
          startsAt: proposedStartsAt.toISOString(),
          durationMinutes: 45,
          reason: "Look at odd jackets for him",
        },
      },
      {
        kind: "unresolved",
        summary: "Unclear which lapel he wants on the next jacket",
        sourceExcerpt:
          "Not sure if he wants peak lapel or notch on the next jacket",
        confidence: 0.5,
        payload: {
          question: "Peak lapel or notch on the next jacket?",
        },
      },
    ],
  });
  expect(bundles).toHaveLength(2);
  const appointmentProposalBundle = bundles.find(
    (b) => b.kind === "appointment_proposal",
  )!;
  const unresolvedBundle = bundles.find((b) => b.kind === "unresolved")!;

  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  let createdAppointmentId: string | null = null;
  try {
    await page.goto(`/appointments/${appointment.id}`);

    const review = page.locator("[data-capture-review]");
    await expect(review).toBeVisible({ timeout: 15_000 });

    const appointmentCard = page.locator(
      `[data-bundle-id="${appointmentProposalBundle.id}"]`,
    );
    await expect(appointmentCard).toContainText(
      "Book him a styling consultation in two weeks to look at odd jackets",
    );
    const unresolvedCard = page.locator(
      `[data-bundle-id="${unresolvedBundle.id}"]`,
    );
    await expect(unresolvedCard).toContainText(
      "Not sure if he wants peak lapel or notch on the next jacket",
    );
    // an unresolved bundle never offers "Confirm" — there is nothing to
    // write for it, only "Acknowledge".
    await expect(
      unresolvedCard.getByRole("button", { name: "Confirm" }),
    ).toHaveCount(0);

    await appointmentCard.getByRole("button", { name: "Confirm" }).click();
    await unresolvedCard.getByRole("button", { name: "Acknowledge" }).click();

    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from("advisor_capture_bundles")
            .select("id, status")
            .in("id", [appointmentProposalBundle.id, unresolvedBundle.id]);
          return (data ?? [])
            .map((row) => row.status)
            .sort()
            .join(",");
        },
        { timeout: 30_000 },
      )
      .toBe("confirmed,dismissed");

    // ---- confirming the proposal booked a real appointment ---------------
    const { data: confirmedBundleRow } = await admin
      .from("advisor_capture_bundles")
      .select("linked_appointment_id")
      .eq("id", appointmentProposalBundle.id)
      .single();
    expect(confirmedBundleRow?.linked_appointment_id).not.toBeNull();
    createdAppointmentId = confirmedBundleRow!.linked_appointment_id!;

    const { data: newAppointmentRows } = await admin
      .from("appointments")
      .select("id, retailer_id, customer_id, type, status, notes")
      .eq("id", createdAppointmentId);
    expect(newAppointmentRows).toHaveLength(1);
    const newAppointment = newAppointmentRows![0]!;
    expect(newAppointment.retailer_id).toBe(retailerId);
    expect(newAppointment.customer_id).toBe(customer.id);
    expect(newAppointment.type).toBe("styling_consultation");
    expect(newAppointment.status).toBe("requested");
    expect(newAppointment.notes).toContain("Look at odd jackets for him");

    // ---- acknowledging the unresolved item wrote nothing ------------------
    const { data: allAppointmentsForCustomer } = await admin
      .from("appointments")
      .select("id")
      .eq("retailer_id", retailerId)
      .eq("customer_id", customer.id);
    // exactly the original "fitting" plus the one confirmed proposal — the
    // dismissed "unresolved" bundle never had a write target.
    expect(allAppointmentsForCustomer).toHaveLength(2);

    await page.reload();
    await expect(page.locator("[data-capture-review]")).toHaveCount(0);

    appointmentProofPassed = true;
  } finally {
    if (createdAppointmentId) {
      await admin.from("appointments").delete().eq("id", createdAppointmentId);
    }
    await admin.from("appointments").delete().eq("id", appointment.id);
    await admin
      .from("advisor_capture_sessions")
      .delete()
      .eq("retailer_id", retailerId)
      .eq("customer_id", customer.id);
    await admin.from("customers").delete().eq("id", customer.id);
  }
});
