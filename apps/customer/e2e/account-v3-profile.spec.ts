import { resolve } from "node:path";

import { createSupabaseAdminClient } from "@paon/database";
import { expect, test } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL, TEST_RETAILER_DISPLAY_NAME } from "./fixtures";

/**
 * PHASE 20.13 — Customer Profile V3, cleanup and clarification.
 *
 * Contract CUSTOMER_ENVIRONMENT_REBUILD_V3 §9: Profile keeps only the
 * account preferences. The customer-facing House Memory panel and all
 * "House Memory" copy, the style-discovery quiz, and Style Portrait /
 * avatar setup are gone from Profile (style discovery lives in Wardrobe,
 * portrait setup in the Digital Fitting Room).
 */
test("the profile page shows only account preferences — no House Memory, quiz, or portrait setup", async ({
  page,
}, testInfo) => {
  const evidencePath = (...parts: string[]) =>
    resolve(
      testInfo.config.rootDir,
      "../../../docs/evidence/runs/20.13-customer-profile-v3",
      ...parts,
    );

  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: TEST_CUSTOMER_EMAIL,
  });
  if (error || !data.properties) {
    throw new Error(
      `Failed to generate magic link: ${error?.message ?? "unknown error"}`,
    );
  }

  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto(
    `/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`,
  );
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/account");

  await expect(
    page
      .getByRole("heading", { name: TEST_RETAILER_DISPLAY_NAME, exact: true })
      .first(),
  ).toBeVisible();

  // The legitimate profile content stays.
  await expect(page.getByLabel("Preferred language")).toBeVisible();
  await expect(page.getByLabel("Preferred currency")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("SMS")).toBeVisible();
  await expect(page.getByLabel("Style notes")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save preferences" }),
  ).toBeVisible();

  // §9 removals — none of these may appear on Profile.
  await expect(page.getByText(/house memory/i)).toHaveCount(0);
  await expect(page.getByText(/style quiz/i)).toHaveCount(0);
  await expect(page.getByText(/style portrait/i)).toHaveCount(0);
  await expect(page.getByText(/remove inference/i)).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: /take the .*style quiz/i }),
  ).toHaveCount(0);
  await expect(page.locator('a[href="/style-quiz"]')).toHaveCount(0);

  expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);

  await page.screenshot({
    path: evidencePath("desktop-1512x982.png"),
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByLabel("Style notes")).toBeVisible();
  await page.screenshot({
    path: evidencePath("mobile-390x844.png"),
    fullPage: true,
  });

  expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
});
