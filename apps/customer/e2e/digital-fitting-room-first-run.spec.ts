import { resolve } from "node:path";

import { createSupabaseAdminClient } from "@paon/database";
import { expect, test } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL } from "./fixtures";

/**
 * The Digital Fitting Room first-run entry is one calm premium card: a short
 * invitation, the three real steps, and a single prominent "Start creating"
 * action. Choosing it must replace the entry with the real avatar/portrait
 * workflow rather than stacking another form beneath it.
 */
test("the Digital Fitting Room opens on one calm first-run card that leads into the real workflow", async ({
  page,
}, testInfo) => {
  const evidencePath = (...parts: string[]) =>
    resolve(
      testInfo.config.rootDir,
      "../../../docs/evidence/runs/20.7-digital-fitting-room",
      ...parts,
    );
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("requires local Supabase.");
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
  await page.goto(
    `/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`,
  );
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/digital-fitting-room");

  // One calm card: invitation, the three steps, one prominent action.
  const invitation = page.getByRole("heading", {
    name: "See a look take shape before you ask for it.",
  });
  await expect(invitation).toBeVisible();
  await expect(page.getByText("Create your digital portrait")).toBeVisible();
  await expect(page.getByText("Choose real pieces")).toBeVisible();
  await expect(page.getByText("Create a look")).toBeVisible();

  const startCreating = page.getByRole("link", { name: /Start creating/ });
  await expect(startCreating).toHaveCount(1);

  // One calm card, not the old split hero with its decorative wardrobe panel.
  await expect(page.getByText("Your wardrobe, in motion.")).toHaveCount(0);

  await page.setViewportSize({ width: 1512, height: 982 });
  await page.screenshot({
    path: evidencePath("desktop-first-run-1512x982.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: evidencePath("mobile-first-run-390x844.png"),
    fullPage: true,
  });

  // Starting replaces the entry step with the real workflow.
  await page.setViewportSize({ width: 1512, height: 982 });
  await startCreating.click();
  await expect(page).toHaveURL(/step=avatar/);
  await expect(invitation).toHaveCount(0);
  await expect(
    page.getByText("Upload two reference photos", { exact: false }),
  ).toBeVisible();

  await page.screenshot({
    path: evidencePath("desktop-avatar-step-1512x982.png"),
    fullPage: true,
  });

  expect(consoleErrors).toEqual([]);
});
