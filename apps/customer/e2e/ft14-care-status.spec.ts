import {
  ServicePlanRepository,
  WardrobeRepository,
  createSupabaseAdminClient,
  createSupabaseDirectClient,
} from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL, TEST_RETAILER_SLUG } from "./fixtures";

test("HighMaintenance shows only the customer's booking-linked care state and never the return note", async ({
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
    displayName: `FT14 Care Jacket ${unique}`,
    condition: "good",
    careState: "current",
    fitPerception: "true_to_size",
  });
  const returnNote = `Internal return note ${unique}`;
  let planId: string | undefined;
  let membershipId: string | undefined;
  let bookingId: string | undefined;
  let partnerId: string | undefined;
  let engagementId: string | undefined;
  let careRecordId: string | undefined;
  let otherMembershipId: string | undefined;
  let otherCareRecordId: string | undefined;
  let staffUserId: string | undefined;
  let staffMemberId: string | undefined;

  try {
    const { data: plan, error: planError } = await admin
      .from("service_plans")
      .insert({
        retailer_id: retailer.id,
        kind: "high_maintenance",
        status: "active",
        title: `FT14 Care Plan ${unique}`,
        summary: "Care fixture plan",
        explanation: "Care fixture plan explanation",
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

    const { data: otherCustomer } = await admin
      .from("customers")
      .select("id")
      .eq("retailer_id", retailer.id)
      .neq("id", customer.id)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    if (!otherCustomer) throw new Error("second fixture customer missing");
    const { data: otherMembership, error: otherMembershipError } = await admin
      .from("service_memberships")
      .insert({
        retailer_id: retailer.id,
        plan_id: planId,
        customer_id: otherCustomer.id,
      })
      .select("id")
      .single();
    if (otherMembershipError || !otherMembership) {
      throw (
        otherMembershipError ?? new Error("other membership fixture failed")
      );
    }
    otherMembershipId = otherMembership.id;

    const staffEmail = `ft14-care-staff-${unique}@nebelspiegel.com`;
    const { data: staffUser, error: staffUserError } =
      await admin.auth.admin.createUser({
        email: staffEmail,
        password: "FT14-care-staff-password",
        email_confirm: true,
      });
    if (staffUserError || !staffUser.user) {
      throw staffUserError ?? new Error("care staff fixture failed");
    }
    staffUserId = staffUser.user.id;
    const { data: staffMember, error: staffMemberError } = await admin
      .from("retailer_staff_members")
      .insert({
        retailer_id: retailer.id,
        user_id: staffUserId,
        full_name: "FT14 Care Staff",
        email: staffEmail,
        role: "sales_associate",
        accepted_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (staffMemberError || !staffMember) {
      throw staffMemberError ?? new Error("care staff membership failed");
    }
    staffMemberId = staffMember.id;

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
        request_idempotency_key: `ft14-care-booking-${unique}`,
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
        display_name: `FT14 Internal Partner ${unique}`,
        capabilities: ["dry_cleaning"],
        turnaround_days: 3,
      })
      .select("id")
      .single();
    if (partnerError || !partner)
      throw partnerError ?? new Error("partner fixture failed");
    partnerId = partner.id;

    const dueOn = new Date(Date.now() + 3 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const { data: engagement, error: engagementError } = await admin
      .from("service_partner_engagements")
      .insert({
        retailer_id: retailer.id,
        partner_id: partnerId,
        customer_id: customer.id,
        booking_id: bookingId,
        wardrobe_item_id: wardrobeItem.id,
        job_reference: `FT14-CARE-${unique}`,
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

    const staffClient = createSupabaseDirectClient(
      supabaseUrl,
      process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]!,
    );
    const { error: staffSignInError } =
      await staffClient.auth.signInWithPassword({
        email: staffEmail,
        password: "FT14-care-staff-password",
      });
    if (staffSignInError) throw staffSignInError;
    careRecordId = await new ServicePlanRepository(staffClient).recordCare({
      membershipId: asId<"ServiceMembershipId">(membershipId),
      careKind: "pressing",
      summary: `Pressing completed ${unique}`,
      bookingId: asId<"ServiceBookingId">(bookingId),
      wardrobeItemId: asId<"WardrobeItemId">(wardrobeItem.id),
    });

    const { data: otherCareRecord, error: otherCareRecordError } = await admin
      .from("service_care_records")
      .insert({
        retailer_id: retailer.id,
        membership_id: otherMembershipId,
        customer_id: otherCustomer.id,
        care_kind: "repair",
        summary: `Other customer care record ${unique}`,
      })
      .select("id")
      .single();
    if (otherCareRecordError || !otherCareRecord) {
      throw (
        otherCareRecordError ?? new Error("other care record fixture failed")
      );
    }
    otherCareRecordId = otherCareRecord.id;

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
    await page.goto("/services");
    await expect(
      page.getByRole("heading", { name: "Care, held in view." }),
    ).toBeVisible();
    await expect(page.getByText(`FT14 Care Jacket ${unique}`)).toBeVisible();
    await expect(page.getByText("In care")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Care outcomes" }),
    ).toBeVisible();
    await expect(
      page.getByText(`Pressing completed ${unique}`, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(`Other customer care record ${unique}`),
    ).toHaveCount(0);
    await expect(
      page.getByText("FT14 Internal Partner", { exact: false }),
    ).toHaveCount(0);

    const { error: returnError } = await admin
      .from("service_partner_engagements")
      .update({
        custody_state: "returned_to_retailer",
        returned_on: new Date().toISOString().slice(0, 10),
      })
      .eq("id", engagementId);
    if (returnError) throw returnError;
    const { error: eventError } = await admin
      .from("service_partner_custody_events")
      .insert({
        retailer_id: retailer.id,
        engagement_id: engagementId,
        from_state: "in_transit_to_retailer",
        to_state: "returned_to_retailer",
        condition_note: returnNote,
      });
    if (eventError) throw eventError;

    await page.reload();
    await expect(page.getByText("Back with your house")).toBeVisible();
    await expect(page.getByText(returnNote)).toHaveCount(0);
    await expect(
      page.getByText("Internal care instruction — never customer-visible."),
    ).toHaveCount(0);

    const directPartnerResponse = await page
      .context()
      .request.get(`${supabaseUrl}/rest/v1/service_partner_engagements`, {
        headers: { apikey: process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]! },
      });
    const directPartnerBody: unknown = await directPartnerResponse.json();
    expect(directPartnerResponse.ok()).toBe(false);
    expect(directPartnerBody).toMatchObject({
      code: "42501",
      message: expect.stringContaining("permission denied"),
    });
    expect(Array.isArray(directPartnerBody)).toBe(false);
  } finally {
    if (engagementId)
      await admin
        .from("service_partner_custody_events")
        .delete()
        .eq("engagement_id", engagementId);
    if (otherCareRecordId)
      await admin
        .from("service_care_records")
        .delete()
        .eq("id", otherCareRecordId);
    if (careRecordId)
      await admin.from("service_care_records").delete().eq("id", careRecordId);
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
    if (otherMembershipId)
      await admin
        .from("service_memberships")
        .delete()
        .eq("id", otherMembershipId);
    if (staffMemberId)
      await admin
        .from("retailer_staff_members")
        .delete()
        .eq("id", staffMemberId);
    if (staffUserId) await admin.auth.admin.deleteUser(staffUserId);
    if (planId) await admin.from("service_plans").delete().eq("id", planId);
    await admin.from("wardrobe_items").delete().eq("id", wardrobeItem.id);
  }
});
