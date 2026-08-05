import { createSupabaseAdminClient } from "@paon/database";
import { expect, test } from "@playwright/test";

import { TEST_OWNER_EMAIL, TEST_OWNER_PASSWORD } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("owner records fit-tool observations against a work order", async ({
  page,
}) => {
  await page.goto("/alterations/new");
  await page.getByLabel("Customer").selectOption({ index: 1 });
  await page.getByLabel("Garment type").fill("Grey herringbone waistcoat");
  await page
    .getByLabel("Description")
    .fill("Customer-owned waistcoat, three-piece suit.");
  await page
    .getByLabel("Intake condition")
    .fill("Good condition, no visible wear.");
  await page.getByLabel("Observation area").fill("Chest");
  await page
    .getByLabel("Observation", { exact: true })
    .fill("Chest is snug across the third button.");
  await page.getByLabel("Work-now task").fill("Let out chest 5 mm");
  await page.getByRole("button", { name: "Create work order" }).click();
  await expect(page).toHaveURL(/\/alterations\/[0-9a-f-]+$/);

  await expect(page.getByRole("heading", { name: "Fit tools" })).toBeVisible();

  // Voice slider: chip tap applies a value without needing speech input.
  const neigingRow = page.locator('[data-field="Neiging"]');
  await neigingRow.getByRole("button", { name: "+1.0" }).click();
  await expect(page.getByText("Observation recorded.")).toBeVisible();
  await expect(page.getByText("Neiging · +1.0")).toBeVisible();

  // Silhouette widget: switch tab, select the default (auto-active) panel.
  await page.getByRole("tab", { name: "Silhouette" }).click();
  await page.getByRole("button", { name: "Select S1" }).click();
  await expect(page.getByText("Observation recorded.")).toBeVisible();
  await expect(
    page.getByText("Silhouette · S1 — Full Mid-Section"),
  ).toBeVisible();
});

test("owner turns a fit-tool observation into a reviewable alteration task (FT-01)", async ({
  page,
}) => {
  await page.goto("/alterations/new");
  await page.getByLabel("Customer").selectOption({ index: 1 });
  await page.getByLabel("Garment type").fill("Charcoal wool trousers");
  await page
    .getByLabel("Description")
    .fill("Customer-owned trousers, single pleat.");
  await page
    .getByLabel("Intake condition")
    .fill("Good condition, freshly pressed.");
  await page.getByLabel("Observation area").fill("Waist");
  await page.getByLabel("Observation", { exact: true }).fill("Waist is snug.");
  await page.getByLabel("Work-now task").fill("Let out waist");
  await page.getByRole("button", { name: "Create work order" }).click();
  await expect(page).toHaveURL(/\/alterations\/[0-9a-f-]+$/);

  // Chip tap records a real fitting_observations row via the exact founder widget.
  const neigingRow = page.locator('[data-field="Neiging"]');
  await neigingRow.getByRole("button", { name: "+1.0" }).click();
  await expect(page.getByText("Observation recorded.")).toBeVisible();
  await expect(page.getByText("Neiging · +1.0")).toBeVisible();

  // The observation is not yet a task: no linkage line, but a one-click
  // "Add as task" form pre-filled from the observation's own area/value.
  // The intake step above already created its own unlinked "Waist"
  // observation/task pair, so scope to the Neiging row specifically.
  const neigingObservationRow = page
    .locator("div.py-2.text-sm", { hasText: "Neiging" })
    .first();
  const taskTitleInput = neigingObservationRow.getByLabel(
    "Task title for Neiging observation",
  );
  await expect(taskTitleInput).toHaveValue("Neiging: +1.0");
  await taskTitleInput.fill("Adjust drape per voice-slider reading");
  await neigingObservationRow
    .getByRole("button", { name: "Add as task" })
    .click();

  // Once linked, the observation's own row swaps the "Add as task" form for
  // a "Task: ..." line — the revalidated page no longer renders that form
  // at all, so this replacement (not a transient toast) is the confirmation.
  await expect(
    page.getByText("Task: Adjust drape per voice-slider reading"),
  ).toBeVisible();
  await expect(taskTitleInput).toHaveCount(0);

  const newTaskCard = page
    .locator("div.px-6.py-4", {
      hasText: "Adjust drape per voice-slider reading",
    })
    .first();
  await expect(
    newTaskCard.locator("p.font-medium", {
      hasText: "Adjust drape per voice-slider reading",
    }),
  ).toBeVisible();
  await expect(newTaskCard.getByText("+1.0")).toBeVisible();
  await expect(newTaskCard.getByText("Now · Proposed")).toBeVisible();
  await expect(newTaskCard.getByText("Original quote 0 USD")).toBeVisible();

  // The linkage survives a reload rather than being a client-only artifact.
  await page.reload();
  await expect(
    page.getByText("Task: Adjust drape per voice-slider reading"),
  ).toBeVisible();
});

