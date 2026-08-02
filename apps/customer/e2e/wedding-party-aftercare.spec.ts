import {
  WeddingPartyRepository,
  createSupabaseAdminClient,
} from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL, TEST_RETAILER_SLUG } from "./fixtures";

test("the organizer marks a delivery & pickup readiness instruction done", async ({
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
    venueName: "E2E Aftercare Venue",
  });
  const instruction = `Return rentals within 3 days ${Date.now()}`;
  const plan = await partyRepo.createAftercarePlan({
    retailerId: asId<"RetailerId">(retailer.id),
    weddingPartyId: party.id,
    instruction,
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
    await expect(page.getByText(instruction)).toBeVisible();
    // The organizer can always complete a party-wide plan, so they see
    // the action directly rather than a read-only "Pending" badge.
    await expect(page.getByRole("button", { name: "Mark done" })).toBeVisible();

    await page.getByRole("button", { name: "Mark done" }).click();
    await expect(page.getByText("Done", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark done" })).toHaveCount(
      0,
    );

    const { data: refreshed } = await admin
      .from("wedding_aftercare_plans")
      .select("completed_at")
      .eq("id", plan.id)
      .single();
    expect(refreshed?.completed_at).toBeTruthy();
  } finally {
    // wedding_parties has no DELETE grant for any role by design — the
    // product only ever soft-deletes (findByCustomer filters on
    // deleted_at, not status), matching FT-13's "removal preserves audit/
    // order obligations". Match that here rather than hard-deleting.
    const { error: cleanupError } = await admin
      .from("wedding_parties")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", party.id);
    if (cleanupError) {
      console.error("wedding party cleanup failed:", cleanupError);
    }
  }
});
