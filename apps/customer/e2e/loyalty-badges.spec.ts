import { createSupabaseAdminClient } from "@paon/database";
import { expect, test } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL, TEST_RETAILER_SLUG } from "./fixtures";

/**
 * The Badges shelf on /loyalty is a visual read of the real
 * LoyaltyMilestoneAward data the text "Tailoring milestones" list already
 * shows — no new schema. This proves the default (nothing earned yet)
 * state renders all five built-in badges, each honestly labelled "Not yet"
 * rather than hidden or faked as earned.
 */
test("badges shelf shows all five built-in milestones, not-yet-earned by default", async ({
  page,
}) => {
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
  await page.goto(
    `/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`,
  );
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/loyalty");
  const joinButton = page.getByRole("button", {
    name: "Join loyalty programme",
  });
  if (await joinButton.isVisible().catch(() => false)) {
    await joinButton.click();
    await expect(page.getByText("Badges")).toBeVisible();
  }

  for (const label of [
    "First commission",
    "Return to the house",
    "New category explored",
    "Full-canvas craft",
    "Advanced cloth",
  ]) {
    const tile = page.locator("div", { hasText: label }).last();
    await expect(tile.getByText("Not yet")).toBeVisible();
  }
});
