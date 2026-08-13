import {
  WeddingPartyRepository,
  createSupabaseAdminClient,
} from "@paon/database";
import { asId } from "@paon/domain";
import { formatDate } from "@paon/utils";
import { expect, test } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL, TEST_RETAILER_SLUG } from "./fixtures";

test("the organizer sees a real anniversary derived from the party's own event date", async ({
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

  // Three years ago, same month/day as today: nextAnniversary should
  // project straight back to today's date with yearsSince === 3 — proof
  // the UI is deriving the value from the party's real eventDate rather
  // than showing a fixed/optimistic label.
  const today = new Date();
  const threeYearsAgo = new Date(today);
  threeYearsAgo.setUTCFullYear(today.getUTCFullYear() - 3);
  const eventDate = threeYearsAgo.toISOString().slice(0, 10);
  const expectedOccursOn = formatDate(
    today.toISOString().slice(0, 10),
    "en-US",
  );

  const party = await partyRepo.create({
    retailerId: asId<"RetailerId">(retailer.id),
    organizerCustomerId: asId<"CustomerId">(customerRow.id),
    venueName: "E2E Anniversary Venue",
    eventDate,
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
    const anniversaryCard = page.locator("text=Next anniversary").locator("..");
    await expect(anniversaryCard).toBeVisible();
    await expect(anniversaryCard).toContainText(expectedOccursOn);
    await expect(anniversaryCard).toContainText("3 years married");
  } finally {
    // wedding_parties has no DELETE grant for any role by design — see
    // wedding-party-aftercare.spec.ts for the same pattern/rationale.
    const { error: cleanupError } = await admin
      .from("wedding_parties")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", party.id);
    if (cleanupError) {
      console.error("wedding party cleanup failed:", cleanupError);
    }
  }
});
