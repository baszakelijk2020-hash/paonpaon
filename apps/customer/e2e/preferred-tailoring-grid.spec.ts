import { createSupabaseAdminClient, WardrobeRepository } from "@paon/database";
import { expect, test } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL, TEST_RETAILER_SLUG } from "./fixtures";

/**
 * FT-14 monthly grid: the customer's entry surface for Preferred Tailoring
 * is a current-month calendar where days with real care due (from
 * `get_my_service_care_status()`, the same projection `/services` uses)
 * carry the garment's name and link into `/services` — the existing
 * weekly/agenda orchestration, not a decorative separate screen.
 */
test("a customer sees this month's grid with a day linking care due to Services", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
  const unique = Date.now();

  const { data: retailer } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");
  const { data: customer } = await admin
    .from("customers")
    .select("id")
    .eq("retailer_id", retailer.id)
    .eq("email", TEST_CUSTOMER_EMAIL)
    .single();
  if (!customer) throw new Error("fixture customer missing");

  const wardrobeItem = await new WardrobeRepository(admin).createExternalItem({
    retailerId: retailer.id,
    customerId: customer.id,
    categoryCode: "jacket",
    displayName: `FT14 Grid Jacket ${unique}`,
    condition: "good",
    careState: "current",
    fitPerception: "true_to_size",
  });

  let planId: string | undefined;
  let membershipId: string | undefined;
  let bookingId: string | undefined;
  let partnerId: string | undefined;
  let engagementId: string | undefined;

  try {
    const { data: plan, error: planError } = await admin
      .from("service_plans")
      .insert({
        retailer_id: retailer.id,
        kind: "high_maintenance",
        status: "active",
        title: `FT14 Grid Plan ${unique}`,
        summary: "Grid fixture plan",
        explanation: "Grid fixture plan explanation",
      })
      .select("id")
      .single();
    if (planError || !plan) throw planError ?? new Error("plan fixture failed");
    planId = plan.id;

    const { data: membership, error: membershipError } = await admin
      .from("service_memberships")
      .insert({
        retailer_id: retailer.id,
        plan_id: planId,
        customer_id: customer.id,
      })
      .select("id")
      .single();
    if (membershipError || !membership)
      throw membershipError ?? new Error("membership fixture failed");
    membershipId = membership.id;

    const { data: booking, error: bookingError } = await admin
      .from("service_bookings")
      .insert({
        retailer_id: retailer.id,
        membership_id: membershipId,
        plan_id: planId,
        customer_id: customer.id,
        kind: "cleaning",
        status: "confirmed",
        requested_for: new Date().toISOString(),
        request_idempotency_key: `ft14-grid-booking-${unique}`,
      })
      .select("id")
      .single();
    if (bookingError || !booking)
      throw bookingError ?? new Error("booking fixture failed");
    bookingId = booking.id;

    const { data: partner, error: partnerError } = await admin
      .from("service_partners")
      .insert({
        retailer_id: retailer.id,
        display_name: `FT14 Grid Partner ${unique}`,
        capabilities: ["dry_cleaning"],
        turnaround_days: 3,
      })
      .select("id")
      .single();
    if (partnerError || !partner)
      throw partnerError ?? new Error("partner fixture failed");
    partnerId = partner.id;

    // Due later this month, but never past the last day — keep the fixture
    // inside the grid's own current month regardless of what day it runs.
    const today = new Date();
    const dueDate = new Date(
      today.getFullYear(),
      today.getMonth(),
      Math.min(today.getDate() + 1, 28),
    );
    const dueOn = dueDate.toISOString().slice(0, 10);
    const { data: engagement, error: engagementError } = await admin
      .from("service_partner_engagements")
      .insert({
        retailer_id: retailer.id,
        partner_id: partnerId,
        customer_id: customer.id,
        booking_id: bookingId,
        wardrobe_item_id: wardrobeItem.id,
        job_reference: `FT14-GRID-${unique}`,
        capability: "dry_cleaning",
        instructions: "Internal care instruction — never customer-visible.",
        due_on: dueOn,
        custody_state: "with_partner",
      })
      .select("id")
      .single();
    if (engagementError || !engagement)
      throw engagementError ?? new Error("engagement fixture failed");
    engagementId = engagement.id;

    const { data: link, error: linkError } =
      await admin.auth.admin.generateLink({
        type: "magiclink",
        email: TEST_CUSTOMER_EMAIL,
      });
    if (linkError || !link.properties)
      throw linkError ?? new Error("magic link generation failed");
    await page.goto(
      `/auth/confirm?token_hash=${link.properties.hashed_token}&type=magiclink`,
    );
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/preferred-tailoring");
    await expect(page.getByRole("grid")).toBeVisible();

    const careCell = page.getByRole("gridcell", {
      name: `${dueOn}: FT14 Grid Jacket ${unique} in care`,
    });
    await expect(careCell).toBeVisible();
    await expect(
      careCell.getByRole("link", { name: /Open Services/ }),
    ).toBeVisible();

    await careCell.getByRole("link", { name: /Open Services/ }).click();
    await expect(page).toHaveURL(/\/services$/);
  } finally {
    if (engagementId)
      await admin
        .from("service_partner_engagements")
        .delete()
        .eq("id", engagementId);
    if (partnerId)
      await admin.from("service_partners").delete().eq("id", partnerId);
    if (bookingId)
      await admin.from("service_bookings").delete().eq("id", bookingId);
    if (membershipId)
      await admin.from("service_memberships").delete().eq("id", membershipId);
    if (planId) await admin.from("service_plans").delete().eq("id", planId);
    await admin.from("wardrobe_items").delete().eq("id", wardrobeItem.id);
  }
});
