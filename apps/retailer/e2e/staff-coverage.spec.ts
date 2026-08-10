import { createSupabaseAdminClient } from "@paon/database";
import { DEMO_PASSWORD } from "@paon/database/demo-seed";
import { ensureProgrammeProofSeed } from "@paon/database/programme-proof-seed";
import { PROGRAMME_PROOF_PERSONAS } from "@paon/domain";
import { expect, test, type Page } from "@playwright/test";

import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "11.3";
const BROWSER_PROOF_SPEC = "apps/retailer/e2e/staff-coverage.spec.ts";

let coveragePassed = false;
let availabilityPassed = false;

// Both tests write into the same two module-level flags, which only works
// if they run in one worker process. fullyParallel defaults to sharding
// even within a single file across workers, which would leave each
// worker's copy of the other test's flag permanently false and the
// combined evidence status wrongly "failed" even when both tests passed.
test.describe.configure({ mode: "serial" });

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  // 30s, not the 5s default. Sign-in is a round-trip to a database in
  // another region and has been observed taking longer than 5s here. A wait,
  // not a weakened assertion: the condition is still "we left /login".
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

test.afterAll(async () => {
  await writeBrowserProofRun({
    phaseItemId: PHASE_ITEM_ID,
    spec: BROWSER_PROOF_SPEC,
    status: coveragePassed && availabilityPassed ? "passed" : "failed",
  });
});

