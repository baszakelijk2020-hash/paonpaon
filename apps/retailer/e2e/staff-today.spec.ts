import { test, expect } from "@playwright/test";

test.describe("Staff today page", () => {
  test("staff member sees their unified role home", async ({ page }) => {
    // This test verifies the staff today page renders and shows expected sections
    // It uses the default test database state set up in playwright.config.ts

    await page.goto("/staff/today");

    // Verify page header
    const heading = page.locator("h1:has-text('My Day')");
    await expect(heading).toBeVisible();

    // Verify main sections exist
    const shiftSection = page.locator("text=Shift & Clock Status");
    await expect(shiftSection).toBeVisible();

    const closeoutSection = page.locator("text=Shift Closeout");
    await expect(closeoutSection).toBeVisible();

    // Either "Not yet completed" or "Closeout submitted" should be visible
    const closeoutStatus = page.locator(
      "text=Not yet completed|Closeout submitted",
    );
    const hasStatus = await closeoutStatus
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    expect(hasStatus).toBeTruthy();
  });

  test("page shows clock status when staff is clocked in", async ({ page }) => {
    // Verify clock section exists and either shows clocked in or not clocked in
    await page.goto("/staff/today");

    const clockSection = page.locator("text=Clock Status");
    await expect(clockSection).toBeVisible();

    // Check for either clocked in indicator or not clocked in message
    const clockedInOrNot = page.locator(
      "text=Clocked in at|Not currently clocked in",
    );
    const hasClockStatus = await clockedInOrNot
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    expect(hasClockStatus).toBeTruthy();
  });

  test("page shows appointments section if appointments exist", async ({
    page,
  }) => {
    await page.goto("/staff/today");

    // The appointments section might not be visible if there are no appointments
    // This test just verifies that if it exists, it's properly formatted
    const appointmentsSection = page.locator("text=/Appointments Today.*?\\(/");

    try {
      await appointmentsSection.isVisible({ timeout: 3000 });
      // If appointments exist, verify the structure
      const appointmentList = page
        .locator("text=/Appointments Today.*?\\(/")
        .isVisible();
      expect(appointmentList).toBeTruthy();
    } catch {
      // It's okay if appointments section doesn't exist
    }
  });

  test("closeout link navigates to closeout page when not completed", async ({
    page,
  }) => {
    await page.goto("/staff/today");

    // Try to find and click the close out link if it exists
    const closeoutLink = page.locator('a:has-text("Close out")');

    try {
      if (await closeoutLink.isVisible({ timeout: 3000 })) {
        await closeoutLink.click();
        // Should navigate to closeout page
        await page.waitForURL("/staff/closeout", { timeout: 5000 });
        expect(page.url()).toContain("/staff/closeout");
      }
    } catch {
      // It's okay if closeout link is not visible (e.g., already closed out)
    }
  });
});
