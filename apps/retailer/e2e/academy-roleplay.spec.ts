import { createSupabaseAdminClient } from "@paon/database";
import { DEMO_PASSWORD } from "@paon/database/demo-seed";
import { ensureProgrammeProofSeed } from "@paon/database/programme-proof-seed";
import { PROGRAMME_PROOF_PERSONAS } from "@paon/domain";
import { expect, test, type Page } from "@playwright/test";

import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "16.1";
const PERSONA_PHASE_ITEM_ID = "17.8";
const BROWSER_PROOF_SPEC = "apps/retailer/e2e/academy-roleplay.spec.ts";

let proofPassed = false;

test.afterAll(async () => {
  await writeBrowserProofRun({
    phaseItemId: PHASE_ITEM_ID,
    spec: BROWSER_PROOF_SPEC,
    status: proofPassed ? "passed" : "failed",
  });
  // PHASE 17.8 layers a persona tag onto this exact grading loop rather
  // than a second one — same spec, same proof, a second evidence entry.
  await writeBrowserProofRun({
    phaseItemId: PERSONA_PHASE_ITEM_ID,
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

async function signOut(page: Page): Promise<void> {
  // Production has no Next overlay; force avoids intermittent portal intercepts.
  await page.getByRole("button", { name: "Sign out" }).click({ force: true });
  await expect(page).toHaveURL(/\/login/);
}

test("a manager grades an advisor's roleplay citing evidence, self-grading is refused, and the advisor sees the grade on their own page", async ({
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

  const { data: advisorStaff } = await admin
    .from("retailer_staff_members")
    .select("id, full_name")
    .eq("retailer_id", proof.retailerId)
    .eq("email", PROGRAMME_PROOF_PERSONAS.advisor.email)
    .single();
  if (!advisorStaff) throw new Error("advisor staff record missing");
  const { data: managerStaff } = await admin
    .from("retailer_staff_members")
    .select("id")
    .eq("retailer_id", proof.retailerId)
    .eq("email", PROGRAMME_PROOF_PERSONAS.manager.email)
    .single();
  if (!managerStaff) throw new Error("manager staff record missing");

  const unique = Date.now();
  const lessonKey = `e2e-fitting-consultation-${unique}`;
  const criterionKey = "opened-with-a-question";
  const evidenceRef = `roleplay-${unique}`;
  const observedBehaviour =
    "Asked the client what the occasion was before suggesting a single item.";

  await signIn(page, PROGRAMME_PROOF_PERSONAS.manager.email);
  await page.goto("/staff/learning");

  // ---- self-grading is refused before it can even be attempted ----------
  // The manager's own staff id is not offered as an option at all, so
  // there is no path to submitting a self-grade through the UI — the
  // repository's self_grading_not_permitted check is a second, deeper
  // line of defence, not the only one.
  await expect(
    page.locator(`#grade-staff option[value="${managerStaff.id}"]`),
  ).toHaveCount(0);

  // ---- a real grade, citing what was observed and where, tagged with a
  // real published persona (PHASE 17.8) -----------------------------------
  await page.locator("#grade-staff").selectOption(advisorStaff.id);
  await page.locator("#grade-lesson").fill(lessonKey);
  await page.locator("#grade-persona").selectOption("know_it_all");
  await page.locator("#grade-criterion").fill(criterionKey);
  await page.locator("#grade-evidence-ref").fill(evidenceRef);
  await page.locator("#grade-observed").fill(observedBehaviour);
  await page
    .locator("#grade-form")
    .getByRole("button", { name: "Record grade" })
    .click();
  await expect(page.getByText("Grade recorded.")).toBeVisible({
    timeout: 15_000,
  });

  const { data: gradeRows } = await admin
    .from("academy_roleplay_grades")
    .select(
      "id, staff_id, graded_by_staff_id, lesson_key, evidence, persona_key",
    )
    .eq("retailer_id", proof.retailerId)
    .eq("lesson_key", lessonKey);
  expect(gradeRows).toHaveLength(1);
  const grade = gradeRows![0]!;
  expect(grade.staff_id).toBe(advisorStaff.id);
  expect(grade.graded_by_staff_id).toBe(managerStaff.id);
  expect(grade.evidence).toEqual([
    { criterionKey, evidenceRef, observedBehaviour },
  ]);
  expect(grade.persona_key).toBe("know_it_all");

  // ---- the graded advisor sees it on their own page, cited in full,
  // including the real persona it was recorded against -------------------
  await signOut(page);
  await signIn(page, PROGRAMME_PROOF_PERSONAS.advisor.email);
  await page.goto("/staff/learning");
  const gradeRow = page.locator(`[data-grade-id="${grade.id}"]`);
  await expect(gradeRow).toBeVisible({ timeout: 15_000 });
  await expect(gradeRow).toContainText(lessonKey);
  await expect(gradeRow).toContainText("Know-it-all");
  await expect(gradeRow).toContainText(criterionKey);
  await expect(gradeRow).toContainText(observedBehaviour);
  await expect(gradeRow).toContainText(evidenceRef);

  // The advisor is not a manager, so the grading form is not offered to
  // them at all — grading is a manager action, not a peer action.
  await expect(page.locator("#grade-form")).toHaveCount(0);

  proofPassed = true;
});
