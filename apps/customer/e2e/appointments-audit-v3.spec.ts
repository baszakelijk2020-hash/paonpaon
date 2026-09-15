import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { createSupabaseAdminClient } from "@paon/database";
import { expect, test, type Page } from "@playwright/test";

import { AUTH_DELIVERABLE_DOMAIN, TEST_CUSTOMER_EMAIL } from "./fixtures";

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
  const deliverableEmail = `e2e-shopper@${AUTH_DELIVERABLE_DOMAIN}`;
  const client = admin();
  const { data: customerRow } = await client
    .from("customers")
    .select("id")
    .eq("email", TEST_CUSTOMER_EMAIL)
    .limit(1);

  if (customerRow && customerRow.length > 0) {
    const customer = customerRow[0] as { id: string };
    await client
      .from("customers")
      .update({ email: deliverableEmail })
      .eq("id", customer.id);
  }

  const { data, error } = await client.auth.admin.generateLink({
    type: "magiclink",
    email: deliverableEmail,
  });
  if (error || !data.properties) {
    throw new Error(
      `Failed to generate magic link: ${error?.message ?? "unknown error"}`,
    );
  }
  await page.goto(
    `/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`,
    { waitUntil: "domcontentloaded" },
  );
  await expect(page).toHaveURL(/\/dashboard$/);
}

function expectedRollingMonths(): string[] {
  const now = new Date();
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() + index, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });
}

test.describe("Appointments rolling-year audit", () => {
  test.describe("desktop (1512x982)", () => {
    test.use({ viewport: { width: 1512, height: 982 } });

    test("shows 12 chronological months in a four-column above-fold planning board", async ({
      page,
    }, testInfo) => {
      const evidenceDir = resolve(testInfo.config.rootDir, EVIDENCE_SUBPATH);
      await mkdir(evidenceDir, { recursive: true });
      await signIn(page);
      const consoleErrors: string[] = [];
      page.on("console", (message) => {
        if (
          message.type() === "error" &&
          !message.text().startsWith("Failed to load resource:")
        ) {
          consoleErrors.push(message.text());
        }
      });
      page.on("pageerror", (error) =>
        consoleErrors.push(`pageerror: ${String(error)}`),
      );
      const response = await page.goto("/appointments", {
        waitUntil: "networkidle",
      });
      expect(response?.status()).toBe(200);
      await expect(
        page.getByRole("heading", { name: "Appointments", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Book appointment", exact: true }),
      ).toBeVisible();

      const monthCells = page.locator("[data-appointment-month]");
      await expect(monthCells).toHaveCount(12);
      expect(
        await monthCells.evaluateAll((cells) =>
          cells.map((cell) => cell.getAttribute("data-appointment-month")),
        ),
      ).toEqual(expectedRollingMonths());

      const calendarColumns = await page
        .locator(".appointment-year-grid")
        .evaluate(
          (element) =>
            getComputedStyle(element).gridTemplateColumns.split(" ").length,
        );
      expect(calendarColumns).toBe(4);
      const lastCellBottom = await monthCells
        .last()
        .evaluate((element) => element.getBoundingClientRect().bottom);
      expect(lastCellBottom).toBeLessThanOrEqual(982);

      const careButtons = page.locator(
        ".appointment-care-actions .pe-care-service",
      );
      await expect(careButtons).toHaveCount(3);
      expect(
        await careButtons.evaluateAll((buttons) =>
          buttons.map((button) => {
            const label = button.querySelector(".pe-care-service-label");
            return label
              ? getComputedStyle(label, "::after").content.replaceAll('"', "")
              : "";
          }),
        ),
      ).toEqual(["Dry cleaning", "Shoe repair & maintenance", "Alterations"]);

      await page.screenshot({
        path: resolve(evidenceDir, "desktop-1512x982.png"),
        fullPage: true,
      });
      expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
    });
  });

  test.describe("mobile (390x844)", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("keeps all month and care launchers usable without console errors", async ({
      page,
    }, testInfo) => {
      const evidenceDir = resolve(testInfo.config.rootDir, EVIDENCE_SUBPATH);
      await mkdir(evidenceDir, { recursive: true });
      await signIn(page);
      const consoleErrors: string[] = [];
      page.on("console", (message) => {
        if (
          message.type() === "error" &&
          !message.text().startsWith("Failed to load resource:")
        ) {
          consoleErrors.push(message.text());
        }
      });
      page.on("pageerror", (error) =>
        consoleErrors.push(`pageerror: ${String(error)}`),
      );
      await page.goto("/appointments", { waitUntil: "networkidle" });
      const monthCells = page.locator("[data-appointment-month]");
      await expect(monthCells).toHaveCount(12);
      await expect(monthCells.first()).toBeVisible();
      await expect(monthCells.last()).toBeVisible();
      await expect(
        page.locator(".appointment-care-actions .pe-care-service"),
      ).toHaveCount(3);

      await page.screenshot({
        path: resolve(evidenceDir, "mobile-390x844.png"),
        fullPage: true,
      });
      expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
    });
  });
});