test("advisor creates a fit profile candidate from observations and approves it (FT-01 candidate/version)", async ({
  page,
}) => {
  // Create an alteration work order with observations.
  await page.goto("/alterations/new");
  await page.getByLabel("Customer").selectOption({ index: 1 });
  // Capture the selected customer's own id (the <option> value) so the
  // later navigation targets this exact customer directly, rather than
  // guessing from list position — the customers list is shared with every
  // other parallel worker/spec, and a concurrently-created customer shifts
  // "most recent" out from under a position-based guess.
  const customerId = await page.getByLabel("Customer").inputValue();
  await page.getByLabel("Garment type").fill("Navy blazer");
  await page
    .getByLabel("Description")
    .fill("Customer-owned navy blazer, two-button.");
  await page
    .getByLabel("Intake condition")
    .fill("Excellent condition, minimal wear.");
  await page.getByLabel("Observation area").fill("Shoulders");
  await page
    .getByLabel("Observation", { exact: true })
    .fill("Shoulders are slightly loose.");
  await page.getByLabel("Work-now task").fill("Take in shoulders 3 mm");
  await page.getByRole("button", { name: "Create work order" }).click();
  await expect(page).toHaveURL(/\/alterations\/[0-9a-f-]+$/);

  // Record fit-tool observations.
  const neigingRow = page.locator('[data-field="Neiging"]');
  await neigingRow.getByRole("button", { name: "+0.5" }).click();
  await expect(page.getByText("Observation recorded.")).toBeVisible();
  await expect(page.getByText("Neiging · +0.5")).toBeVisible();

  const kraagRow = page.locator('[data-field="Kraag"]');
  await kraagRow.getByRole("button", { name: "-0.5" }).click();
  await expect(page.getByText("Observation recorded.")).toBeVisible();
  await expect(page.getByText("Kraag · -0.5")).toBeVisible();

  // Propose both observations as a reviewed fit profile candidate — the
  // advisor step is a deliberate action, not an automatic side effect of
  // recording an observation.
  await page
    .getByLabel("Include Neiging observation in fit profile proposal")
    .check();
  await page
    .getByLabel("Include Kraag observation in fit profile proposal")
    .check();
  await page
    .getByRole("button", { name: "Propose fit profile candidate" })
    .click();
  await expect(
    page.getByText(
      "Proposed. Visible on the customer's profile for advisor review.",
    ),
  ).toBeVisible();

  // Navigate directly to the same customer's detail page to review the
  // proposed fit profile candidate — using the id captured from the
  // "Customer" select above, not a position-based guess against the
  // shared customers list.
  await page.goto(`/customers/${customerId}`);
  await expect(page).toHaveURL(/\/customers\/[0-9a-f-]+$/);

  // Look for the fit profile candidate review card.
  // This should show pending candidates awaiting advisor review.
  await expect(
    page.getByRole("heading", { name: "Fit profile candidates" }),
  ).toBeVisible();

  const candidateCard = page
    .locator("li", { has: page.getByText("Awaiting your review") })
    .first();
  await expect(candidateCard).toBeVisible();
  // Both observations' values are folded into the proposed measurements.
  await expect(candidateCard.getByText("Neiging:")).toBeVisible();
  await expect(candidateCard.getByText("Kraag:")).toBeVisible();

  // Click approve button on the candidate. The write always completes
  // immediately, but this page does not reliably reflect it without a
  // reload (confirmed even with useActionState + an explicit
  // router.refresh() — see decideFitProfileCandidate's own comment); a
  // manual reload is the proof, not a transient client toast. Wait for
  // the mutating response itself before reloading — click() resolves
  // once the click dispatches, not once the underlying fetch completes,
  // and reloading before the write lands just reloads the pre-mutation
  // page.
  const decisionResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/customers/") &&
      response.request().method() === "POST",
  );
  await candidateCard.getByRole("button", { name: "Approve" }).click();
  await decisionResponse;
  await page.reload();
  const approvedCandidate = page
    .locator("li", {
      has: page.getByText("Approved — awaiting client confirmation"),
    })
    .first();
  await expect(approvedCandidate).toBeVisible();
});