test("manager publishes coverage, reads a cited shortage, closes a coaching loop", async ({
  page,
}) => {
  // The seed is a long chain of round-trips to a database in another region;
  // see the note in completion-harness.spec.ts. This is a fixture budget,
  // not an assertion budget.
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

  // A colleague to observe. The manager cannot observe themselves — that
  // guard is real and firing it here would only re-prove 11.2's lesson — so
  // seed a second member with user_id null, which is the genuine state of an
  // invited-but-unaccepted person.
  const colleagueName = `Coverage Colleague ${Date.now()}`;
  const { data: colleague, error: colleagueError } = await admin
    .from("retailer_staff_members")
    .insert({
      retailer_id: proof.retailerId,
      full_name: colleagueName,
      role: "sales_associate",
      user_id: null,
      email: `coverage-colleague-${Date.now()}@example.com`,
    })
    .select("id")
    .single();
  expect(colleagueError).toBeNull();

  // A collision-free future date: the service-role table grant intentionally
  // omits DELETE, so pretending to clean up a fixed date left an old plan in
  // place while discarding the database error. This date remains far enough
  // out that no real appointment or shift can satisfy the requirement.
  const planDate = new Date(
    Date.UTC(2100, 0, 1) + (Date.now() % 100_000) * 86_400_000,
  )
    .toISOString()
    .slice(0, 10);

  /**
   * Waits for the coaching row to actually reach a state, reading the
   * `data-coaching-state` attribute rather than visible text.
   *
   * The first version of this proof polled innerText for "discussed" — which
   * is a substring of the button label "Mark as discussed", so the poll
   * passed on its first iteration BEFORE the write landed, and every later
   * step then acted on a stale page. Asserting on a machine-readable
   * attribute is the difference between a test that waits and a test that
   * only looks like it waits.
   */
  /**
   * Waits for the plan row to reach a state AND carry an interval count.
   *
   * The mistake this replaces: polling for "an interval exists" and then
   * asserting "Published". `saveDraftPlan` writes intervals BEFORE
   * `publishPlan` flips the state, so the poll succeeded while the row was
   * still a draft and the assertion raced the publish. Wait for the thing
   * you are about to assert, never for a proxy that lands earlier.
   */
  async function waitForPlan(
    expectedState: string,
    expectedIntervals: number,
  ): Promise<void> {
    await expect
      .poll(
        async () => {
          await page.goto(`/staff/coverage?date=${planDate}`);
          const list = page.locator("#coverage-intervals");
          if ((await list.count()) === 0) return "absent";
          return `${await list.getAttribute("data-plan-state")}:${await list.getAttribute("data-plan-interval-count")}`;
        },
        { timeout: 60_000 },
      )
      .toBe(`${expectedState}:${expectedIntervals}`);
  }

  async function waitForCoachingState(expected: string): Promise<void> {
    await expect
      .poll(
        async () => {
          await page.goto(`/staff/coverage?date=${planDate}`);
          return page
            .locator("#coaching-observations > li")
            .filter({ hasText: colleagueName })
            .first()
            .getAttribute("data-coaching-state");
        },
        { timeout: 60_000 },
      )
      .toBe(expected);
  }

  await signIn(page, PROGRAMME_PROOF_PERSONAS.manager.email);
  await page.goto(`/staff/coverage?date=${planDate}`);

  await expect(page.locator("#coverage-no-plan")).toBeVisible();

  // ---- publish a requirement ------------------------------------------
  await page.getByLabel("Date").fill(planDate);
  await page.getByLabel("morning headcount").fill("2");
  await page.getByLabel("afternoon headcount").fill("2");
  await page.getByLabel("Required skill (optional)").nth(1).fill("mtm_fitting");
  await page.getByRole("button", { name: "Publish coverage" }).click();

  // Server action writes succeed; the RSC soft-refresh is flaky under
  // Playwright, so reload and assert against persisted HTML.
  await waitForPlan("published", 2);

  await expect(page.locator("#coverage-intervals")).toContainText(
    "10:00–14:00",
  );
  await expect(page.locator("#coverage-intervals")).toContainText(
    "mtm_fitting",
  );

  // ---- a shortage, and its citations ----------------------------------
  // Nobody is rostered on this date, so both intervals are short. The
  // recommendation must still cite something: the degenerate no-shift case
  // is exactly where a black-box number would otherwise appear.
  const shortages = page.locator("#coverage-shortages > li");
  await expect(shortages.first()).toBeVisible();
  expect(await shortages.count()).toBeGreaterThanOrEqual(2);
  await expect(shortages.first()).toContainText("0 of 2 scheduled");
  await expect(shortages.first()).toContainText(`coverage_plan:${planDate}`);

  // The missing-skill shortage is reported separately from the headcount
  // one, rather than being folded into a single "afternoon is a problem".
  await expect(page.locator("#coverage-shortages")).toContainText(
    "missing mtm_fitting",
  );

  // ---- publishing twice replaces, never duplicates ---------------------
  await page.getByLabel("morning headcount").fill("3");
  await page.getByRole("button", { name: "Publish coverage" }).click();
  // One interval this time: the form re-renders with zeroed bands after the
  // reload, so only morning is submitted. That the count drops from 2 to 1
  // is itself the evidence that intervals are REPLACED rather than merged.
  await waitForPlan("published", 1);
  await expect(page.locator("#coverage-intervals")).toContainText("needs 3");

  const { data: planRows, error: planError } = await admin
    .from("coverage_plans")
    .select("id")
    .eq("retailer_id", proof.retailerId)
    .eq("plan_date", planDate);
  expect(planError).toBeNull();
  // One row, not two. This is the defect 20260801000015 fixed, asserted
  // through the actual UI path that triggered it.
  expect(planRows?.length).toBe(1);

  // ---- observation to coaching loop ------------------------------------
  await page.selectOption("select[name='observedStaffId']", {
    label: colleagueName,
  });
  await page
    .getByLabel("What you actually saw")
    .fill("Greeted by name and offered water before measuring.");
  await page.getByRole("button", { name: "Record observation" }).click();

  // Read the form's own error before polling. Without this, a server-side
  // refusal shows up only as an opaque 60s poll timeout, because every poll
  // iteration navigates away from the page carrying the message. Turning a
  // mute timeout into the actual reason is worth six lines.
  const submissionError = page
    .locator("form")
    .filter({ has: page.getByRole("button", { name: "Record observation" }) })
    .locator("[role=alert]");
  await page.waitForTimeout(2_000);
  if ((await submissionError.count()) > 0) {
    const text = (await submissionError.allInnerTexts()).join(" | ").trim();
    if (text.length > 0) {
      throw new Error(`Observation was refused by the server: ${text}`);
    }
  }

  // Wait for THIS colleague's row in the "observed" state, not merely for
  // "some observation exists". A count-based poll is satisfied by a leftover
  // row from an earlier spec in the same run, which is exactly how this
  // passed alone and failed in sequence. Fourth instance of the same
  // mistake in this proof: wait for the specific thing you are asserting.
  await waitForCoachingState("observed");

  const observation = page
    .locator("#coaching-observations > li")
    .filter({ hasText: colleagueName })
    .first();

  // A plan cannot be agreed before the observation has been discussed. The
  // UI only offers the next step, so the refusal is proven at the domain
  // layer via the repository's own guard rather than by clicking something
  // the page does not render.
  await expect(
    observation.getByRole("button", { name: "Mark as discussed" }),
  ).toBeVisible();
  await expect(
    observation.getByRole("button", { name: "Agree a plan" }),
  ).toHaveCount(0);

  await observation.getByRole("button", { name: "Mark as discussed" }).click();
  await waitForCoachingState("discussed");

  // Agreeing a plan with no action is refused with a readable reason.
  const discussed = page
    .locator("#coaching-observations > li")
    .filter({ hasText: colleagueName })
    .first();
  await discussed.getByRole("button", { name: "Agree a plan" }).click();
  await expect(
    discussed.getByText("A plan needs an action you both agreed."),
  ).toBeVisible();

  await discussed
    .locator("input[name='agreedAction']")
    .fill("Offer the loan garment when an alteration runs over a week.");
  await discussed.getByRole("button", { name: "Agree a plan" }).click();
  await waitForCoachingState("plan_agreed");

  const planned = page
    .locator("#coaching-observations > li")
    .filter({ hasText: colleagueName })
    .first();
  await planned
    .locator("input[name='outcomeNote']")
    .fill("Did it unprompted on the next two alterations.");
  await planned.getByRole("button", { name: "Record the outcome" }).click();
  await waitForCoachingState("outcome_recorded");

  // A closed loop offers no further step — the state machine has no exit
  // from outcome_recorded, and the page reflects that rather than showing a
  // button the server would refuse.
  const closed = page
    .locator("#coaching-observations > li")
    .filter({ hasText: colleagueName })
    .first();
  await expect(
    closed.getByRole("button", { name: "Record the outcome" }),
  ).toHaveCount(0);

  // ---- the database agrees with the page ------------------------------
  const { data: observationRows, error: observationError } = await admin
    .from("staff_coaching_observations")
    .select("state, agreed_action, outcome_note, observed_staff_id")
    .eq("retailer_id", proof.retailerId)
    .eq("observed_staff_id", colleague!.id);
  expect(observationError).toBeNull();
  expect(observationRows?.length).toBe(1);
  expect(observationRows?.[0]?.state).toBe("outcome_recorded");
  expect(observationRows?.[0]?.agreed_action).toContain("loan garment");
  expect(observationRows?.[0]?.outcome_note).toContain("unprompted");

  // ---- no shift was ever written --------------------------------------
  // The load-bearing claim of 11.3: publishing a requirement is not
  // rostering. Nothing in this journey may have created a shift.
  const { data: shiftRows, error: shiftError } = await admin
    .from("staff_shifts")
    .select("id")
    .eq("retailer_id", proof.retailerId)
    .eq("shift_date", planDate);
  expect(shiftError).toBeNull();
  expect(shiftRows?.length).toBe(0);

  coveragePassed = true;
});

