import { resolve } from "node:path";

import { createSupabaseAdminClient } from "@paon/database";
import { expect, test } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL, TEST_RETAILER_SLUG } from "./fixtures";

/**
 * The Overview composes compact local context directly above the real daily
 * MorningRoutine OOTD. It must not duplicate the look inside the strip or
 * bring the old Overview-only Complete the Look module back.
 */
test("the dashboard composes local context directly above the real daily OOTD", async ({
  page,
}, testInfo) => {
  const evidencePath = (...parts: string[]) =>
    resolve(
      testInfo.config.rootDir,
      "../../../docs/evidence/runs/20.5-customer-overview",
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

  const localContext = page.getByText("Local context");
  const ootd = page.getByRole("region", { name: "Outfit of the day" });
  await expect(localContext).toBeVisible();
  await expect(ootd).toBeVisible();
  await expect(page.getByText("Complete the look")).toHaveCount(0);

  // At least one priced piece with a working Buy link into the real store.
  const buyControl = page.getByRole("link", { name: "Buy" }).first();
  await expect(buyControl).toBeVisible();
  const href = await buyControl.getAttribute("href");
  expect(href).toMatch(new RegExp(`/r/${TEST_RETAILER_SLUG}`));

  // Reloading does not silently reshuffle "today's look" underneath the
  // customer — same featured piece both times.
  const featuredHeading = page.getByRole("heading", { level: 1 });
  const firstLook = await featuredHeading.textContent();
  await page.reload();
  await expect(featuredHeading).toHaveText(firstLook ?? "");

  await page.setViewportSize({ width: 1512, height: 982 });
  await page.screenshot({
    path: evidencePath("desktop-1512x982.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: evidencePath("mobile-390x844.png"),
    fullPage: true,
  });
  expect(consoleErrors).toEqual([]);
});
