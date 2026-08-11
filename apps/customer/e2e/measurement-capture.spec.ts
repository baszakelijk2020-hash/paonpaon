import { createSupabaseAdminClient } from "@paon/database";
import { ensureProgrammeProofSeed } from "@paon/database/programme-proof-seed";
import { expect, test, type Page } from "@playwright/test";

// Measurement capture suite for PHASE 12.1 — customer app guided self-measurement

async function signInCustomer(
  page: Page,
  email: string,
  admin: Awaited<ReturnType<typeof createSupabaseAdminClient>>,
): Promise<void> {
  // Generate a magic link using the admin client
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: email,
  });
  if (error || !data.properties) {
    throw new Error(
      `Failed to generate magic link: ${error?.message ?? "unknown error"}`,
    );
  }

  // Navigate directly to the auth confirm URL with the token
  await page.goto(
    `/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`,
  );

  // Wait for redirect to dashboard
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });

  // Wait for the dashboard to fully load - look for main content to confirm we're authenticated
  await expect(page.getByRole("main")).toBeVisible({ timeout: 30_000 });
}

/**
 * Customer-side guided self-measurement capture (PHASE 12.1).
 *
 * This test verifies: (1) the capture form collects all 8 measurements,
 * (2) submission converts cm to whole millimetres and records via the
 * decision gate, (3) the decision outcome is displayed in plain language,
 * and (4) the reorder gate status shows correctly for different states
 * (allowed and blocked).
 */
