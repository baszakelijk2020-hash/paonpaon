import { createSupabaseAdminClient } from "@paon/database";
import { DEMO_PASSWORD } from "@paon/database/demo-seed";
import { ensureProgrammeProofSeed } from "@paon/database/programme-proof-seed";
import { PROGRAMME_PROOF_PERSONAS } from "@paon/domain";
import { expect, test, type Page } from "@playwright/test";

import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "12.1";
const BROWSER_PROOF_SPEC = "apps/retailer/e2e/measurement-monitor.spec.ts";

let proofPassed = false;
/**
 * Candidates this spec created. An unresolved `advisor_review` candidate
 * BLOCKS a reorder for that customer by design, so one left behind by a
 * failed run is not inert debris — it fails unrelated suites later and looks
 * like their bug. The spec that created it removes it.
 */
const createdCandidateIds: string[] = [];

test.afterAll(async () => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (supabaseUrl && serviceRoleKey && createdCandidateIds.length > 0) {
    const cleanup = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
    await cleanup
      .from("customer_measurement_candidates")
      .delete()
      .in("id", createdCandidateIds);
  }

  await writeBrowserProofRun({
    phaseItemId: PHASE_ITEM_ID,
    spec: BROWSER_PROOF_SPEC,
    status: proofPassed ? "passed" : "failed",
  });
});

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

/**
 * The MeasurementMonitor decision gate (PHASE 12.1).
 *
 * The rule that matters: a measurement derived from a customer's own phone
 * scan may become the approved record ONLY with a written decision from a
 * human. A garment is cut to these numbers; "the app said so" is not a
 * reason anyone can stand behind afterwards.
 */
