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
