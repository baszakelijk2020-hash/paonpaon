import { expect, test } from "@playwright/test";

import { TEST_OWNER_EMAIL, TEST_OWNER_PASSWORD } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("owner adds a task to an existing alteration work order after intake", async ({
  page,
}) => {
  const unique = Date.now();

  await page.goto("/alterations/new");
  await page.getByLabel("Customer").selectOption({ index: 1 });
  await page.getByLabel("Garment type").fill("Navy two-piece suit");
  await page
    .getByLabel("Description")
    .fill("Customer-owned suit, jacket and trousers.");
  await page
    .getByLabel("Intake condition")
    .fill("Good condition, dry cleaned.");
  await page.getByLabel("Observation area").fill("Waist");
  await page
    .getByLabel("Observation", { exact: true })
    .fill("Waistband is snug.");
  await page.getByLabel("Work-now task").fill("Let out waistband");
  await page.getByRole("button", { name: "Create work order" }).click();
  await expect(page).toHaveURL(/\/alterations\/[0-9a-f-]+$/);

  await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
  await expect(
    page.locator("p.font-medium", { hasText: "Let out waistband" }),
  ).toBeVisible();

  const newTaskTitle = `Reline jacket collar ${unique}`;
  await page.getByLabel("New task title").fill(newTaskTitle);
  await page
    .getByLabel("New task instructions")
    .fill("Collar lining has worn through, replace with matching fabric.");
  await page
    .getByLabel("New task origin note")
    .fill("Spotted during a follow-up group fitting.");
  await page.getByRole("button", { name: "Add task" }).click();

  await expect(
    page.getByText(
      "Task added. Price it via a pricing proposal to add it to the total.",
    ),
  ).toBeVisible();

  const newTaskCard = page
    .locator("div.px-6.py-4", { hasText: newTaskTitle })
    .first();
  await expect(
    newTaskCard.locator("p.font-medium", { hasText: newTaskTitle }),
  ).toBeVisible();
  await expect(
    newTaskCard.getByText(
      "Collar lining has worn through, replace with matching fabric.",
    ),
  ).toBeVisible();
  await expect(newTaskCard.getByText("Now · Proposed")).toBeVisible();
  await expect(newTaskCard.getByText("Original quote 0 USD")).toBeVisible();
});