test("an advisor cannot approve a self-scan measurement without writing why", async ({
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

  const { data: customer } = await admin
    .from("customers")
    .select("id")
    .eq("retailer_id", proof.retailerId)
    .is("deleted_at", null)
    .limit(1)
    .single();
  const customerId = customer!.id;

  // A candidate whose values came from a guided self-scan. `capturedBy` is
  // what makes the note mandatory, so it is the whole point of the fixture.
  const { data: candidate, error: candidateError } = await admin
    .from("customer_measurement_candidates")
    .insert({
      retailer_id: proof.retailerId,
      customer_id: customerId,
      values: [
        { key: "chest", millimetres: 1010, capturedBy: "guided_self_scan" },
        { key: "waist", millimetres: 880, capturedBy: "guided_self_scan" },
      ],
      quality_passed: true,
      decision: "advisor_review",
      decision_version: 1,
      deltas: [{ key: "chest", deltaMillimetres: 20 }],
      rationale:
        "Chest moved 2 cm against the approved record, which needs a human decision.",
    })
    .select("id")
    .single();
  expect(candidateError).toBeNull();
  const candidateId = candidate!.id;
  createdCandidateIds.push(candidateId);

  await signIn(page, PROGRAMME_PROOF_PERSONAS.manager.email);
  await page.goto("/staff/measurements");

  // The queue exists and this candidate is in it, with its decision legible
  // rather than an internal enum.
  const row = page.locator(`[data-candidate-id="${candidateId}"]`);
  await expect(row).toBeVisible({ timeout: 30_000 });
  await expect(row).toHaveAttribute("data-decision", "advisor_review");

  const { data: beforeAnything } = await admin
    .from("customer_measurement_versions")
    .select("id")
    .eq("customer_id", customerId);
  const versionsBefore = beforeAnything?.length ?? 0;

  // ---- an empty note cannot even be submitted --------------------------
  // The field is `required` because the values came from a self-scan, so the
  // browser refuses before the request leaves. Asserting the SERVER message
  // here would be asserting something unreachable.
  await row.locator(`#reviewNote-${candidateId}`).fill("");
  await row
    .getByRole("button", { name: "Record approved measurements" })
    .click();
  await expect(row.locator(`#reviewNote-${candidateId}`)).toBeVisible();
  expect(
    await row
      .locator(`#reviewNote-${candidateId}`)
      .evaluate((el: HTMLInputElement) => el.validity.valueMissing),
  ).toBe(true);

  // ---- and a note of only spaces is refused by the SERVER --------------
  // This is the guarantee that matters: `required` is a courtesy the client
  // can be made to skip, so the rule has to hold behind it too. Spaces
  // satisfy the browser and are still not a decision anyone can read.
  await row.locator(`#reviewNote-${candidateId}`).fill("   ");
  await row
    .getByRole("button", { name: "Record approved measurements" })
    .click();
  await expect(
    row.getByText("A review note is required", { exact: false }),
  ).toBeVisible({ timeout: 30_000 });

  // Nothing was approved by either refusal.
  const { data: afterRefusal } = await admin
    .from("customer_measurement_versions")
    .select("id")
    .eq("customer_id", customerId);
  expect(afterRefusal?.length ?? 0).toBe(versionsBefore);

  // ---- a sub-millimetre value is refused too ---------------------------
  // Millimetres are whole numbers. A tailor working to a twentieth of a
  // millimetre is recording precision the tape never had, and the input's
  // 0.1 cm step refuses it before the request is even made. The server holds
  // the same line behind that (proven in the domain unit tests), which is why
  // the client step is a courtesy rather than the guarantee.
  await page.goto("/staff/measurements");
  const rowAgain = page.locator(`[data-candidate-id="${candidateId}"]`);
  const chest = rowAgain.locator(`#measurement_0_mm-${candidateId}`);
  await chest.fill("101.05");
  await rowAgain
    .locator(`#reviewNote-${candidateId}`)
    .fill("Checked against the tape myself, chest is genuinely up.");
  await rowAgain
    .getByRole("button", { name: "Record approved measurements" })
    .click();
  expect(
    await chest.evaluate((el: HTMLInputElement) => el.validity.stepMismatch),
  ).toBe(true);
  // Still on the form, nothing recorded.
  await expect(chest).toBeVisible();

  // ---- with a written decision it lands --------------------------------
  await page.goto("/staff/measurements");
  const rowFinal = page.locator(`[data-candidate-id="${candidateId}"]`);
  await rowFinal.locator(`#measurement_0_mm-${candidateId}`).fill("101");
  await rowFinal
    .locator(`#reviewNote-${candidateId}`)
    .fill(
      "Re-measured with the tape at the second fitting; the 2 cm is real, client has gained weight.",
    );
  await rowFinal
    .getByRole("button", { name: "Record approved measurements" })
    .click();

  // The candidate leaves the queue, because it has been dealt with.
  await expect
    .poll(
      async () => {
        await page.goto("/staff/measurements");
        return page.locator(`[data-candidate-id="${candidateId}"]`).count();
      },
      { timeout: 60_000 },
    )
    .toBe(0);

  // ---- the database agrees, and the reasoning survives -----------------
  const { data: versions } = await admin
    .from("customer_measurement_versions")
    .select("id, version, review_note, values")
    .eq("customer_id", customerId)
    .order("version", { ascending: false });
  expect(versions?.length ?? 0).toBeGreaterThan(versionsBefore);

  const latest = versions![0]!;
  // The written decision is stored, not just required at the door. A number
  // a garment gets cut to has to stay explicable months later.
  expect(latest.review_note).toContain("Re-measured with the tape");
  expect(latest.review_note).toContain("gained weight");

  // And it is a NEW version rather than an edit of the old one, so the
  // measurements a garment was already cut to still exist.
  expect(latest.version).toBeGreaterThan(1);

  // The candidate is resolved, which is what unblocks the reorder gate.
  const { data: resolved } = await admin
    .from("customer_measurement_candidates")
    .select("resolved_at")
    .eq("id", candidateId)
    .single();
  expect(resolved!.resolved_at).not.toBeNull();

  proofPassed = true;
});

test("a remeasure candidate stays out of the advisor review queue", async ({
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

  const { data: customer } = await admin
    .from("customers")
    .select("id")
    .eq("retailer_id", proof.retailerId)
    .is("deleted_at", null)
    .limit(1)
    .single();

  // A 21 cm jump is a bad scan, not a body change: the monitor asks for a
  // remeasure rather than putting it in front of an advisor to approve.
  // Pinned deliberately — this queue is for decisions a human must MAKE, and
  // filling it with scans that simply need redoing is how a review queue
  // stops being read.
  const { data: candidate } = await admin
    .from("customer_measurement_candidates")
    .insert({
      retailer_id: proof.retailerId,
      customer_id: customer!.id,
      values: [
        { key: "chest", millimetres: 1200, capturedBy: "guided_self_scan" },
      ],
      quality_passed: false,
      decision: "remeasure",
      decision_version: 1,
      deltas: [{ key: "chest", deltaMillimetres: 210 }],
      rationale: "A 21 cm jump is a bad scan, not a body change.",
    })
    .select("id")
    .single();
  createdCandidateIds.push(candidate!.id);

  await signIn(page, PROGRAMME_PROOF_PERSONAS.manager.email);
  await page.goto("/staff/measurements");
  // The page is identified by its heading, not by the queue element: the
  // queue only renders when something is IN it, so requiring it here makes
  // this assertion depend on whatever other candidates happen to exist.
  await expect(
    page.getByRole("heading", { name: "Measurement reviews" }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    page.locator(`[data-candidate-id="${candidate!.id}"]`),
  ).toHaveCount(0);
});

test("a candidate can be dismissed without changing the approved record", async ({
  page,
}) => {
  test.setTimeout(240_000);

  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const anonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]!;
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const proof = await ensureProgrammeProofSeed({
    supabaseUrl,
    anonKey,
    serviceRoleKey,
  });
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  const { data: customer } = await admin
    .from("customers")
    .select("id")
    .eq("retailer_id", proof.retailerId)
    .is("deleted_at", null)
    .limit(1)
    .single();
  const customerId = customer!.id;

  const { data: candidate } = await admin
    .from("customer_measurement_candidates")
    .insert({
      retailer_id: proof.retailerId,
      customer_id: customerId,
      values: [
        { key: "chest", millimetres: 1200, capturedBy: "guided_self_scan" },
      ],
      quality_passed: true,
      decision: "advisor_review",
      decision_version: 1,
      deltas: [{ key: "chest", deltaMillimetres: 15 }],
      rationale: "A 1.5 cm change needs a human to decide, either way.",
    })
    .select("id")
    .single();
  const candidateId = candidate!.id;
  createdCandidateIds.push(candidateId);

  const { data: before } = await admin
    .from("customer_measurement_versions")
    .select("id")
    .eq("customer_id", customerId);
  const countBefore = before?.length ?? 0;

  await signIn(page, PROGRAMME_PROOF_PERSONAS.manager.email);
  await page.goto("/staff/measurements");

  const row = page.locator(`[data-candidate-id="${candidateId}"]`);
  await expect(row).toBeVisible({ timeout: 30_000 });
  // The queue says what the monitor thought.
  await expect(row).toHaveAttribute("data-decision", "advisor_review");

  // Dismissing needs no note, because it changes nothing.
  await row
    .getByRole("button", { name: "Dismiss without changing measurements" })
    .click();

  await expect
    .poll(
      async () => {
        await page.goto("/staff/measurements");
        return page.locator(`[data-candidate-id="${candidateId}"]`).count();
      },
      { timeout: 60_000 },
    )
    .toBe(0);

  // No new approved version: a bad scan must not silently become the record.
  const { data: after } = await admin
    .from("customer_measurement_versions")
    .select("id")
    .eq("customer_id", customerId);
  expect(after?.length ?? 0).toBe(countBefore);

  const { data: resolved } = await admin
    .from("customer_measurement_candidates")
    .select("resolved_at")
    .eq("id", candidateId)
    .single();
  expect(resolved!.resolved_at).not.toBeNull();
});
