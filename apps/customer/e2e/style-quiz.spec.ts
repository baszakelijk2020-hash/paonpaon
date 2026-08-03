import { createSupabaseAdminClient } from "@paon/database";
import { expect, test } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL, TEST_RETAILER_SLUG } from "./fixtures";

/**
 * The low-friction style quiz — tap an archetype, tap a few tweaks, done.
 * Every tap declares a real style preference through the existing
 * `upsert_declared_style_preference` RPC, so this proves the tap flow ends
 * up as a real, visible declared preference in Settings — not a separate
 * quiz-only answer store.
 */
test("tapping an archetype and a tweak declares real style preferences visible in Settings", async ({
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
  const { data: customerRow } = await admin
    .from("customers")
    .select("id")
    .eq("retailer_id", retailer.id)
    .eq("email", TEST_CUSTOMER_EMAIL)
    .maybeSingle();
  if (!customerRow) throw new Error("fixture customer missing");

  // Isolate this run from any prior partial quiz run under the shared
  // fixture customer.
  await admin
    .from("customer_style_profiles")
    .update({ explicit_preferences: [] })
    .eq("customer_id", customerRow.id);

  try {
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

    await page.goto("/style-quiz");
    await expect(
      page.getByText("Which of these feels most like you?"),
    ).toBeVisible();

    await page.getByRole("button", { name: /Classic Tailored/ }).click();
    await expect(page.getByText("Step 2 of")).toBeVisible();

    await page.getByRole("button", { name: "Regular" }).click();

    // Skip through the remaining tweak questions to reach completion.
    while (
      await page
        .getByRole("button", { name: "Skip this one" })
        .isVisible()
        .catch(() => false)
    ) {
      await page.getByRole("button", { name: "Skip this one" }).click();
    }
    await expect(page.getByText("Your style profile is set.")).toBeVisible();

    await page.goto("/account");
    const declaredSection = page.locator("section", {
      has: page.getByRole("heading", { name: "Declared preferences" }),
    });
    await expect(declaredSection.getByText("Classic Tailored")).toBeVisible();
    await expect(declaredSection.getByText("Regular")).toBeVisible();
  } finally {
    await admin
      .from("customer_style_profiles")
      .update({ explicit_preferences: [] })
      .eq("customer_id", customerRow.id);
  }
});
