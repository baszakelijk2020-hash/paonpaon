import {
  WeddingPartyRepository,
  createSupabaseAdminClient,
} from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL, TEST_RETAILER_SLUG } from "./fixtures";

test("the organizer sets a party-wide outfit choice", async ({ page }) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
  const partyRepo = new WeddingPartyRepository(admin);

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

  const party = await partyRepo.create({
    retailerId: asId<"RetailerId">(retailer.id),
    organizerCustomerId: asId<"CustomerId">(customerRow.id),
    venueName: "E2E Design Choice Venue",
  });

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

    await page.goto(`/wedding-parties/${party.id}`);
    const slot = `tie_color_${Date.now()}`;
    await page.getByPlaceholder("Slot (e.g. tie color)").fill(slot);
    await page.getByPlaceholder("Choice (e.g. burgundy)").fill("burgundy");
    await page.getByRole("button", { name: "Save choice" }).click();

    const choiceItem = page.locator("li", { hasText: slot });
    await expect(choiceItem).toBeVisible();
    await expect(choiceItem).toContainText("burgundy");
    await expect(choiceItem).toContainText("Whole party");

    const { data: rows } = await admin
      .from("wedding_design_choices")
      .select("slot_key, value_key, coordinated, wedding_party_member_id")
      .eq("wedding_party_id", party.id);
    expect(rows).toHaveLength(1);
    expect(rows?.[0]?.slot_key).toBe(slot);
    expect(rows?.[0]?.value_key).toBe("burgundy");
    expect(rows?.[0]?.coordinated).toBe(true);
    expect(rows?.[0]?.wedding_party_member_id).toBeNull();
  } finally {
    const { error: cleanupError } = await admin
      .from("wedding_parties")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", party.id);
    if (cleanupError) {
      console.error("wedding party cleanup failed:", cleanupError);
    }
  }
});