test("customer can capture guided self-measurements and see the outcome", async ({
  page,
}) => {
  test.setTimeout(300_000);

  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const anonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]!;
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const proof = await ensureProgrammeProofSeed({
    supabaseUrl,
    anonKey,
    serviceRoleKey,
  });
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  // A fresh, dedicated customer, not the shared programme-proof-seed
  // customer: customer_measurement_versions has no DELETE grant at all
  // (an approved version's id may already be pinned to a garment cut, per
  // Stage 12.2) so any version this test's submission causes to be
  // approved would permanently pollute the shared seed customer for every
  // other test that expects it to have no approved measurements.
  const testEmail = `e2e-measurement-capture-${Date.now()}@paon.test`;
  const { data: authUser, error: authError } =
    await admin.auth.admin.createUser({
      email: testEmail,
      email_confirm: true,
    });
  if (authError || !authUser.user) {
    throw new Error(`Failed to create test customer: ${authError?.message}`);
  }
  const { data: createdCustomer, error: customerError } = await admin
    .from("customers")
    .insert({
      retailer_id: proof.retailerId,
      user_id: authUser.user.id,
      full_name: "E2E Measurement Capture Test Customer",
      email: testEmail,
      lifecycle_stage: "prospect",
    })
    .select("id")
    .single();
  if (customerError || !createdCustomer) {
    throw new Error(
      `Failed to create test customer record: ${customerError?.message}`,
    );
  }
  const customerId = createdCustomer.id;

  // Sign in as the customer.
  await signInCustomer(page, testEmail, admin);

  // Navigate to measurements page.
  await page.goto("/measurements");

  // ---- The form is present and the reorder gate shows "no approved" -------
  await expect(
    page.getByRole("heading", { name: "Record your measurements" }),
  ).toBeVisible();

  // "Reorder blocked" because no approved measurements exist yet.
  await expect(
    page.getByText("Reorder blocked", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText(/don't have any approved measurements/i),
  ).toBeVisible();

  // ---- Fill in all 8 measurements -------
  const measurements = [
    { key: "chest", value: "101.5" },
    { key: "waist", value: "89.3" },
    { key: "sleeve_length", value: "62.0" },
    { key: "shoulder", value: "45.8" },
    { key: "jacket_length", value: "75.2" },
    { key: "trouser_length", value: "107.1" },
    { key: "trouser_inseam", value: "79.4" },
    { key: "hips", value: "95.6" },
  ];

  for (const { key, value } of measurements) {
    const input = page.locator(`input[name="${key}"]`);
    await input.fill(value);
  }

  // ---- Submit the form -------
  await page.getByRole("button", { name: "Submit measurements" }).click();

  // ---- Verify success message is shown -------
  // The decision outcome is shown in a green box because this is a new customer
  // with no prior approved measurements, so the decision will be either
  // "no_action" (if the system treats the first measurement as matching nothing)
  // or "advisor_review" (if the system wants review on the first capture).
  // Both are valid outcomes; we just verify the outcome is displayed.
  const successMessage = page.getByText(
    /Your measurements match|Thanks|Please try/,
  );
  await expect(successMessage).toBeVisible({ timeout: 30_000 });

  // ---- Verify candidate was recorded in the database -------
  const { data: candidates } = await admin
    .from("customer_measurement_candidates")
    .select("id, decision, quality_signals, values")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(1);

  expect(candidates?.length).toBeGreaterThan(0);
  const candidate = candidates![0]!;

  // All 8 measurements should be recorded.
  const recordedValues = candidate.values as unknown as Array<{
    key: string;
    millimetres: number;
    capturedBy: string;
  }>;
  expect(recordedValues).toHaveLength(8);

  // Each value should be from "guided_self_scan".
  for (const value of recordedValues) {
    expect(value.capturedBy).toBe("guided_self_scan");
    // Millimetres should be whole numbers.
    expect(Number.isInteger(value.millimetres)).toBe(true);
  }

  // Quality signals should be synthetic always-passing values.
  const qualitySignals = candidate.quality_signals as unknown as {
    captureCount?: number;
    poseConfidence?: number;
    landmarksDetected?: number;
    landmarksExpected?: number;
    hasScaleReference?: boolean;
  };
  expect(qualitySignals.captureCount).toBe(1);
  expect(qualitySignals.poseConfidence).toBe(1);
  expect(qualitySignals.landmarksDetected).toBe(1);
  expect(qualitySignals.landmarksExpected).toBe(1);
  expect(qualitySignals.hasScaleReference).toBe(true);

  // The decision should be one of the three valid outcomes.
  expect(["no_action", "advisor_review", "remeasure"]).toContain(
    candidate.decision,
  );
});

/**
 * Verify the reorder gate shows correct status for both allowed and blocked
 * states. This test fixtures an advisor_review candidate to trigger the
 * blocked state.
 */
test("reorder gate status card shows allowed and blocked states", async ({
  page,
}) => {
  test.setTimeout(180_000);

  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const anonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]!;
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const proof = await ensureProgrammeProofSeed({
    supabaseUrl,
    anonKey,
    serviceRoleKey,
  });
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  // This test approves a measurement version, which is permanent by design
  // (customer_measurement_versions has no DELETE grant at all — an approved
  // version's id may already be pinned to a garment cut, per Stage 12.2 —
  // so it can never be cleaned up afterward). Reusing the shared programme-
  // proof-seed customer here would permanently pollute every other test
  // that expects that customer to have no approved measurements. Use a
  // fresh, dedicated customer instead.
  const testEmail = `e2e-measurement-reorder-${Date.now()}@paon.test`;
  const { data: authUser, error: authError } =
    await admin.auth.admin.createUser({
      email: testEmail,
      email_confirm: true,
    });
  if (authError || !authUser.user) {
    throw new Error(`Failed to create test customer: ${authError?.message}`);
  }
  const { data: createdCustomer, error: customerError } = await admin
    .from("customers")
    .insert({
      retailer_id: proof.retailerId,
      user_id: authUser.user.id,
      full_name: "E2E Reorder Gate Test Customer",
      email: testEmail,
      lifecycle_stage: "prospect",
    })
    .select("id")
    .single();
  if (customerError || !createdCustomer) {
    throw new Error(
      `Failed to create test customer record: ${customerError?.message}`,
    );
  }
  const customerId = createdCustomer.id;

  // First, verify the blocked state (no approved measurements).
  await signInCustomer(page, testEmail, admin);
  await page.goto("/measurements");

  await expect(
    page.getByText("Reorder blocked", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText(/don't have any approved measurements/i),
  ).toBeVisible();

  // Create an approved baseline so we can test the advisor_review block.
  const { data: manager } = await admin
    .from("retailer_staff_members")
    .select("id")
    .eq("retailer_id", proof.retailerId)
    .is("deleted_at", null)
    .limit(1)
    .single();

  await admin.from("customer_measurement_versions").insert({
    retailer_id: proof.retailerId,
    customer_id: customerId,
    version: 1,
    values: [
      { key: "chest", millimetres: 990, capturedBy: "tailor_tape" },
      { key: "waist", millimetres: 870, capturedBy: "tailor_tape" },
      { key: "sleeve_length", millimetres: 620, capturedBy: "tailor_tape" },
      { key: "shoulder", millimetres: 458, capturedBy: "tailor_tape" },
      { key: "jacket_length", millimetres: 752, capturedBy: "tailor_tape" },
      { key: "trouser_length", millimetres: 1071, capturedBy: "tailor_tape" },
      { key: "trouser_inseam", millimetres: 794, capturedBy: "tailor_tape" },
      { key: "hips", millimetres: 956, capturedBy: "tailor_tape" },
    ],
    approved_by_staff_id: manager!.id,
    review_note: "Baseline tape measurement.",
  });

  // Reload the page to see the allowed state.
  await page.reload();
  await expect(page.getByText("Clear to order", { exact: false })).toBeVisible({
    timeout: 30_000,
  });

  // Now create an unresolved advisor_review candidate to block reordering.
  await admin.from("customer_measurement_candidates").insert({
    retailer_id: proof.retailerId,
    customer_id: customerId,
    values: [
      { key: "chest", millimetres: 1010, capturedBy: "guided_self_scan" },
      { key: "waist", millimetres: 880, capturedBy: "guided_self_scan" },
      {
        key: "sleeve_length",
        millimetres: 620,
        capturedBy: "guided_self_scan",
      },
      { key: "shoulder", millimetres: 458, capturedBy: "guided_self_scan" },
      {
        key: "jacket_length",
        millimetres: 752,
        capturedBy: "guided_self_scan",
      },
      {
        key: "trouser_length",
        millimetres: 1071,
        capturedBy: "guided_self_scan",
      },
      {
        key: "trouser_inseam",
        millimetres: 794,
        capturedBy: "guided_self_scan",
      },
      { key: "hips", millimetres: 956, capturedBy: "guided_self_scan" },
    ],
    quality_passed: true,
    decision: "advisor_review",
    decision_version: 1,
    deltas: [{ key: "chest", deltaMillimetres: 20 }],
    rationale: "Chest moved 2 cm, needs advisor review.",
  });

  // Reload to see the blocked state (advisor_review pending).
  await page.reload();
  await expect(page.getByText("Reorder blocked", { exact: false })).toBeVisible(
    { timeout: 30_000 },
  );
  await expect(page.getByText(/measurements are under review/i)).toBeVisible();
});
