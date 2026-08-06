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

test("owner creates a service plan, enrolls a client, grants a credit, books, cares and records cost", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  await page.goto("/services");
  await expect(
    page.getByRole("heading", {
      name: "Preferred Tailoring & HighMaintenance",
    }),
  ).toBeVisible();

  // Unique per run — service_memberships.plan_id cascades on delete, so
  // deleting this plan in the finally block cleans up everything it owns
  // (entitlements, bookings, care and cost records).
  const planTitle = `E2E Preferred Tailoring ${Date.now()}`;

  try {
    // Create plan as draft, then activate.
    const createPlanSection = page.locator("section", {
      has: page.getByRole("heading", { name: "Create service plan" }),
    });
    await createPlanSection
      .getByLabel("Kind")
      .selectOption({ label: "Preferred Tailoring" });
    await createPlanSection.getByLabel("Status").selectOption("active");
    await createPlanSection.getByLabel("Title").fill(planTitle);
    await createPlanSection.getByLabel("Summary").fill("E2E summary.");
    await createPlanSection.getByLabel("Explanation").fill("E2E explanation.");
    await createPlanSection.getByRole("button", { name: "Save plan" }).click();

    const planRow = page.locator("li", { hasText: planTitle });
    await expect(planRow).toBeVisible();
    await expect(planRow.getByText("active")).toBeVisible();

    // Enroll a client on the newly active plan.
    const enrollSection = page.locator("section", {
      hasText: "Enroll client",
    });
    const planValue = await enrollSection
      .locator('select[name="planId"] option', { hasText: planTitle })
      .getAttribute("value");
    if (!planValue)
      throw new Error("Could not find the newly created plan's option");
    await enrollSection.getByLabel("Plan").selectOption(planValue);
    await enrollSection.getByLabel("Client").selectOption({ index: 0 });
    await page
      .getByRole("button", { name: "Open membership with default credits" })
      .click();

    // Scope to THIS test's own membership by its unique plan title —
    // other e2e runs (or a prior unfinished run) can leave behind other
    // "Preferred Tailoring" memberships for the same shared fixture
    // customer, and matching on the generic heading alone is ambiguous.
    // The "Plans" and "Enroll client" sections also mention the plan
    // title, so require the membership-detail heading too.
    const membershipSection = page
      .locator("section", {
        has: page.getByRole("heading", {
          name: "Preferred Tailoring",
          exact: true,
        }),
      })
      .filter({ hasText: planTitle });
    await expect(membershipSection).toBeVisible();

    // Grant a credit — default-seeded entitlements already show
    // similarly shaped "Kind: N" lines, so assert the credits list
    // actually changed rather than matching one specific line.
    const creditsList = membershipSection
      .locator("h3", { hasText: "Credits" })
      .locator("xpath=following-sibling::ul[1]");
    const creditsBefore = await creditsList.innerText();
    await membershipSection
      .getByRole("button", { name: "Grant credit" })
      .click();
    await expect.poll(() => creditsList.innerText()).not.toBe(creditsBefore);

    // Request a booking.
    await membershipSection
      .getByRole("button", { name: "Request booking" })
      .click();

    const bookingsSection = page.locator("section", {
      has: page.getByRole("heading", { name: "Open bookings" }),
    });
    await expect(bookingsSection.locator("li").first()).toBeVisible();

    // Record care. Shows up twice on success — once in "Care / repair"'s
    // own list, once in "Audit history" — so scope to the first.
    await membershipSection
      .getByPlaceholder("What was done")
      .fill("E2E pressing done.");
    await membershipSection
      .getByRole("button", { name: "Record care" })
      .click();
    await expect(
      membershipSection.getByText("E2E pressing done.").first(),
    ).toBeVisible();

    // Record an operational cost.
    await membershipSection
      .getByPlaceholder("Pressing labour")
      .fill("E2E labour");
    await membershipSection.getByPlaceholder("Cents").fill("500");
    await membershipSection
      .getByRole("button", { name: "Record cost" })
      .click();
    await expect(
      membershipSection.getByText("E2E labour: 5.00 EUR").first(),
    ).toBeVisible();
  } finally {
    await admin.from("service_plans").delete().eq("title", planTitle);
  }
});
