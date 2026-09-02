import { resolve } from "node:path";

import { createSupabaseAdminClient } from "@paon/database";
import { expect, test } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL, TEST_RETAILER_SLUG } from "./fixtures";

/**
 * PHASE 20.14 — Customer Loyalty V3, Rewards & Referrals exposure.
 *
 * Contract CUSTOMER_ENVIRONMENT_REBUILD_V3 §9: the "Rewards & Referrals"
 * destination renders the existing /loyalty implementation — the real
 * membership tier, points, milestones/badges, redeemable rewards and
 * referral invite — with a V3 page frame (kicker + heading) and no
 * second, duplicate rewards engine.
 */
test("the Rewards & Referrals page frames the real loyalty engine", async ({
  page,
}, testInfo) => {
  const evidencePath = (...parts: string[]) =>
    resolve(
      testInfo.config.rootDir,
      "../../../docs/evidence/runs/20.14-customer-loyalty-v3",
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

  const { data: retailer } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");
  await admin
    .from("loyalty_programs")
    .upsert(
      { retailer_id: retailer.id, enabled: true },
      { onConflict: "retailer_id" },
    );

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
  await page.goto("/loyalty");

  // The V3 page frame this slice adds.
  await expect(page.getByText("Membership", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Rewards & Referrals", exact: true }),
  ).toBeVisible();

  // Setup only: make sure the account exists so the real engine renders.
  const joinButton = page.getByRole("button", {
    name: "Join loyalty programme",
  });
  if (await joinButton.isVisible().catch(() => false)) {
    await joinButton.click();
  }

  // The real loyalty engine is what renders here — tier + badges + the
  // referral invite, not a second bespoke rewards surface.
  await expect(page.getByText("Badges", { exact: true })).toBeVisible();
  await expect(page.getByText("Introduce a friend")).toBeVisible();
  await expect(page.getByText(/house memory/i)).toHaveCount(0);

  expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);

  await page.screenshot({
    path: evidencePath("desktop-1512x982.png"),
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Rewards & Referrals", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: evidencePath("mobile-390x844.png"),
    fullPage: true,
  });

  expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
});
