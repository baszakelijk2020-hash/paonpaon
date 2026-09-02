import { createSupabaseAdminClient } from "@paon/database";
import { seedDemoData } from "@paon/database/demo-seed";
import { expect, test } from "@playwright/test";

/**
 * PHASE 20.22: the customer wardrobe has no external-garment entry path.
 * `addExternalWardrobeItem` (apps/customer/app/(dashboard)/wardrobe/actions.ts)
 * was removed as dead code with no UI caller; product forbids external-garment
 * entry entirely (docs/plans/CUSTOMER_ENVIRONMENT_REBUILD_V3.md:15).
 */
test("the wardrobe page has no external-garment entry form, button, or copy", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const anonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error(
      "Wardrobe external-entry test requires local Supabase variables.",
    );
  }

  await seedDemoData({ supabaseUrl, anonKey, serviceRoleKey });
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: "contact+isabelle@nebelspiegel.com",
  });
  if (error || !data.properties) {
    throw error ?? new Error("Customer magic link is missing");
  }
  await page.goto(
    `/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`,
  );
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/wardrobe");
  await expect(page).toHaveURL(/\/wardrobe$/);

  // No external-garment entry form, button, or copy anywhere on the page.
  await expect(page.getByText(/add an external garment/i)).toHaveCount(0);
  await expect(page.getByText(/add a garment bought elsewhere/i)).toHaveCount(
    0,
  );
  await expect(page.getByLabel(/add external garment/i)).toHaveCount(0);
  await expect(page.locator('form[aria-label*="external" i]')).toHaveCount(0);

  // The real wardrobe UI (eight always-rendered rails) is still present —
  // proves this is a targeted removal, not a broken/empty page.
  await expect(page.locator("[data-wardrobe-rail]")).toHaveCount(8);
});