test("a staff member declares their own availability", async ({ page }) => {
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

  // A future, collision-free effective date, same reasoning as the coverage
  // date above: the availability table has no per-run cleanup, so a fixed
  // date would accumulate rows across test runs and pollute the assertion.
  const effectiveOn = new Date(
    Date.UTC(2100, 0, 1) + (Date.now() % 100_000) * 86_400_000,
  )
    .toISOString()
    .slice(0, 10);

  await signIn(page, PROGRAMME_PROOF_PERSONAS.manager.email);
  await page.goto("/staff/coverage");

  await page.getByLabel("Effective from").fill(effectiveOn);
  await page.selectOption("select[name='weekday']", { label: "Wednesday" });
  await page.getByLabel("Start time").fill("09:00");
  await page.getByLabel("End time").fill("13:00");
  await page.selectOption("select[name='available']", { label: "Available" });
  await page.getByLabel("Note (optional)").fill("Prefers mornings.");
  await page.getByRole("button", { name: "Save availability" }).click();

  await expect
    .poll(
      async () => {
        await page.reload();
        return page.locator("#availability-declarations > li").count();
      },
      { timeout: 60_000 },
    )
    .toBeGreaterThan(0);

  const row = page
    .locator("#availability-declarations > li")
    .filter({ hasText: "Wednesday" })
    .first();
  await expect(row).toContainText("09:00–13:00");
  await expect(row).toContainText("available");
  await expect(row).toContainText("Prefers mornings.");
  await expect(row).toHaveAttribute("data-available", "true");

  // ---- the database agrees with the page ------------------------------
  const manager = await admin
    .from("retailer_staff_members")
    .select("id")
    .eq("retailer_id", proof.retailerId)
    .eq("email", PROGRAMME_PROOF_PERSONAS.manager.email)
    .single();
  expect(manager.error).toBeNull();

  const { data: declarationRows, error: declarationError } = await admin
    .from("staff_availability_declarations")
    .select("weekday, start_time, end_time, available, note, effective_on")
    .eq("retailer_id", proof.retailerId)
    .eq("staff_id", manager.data!.id)
    .eq("effective_on", effectiveOn);
  expect(declarationError).toBeNull();
  expect(declarationRows?.length).toBe(1);
  expect(declarationRows?.[0]?.weekday).toBe(3);
  expect(declarationRows?.[0]?.available).toBe(true);
  expect(declarationRows?.[0]?.note).toBe("Prefers mornings.");

  availabilityPassed = true;
});
