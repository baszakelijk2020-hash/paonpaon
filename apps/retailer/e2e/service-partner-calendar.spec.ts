import {
  CustomerRepository,
  RetailerRepository,
  WardrobeRepository,
  createSupabaseAdminClient,
} from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import {
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
  TEST_RETAILER_SLUG,
} from "./fixtures";

const DAY_MS = 86_400_000;

function startOfWeek(): Date {
  const date = new Date();
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  return start;
}

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("weekly service calendar composes same-tenant booking, appointment, and custody without cross-tenant leakage", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
  const { data: retailer } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");

  const retailerId = asId<"RetailerId">(retailer.id);
  const unique = Date.now();
  const otherRetailer = await new RetailerRepository(admin).create({
    legalName: `E2E Calendar Other ${unique}, Inc.`,
    displayName: `E2E Calendar Other ${unique}`,
    slug: `e2e-service-calendar-other-${unique}`,
    tier: "house",
    defaultCurrency: "USD",
    defaultLocale: "en-US",
    billingAddress: {
      line1: "1 Test Street",
      city: "Testville",
      postalCode: "00000",
      countryCode: "US",
    },
  });
  const otherRetailerId = otherRetailer.id;
  const dueDate = new Date(startOfWeek().getTime() + 2 * DAY_MS);
  const dueOn = dueDate.toISOString().slice(0, 10);
  const startsAt = new Date(
    dueDate.getTime() + 10 * 60 * 60 * 1000,
  ).toISOString();
  const endsAt = new Date(
    dueDate.getTime() + 11 * 60 * 60 * 1000,
  ).toISOString();
  const clientName = `E2E Calendar Client ${unique}`;
  const hiddenClientName = `E2E Calendar Other Client ${unique}`;
  const garmentName = `E2E Calendar Jacket ${unique}`;
  const partnerName = `E2E Calendar Cleaner ${unique}`;

  const customerRepo = new CustomerRepository(admin);
  const wardrobeRepo = new WardrobeRepository(admin);
  const customer = await customerRepo.create({
    retailerId,
    fullName: clientName,
    email: `service-calendar-${unique}@paon.test`,
    lifecycleStage: "prospect",
  });
  const otherCustomer = await customerRepo.create({
    retailerId: otherRetailerId,
    fullName: hiddenClientName,
    email: `service-calendar-other-${unique}@paon.test`,
    lifecycleStage: "prospect",
  });
  const wardrobeItem = await wardrobeRepo.createExternalItem({
    retailerId,
    customerId: customer.id,
    categoryCode: "jacket",
    displayName: garmentName,
    condition: "good",
    careState: "current",
    fitPerception: "true_to_size",
  });

  let planId: string | undefined;
  let membershipId: string | undefined;
  let bookingId: string | undefined;
  let appointmentId: string | undefined;
  let partnerId: string | undefined;
  let engagementId: string | undefined;
  try {
    const { data: plan, error: planError } = await admin
      .from("service_plans")
      .insert({
        retailer_id: retailerId,
        kind: "preferred_tailoring",
        status: "active",
        title: `E2E Calendar Plan ${unique}`,
        summary: "Calendar fixture plan",
        explanation: "Calendar fixture plan explanation",
      })
      .select("id")
      .single();
    if (planError || !plan) throw planError ?? new Error("plan fixture failed");
    planId = plan.id;

    const { data: membership, error: membershipError } = await admin
      .from("service_memberships")
      .insert({
        retailer_id: retailerId,
        plan_id: planId,
        customer_id: customer.id,
      })
      .select("id")
      .single();
    if (membershipError || !membership)
      throw membershipError ?? new Error("membership fixture failed");
    membershipId = membership.id;

    const { data: appointment, error: appointmentError } = await admin
      .from("appointments")
      .insert({
        retailer_id: retailerId,
        customer_id: customer.id,
        type: "fitting",
        status: "confirmed",
        starts_at: startsAt,
        ends_at: endsAt,
      })
      .select("id")
      .single();
    if (appointmentError || !appointment)
      throw appointmentError ?? new Error("appointment fixture failed");
    appointmentId = appointment.id;

    const { data: booking, error: bookingError } = await admin
      .from("service_bookings")
      .insert({
        retailer_id: retailerId,
        membership_id: membershipId,
        plan_id: planId,
        customer_id: customer.id,
        kind: "cleaning",
        status: "confirmed",
        requested_for: startsAt,
        appointment_id: appointmentId,
        request_idempotency_key: `calendar-booking-${unique}`,
      })
      .select("id")
      .single();
    if (bookingError || !booking)
      throw bookingError ?? new Error("booking fixture failed");
    bookingId = booking.id;

    const { data: partner, error: partnerError } = await admin
      .from("service_partners")
      .insert({
        retailer_id: retailerId,
        display_name: partnerName,
        capabilities: ["dry_cleaning"],
        turnaround_days: 3,
      })
      .select("id")
      .single();
    if (partnerError || !partner)
      throw partnerError ?? new Error("partner fixture failed");
    partnerId = partner.id;

    const { data: engagement, error: engagementError } = await admin
      .from("service_partner_engagements")
      .insert({
        retailer_id: retailerId,
        partner_id: partnerId,
        customer_id: customer.id,
        booking_id: bookingId,
        wardrobe_item_id: wardrobeItem.id,
        job_reference: `E2E-CALENDAR-${unique}`,
        capability: "dry_cleaning",
        instructions: "Calendar fixture cleaning",
        due_on: dueOn,
        custody_state: "with_partner",
      })
      .select("id")
      .single();
    if (engagementError || !engagement)
      throw engagementError ?? new Error("engagement fixture failed");
    engagementId = engagement.id;

    await page.goto("/service-partners/calendar");
    await expect(
      page.getByRole("heading", { name: "Weekly service calendar" }),
    ).toBeVisible();
    await expect(page.getByTestId("service-week-calendar")).toContainText(
      clientName,
    );
    await expect(page.getByTestId("service-week-calendar")).toContainText(
      garmentName,
    );
    await expect(page.getByTestId("service-week-calendar")).toContainText(
      partnerName,
    );
    await expect(page.getByTestId("service-week-calendar")).toContainText(
      "Booking",
    );
    await expect(
      page.getByRole("link", { name: new RegExp(`10:00 · ${clientName}`) }),
    ).toBeVisible();
    await expect(page.getByTestId("service-week-calendar")).not.toContainText(
      hiddenClientName,
    );
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
    if (appointmentId)
      await admin.from("appointments").delete().eq("id", appointmentId);
    if (membershipId)
      await admin.from("service_memberships").delete().eq("id", membershipId);
    if (planId) await admin.from("service_plans").delete().eq("id", planId);
    await admin.from("wardrobe_items").delete().eq("id", wardrobeItem.id);
    await admin.from("customers").delete().eq("id", customer.id);
    await admin.from("customers").delete().eq("id", otherCustomer.id);
    await admin.from("retailers").delete().eq("id", otherRetailerId);
  }
});
