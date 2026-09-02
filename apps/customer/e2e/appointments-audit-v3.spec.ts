import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { createSupabaseAdminClient } from "@paon/database";
import { expect, test, type Page } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL } from "./fixtures";

/**
 * Phase 20.6 (CENV-APPOINTMENTS-001) — My Appointments visual and flow audit.
 *
 * CUSTOMER_ENVIRONMENT_REBUILD_V3: My Appointments page must display the
 * canonical title "My Appointments", show four seasonal inspiration cards,
 * display appointment history in a collapsed state initially, and preserve
 * the existing real appointment booking flow. No paid-care QR, payment,
 * email, receipt, Mission Control, storefront, login, Overview, Wardrobe,
 * Orders, Profile, Rewards, auth, RLS, or migration changes.
 *
 * This spec exercises the full My Appointments experience: the landing page,
 * the seasonal suggestion cards, the collapsed history section (if any),
 * and the booking launchers. The real booking flow is verified separately
 * in appointments-booking-wizard-v3.spec.ts.
 *
 * Contract: PHASE.md item 20.6, REQUIREMENT_ID CENV-APPOINTMENTS-001.
 */

const EVIDENCE_SUBPATH =
  "../../../docs/evidence/runs/20.6-customer-appointments-audit";

function admin() {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
}

async function signIn(page: Page): Promise<void> {
  const { data, error } = await admin().auth.admin.generateLink({
    type: "magiclink",
    email: TEST_CUSTOMER_EMAIL,
  });
  if (error || !data.properties) {
    throw new Error(
      `Failed to generate magic link: ${error?.message ?? "unknown error"}`,
    );
  }
  await page.goto(
    `/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`,
  );
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe("My Appointments visual and flow audit", () => {
  test.describe("desktop (1512x982)", () => {
    test.use({ viewport: { width: 1512, height: 982 } });

    test("displays title, seasonal cards, collapsed history, and booking controls with no console errors", async ({
      page,
    }, testInfo) => {
      const evidenceDir = resolve(testInfo.config.rootDir, EVIDENCE_SUBPATH);
      await mkdir(evidenceDir, { recursive: true });

      const consoleErrors: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") consoleErrors.push(m.text());
      });
      page.on("pageerror", (e) =>
        consoleErrors.push(`pageerror: ${String(e)}`),
      );

      await signIn(page);
      const response = await page.goto("/appointments", {
        waitUntil: "networkidle",
      });
      expect(response?.status()).toBe(200);

      // ✓ My Appointments title is present
      await expect(
        page.getByRole("heading", { name: "My Appointments" }),
      ).toBeVisible();

      // ✓ Four seasonal inspiration cards exist and are visible
      const seasonalCards = [
        "Fall/Winter Wardrobe Appointment",
        "Spring/Summer 2027 Wardrobe Appointment",
        "Summer Holiday 2027 Wardrobe Appointment",
        "Holiday Season Look Appointment",
      ];

      for (const cardTitle of seasonalCards) {
        await expect(
          page.getByRole("button", { name: new RegExp(cardTitle, "i") }),
        ).toBeVisible();
      }

      // The seasonal cards section header is visible
      await expect(
        page.getByRole("heading", { name: "Suggestions to book" }),
      ).toBeVisible();

      // ✓ Book appointment button exists
      const bookAppointmentButton = page.getByRole("button", {
        name: "Book appointment",
        exact: true,
      });
      await expect(bookAppointmentButton).toBeVisible();

      // ✓ History is collapsed initially (if it exists)
      const historyDetails = page.locator("details");
      if (await historyDetails.isVisible().catch(() => false)) {
        const detailsElement = await historyDetails.elementHandle();
        if (detailsElement) {
          const isOpen = await page.evaluate((el) => {
            return (el as HTMLDetailsElement).open;
          }, detailsElement);
          // History should start collapsed
          expect(isOpen).toBe(false);
        }
      }

      // Take a screenshot showing the full page layout
      await page.screenshot({
        path: resolve(evidenceDir, "desktop-1512x982.png"),
        fullPage: true,
      });

      expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
    });
  });

  test.describe("mobile (390x844)", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("displays title, seasonal cards, collapsed history, and booking controls with no console errors", async ({
      page,
    }, testInfo) => {
      const evidenceDir = resolve(testInfo.config.rootDir, EVIDENCE_SUBPATH);
      await mkdir(evidenceDir, { recursive: true });

      const consoleErrors: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") consoleErrors.push(m.text());
      });
      page.on("pageerror", (e) =>
        consoleErrors.push(`pageerror: ${String(e)}`),
      );

      await signIn(page);
      const response = await page.goto("/appointments", {
        waitUntil: "networkidle",
      });
      expect(response?.status()).toBe(200);

      // ✓ My Appointments title is present
      await expect(
        page.getByRole("heading", { name: "My Appointments" }),
      ).toBeVisible();

      // ✓ Four seasonal inspiration cards exist and are visible
      const seasonalCards = [
        "Fall/Winter Wardrobe Appointment",
        "Spring/Summer 2027 Wardrobe Appointment",
        "Summer Holiday 2027 Wardrobe Appointment",
        "Holiday Season Look Appointment",
      ];

      for (const cardTitle of seasonalCards) {
        await expect(
          page.getByRole("button", { name: new RegExp(cardTitle, "i") }),
        ).toBeVisible();
      }

      // The seasonal cards section header is visible
      await expect(
        page.getByRole("heading", { name: "Suggestions to book" }),
      ).toBeVisible();

      // ✓ Book appointment button exists
      const bookAppointmentButton = page.getByRole("button", {
        name: "Book appointment",
        exact: true,
      });
      await expect(bookAppointmentButton).toBeVisible();

      // ✓ History is collapsed initially (if it exists)
      const historyDetails = page.locator("details");
      if (await historyDetails.isVisible().catch(() => false)) {
        const detailsElement = await historyDetails.elementHandle();
        if (detailsElement) {
          const isOpen = await page.evaluate((el) => {
            return (el as HTMLDetailsElement).open;
          }, detailsElement);
          // History should start collapsed
          expect(isOpen).toBe(false);
        }
      }

      // Take a screenshot showing the full page layout
      await page.screenshot({
        path: resolve(evidenceDir, "mobile-390x844.png"),
        fullPage: true,
      });

      expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
    });
  });
});
