import {
  WeddingPartyRepository,
  createSupabaseAdminClient,
} from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL, TEST_RETAILER_SLUG } from "./fixtures";

test("the organizer proposes and finalizes a wedding date", async ({
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
    venueName: "E2E Date Agreement Venue",
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
    await page.locator('input[name="candidateDate"]').fill("2027-06-12");
    await page.getByRole("button", { name: "Propose date" }).click();

    const candidateItem = page.locator("li", { hasText: "Jun 12, 2027" });
    await expect(candidateItem).toBeVisible();

    await candidateItem.getByRole("button", { name: "Finalize" }).click();

    await expect(async () => {
      const { data: partyRow } = await admin
        .from("wedding_parties")
        .select("event_date")
        .eq("id", party.id)
        .single();
      expect(partyRow?.event_date).toBe("2027-06-12");
    }).toPass({ timeout: 10000 });

    const { data: candidateRows } = await admin
      .from("wedding_date_candidates")
      .select("id")
      .eq("wedding_party_id", party.id);
    expect(candidateRows).toHaveLength(1);
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
