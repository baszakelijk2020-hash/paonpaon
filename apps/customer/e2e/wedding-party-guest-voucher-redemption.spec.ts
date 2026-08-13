import {
  WeddingPartyRepository,
  createSupabaseAdminClient,
} from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL, TEST_RETAILER_SLUG } from "./fixtures";

test("the organizer redeems a guest voucher for real, through the backend", async ({
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
    venueName: "E2E Guest Voucher Redemption Venue",
  });
  const voucher = await partyRepo.issueGuestVoucher({
    retailerId: asId<"RetailerId">(retailer.id),
    weddingPartyId: party.id,
    guestLabel: "E2E Redemption Guest",
    valueMinorUnits: 8000,
    currency: "EUR",
    fundingSource: "E2E gift fund",
    expiresOn: "2027-12-31",
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
    const voucherItem = page.locator("li", {
      hasText: "E2E Redemption Guest",
    });
    await expect(voucherItem).toBeVisible();
    await expect(
      voucherItem.getByRole("button", { name: "Redeem" }),
    ).toBeVisible();

    await voucherItem.getByRole("button", { name: "Redeem" }).click();

    // The badge only flips because the page reloaded off a real
    // revalidatePath after the server action committed — there is no
    // client-side optimistic update to fake this.
    await expect(voucherItem.getByText("Redeemed")).toBeVisible();
    await expect(
      voucherItem.getByRole("button", { name: "Redeem" }),
    ).toHaveCount(0);

    const { data: persisted } = await admin
      .from("wedding_guest_vouchers")
      .select("redeemed_at")
      .eq("id", voucher.id)
      .single();
    expect(persisted?.redeemed_at).not.toBeNull();
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