test("fit profile candidate idempotency prevents duplicate-submit (FT-01 offline/recovery)", async ({
  page,
}) => {
  // This test verifies the idempotency guarantee when the same candidate
  // is submitted twice with the same idempotency key.
  // The database should only create one fit_profile_candidates row.

  // Create an alteration.
  await page.goto("/alterations/new");
  await page.getByLabel("Customer").selectOption({ index: 1 });
  await page.getByLabel("Garment type").fill("Grey wool suit jacket");
  await page.getByLabel("Description").fill("Customer-owned grey wool jacket.");
  await page.getByLabel("Intake condition").fill("Good condition.");
  await page.getByLabel("Observation area").fill("Chest");
  await page.getByLabel("Observation", { exact: true }).fill("Chest is snug.");
  await page.getByLabel("Work-now task").fill("Let out chest");
  await page.getByRole("button", { name: "Create work order" }).click();
  await expect(page).toHaveURL(/\/alterations\/[0-9a-f-]+$/);

  // Record an observation.
  const neigingRow = page.locator('[data-field="Neiging"]');
  await neigingRow.getByRole("button", { name: "+1.5" }).click();
  await expect(page.getByText("Observation recorded.")).toBeVisible();

  // Propose it once, then submit the exact same selection again — a real
  // duplicate-submit (double-click, or a retried request after a lost
  // response on a flaky connection). proposeFitProfileCandidate derives a
  // deterministic idempotency key from the garment + observation id set,
  // so both submits must resolve to the same underlying candidate row.
  const checkbox = page.getByLabel(
    "Include Neiging observation in fit profile proposal",
  );
  const proposeButton = page.getByRole("button", {
    name: "Propose fit profile candidate",
  });
  await checkbox.check();
  await proposeButton.click();
  await expect(
    page.getByText(
      "Proposed. Visible on the customer's profile for advisor review.",
    ),
  ).toBeVisible();

  await checkbox.check();
  await proposeButton.click();
  await expect(
    page.getByText(
      "Proposed. Visible on the customer's profile for advisor review.",
    ),
  ).toBeVisible();

  // The database, not just the UI, must show exactly one candidate row —
  // a client-side dedup could hide a real duplicate-insert bug. Scope by
  // this test's own garment/observation, not customer_id: every test in
  // this file shares the same fixture customer (all select dropdown
  // index 1), so a customer-scoped query would also catch candidates the
  // other tests in this file created.
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
  const alterationId = page.url().match(/\/alterations\/([0-9a-f-]+)/)?.[1];
  if (!alterationId) throw new Error("Could not read alteration id from URL");
  const { data: workOrder, error: workOrderError } = await admin
    .from("alteration_work_orders")
    .select("physical_garment_id")
    .eq("id", alterationId)
    .single();
  if (workOrderError) throw workOrderError;
  const { data: observations, error: observationsError } = await admin
    .from("fitting_observations")
    .select("id")
    .eq("physical_garment_id", workOrder.physical_garment_id);
  if (observationsError) throw observationsError;
  const { data: links, error: linksError } = await admin
    .from("fit_profile_candidate_observations")
    .select("fit_profile_candidate_id")
    .in(
      "fitting_observation_id",
      observations.map((observation) => observation.id),
    );
  if (linksError) throw linksError;
  const uniqueCandidateIds = new Set(
    links.map((link) => link.fit_profile_candidate_id),
  );
  expect(uniqueCandidateIds.size).toBe(1);
});
