import {
  CustomerRepository,
  ServicePartnerRepository,
  ServicePlanRepository,
  WardrobeRepository,
  createSupabaseAdminClient,
  createSupabaseDirectClient,
} from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import { TEST_RETAILER_SLUG } from "./fixtures";

test("customer data is correctly isolated through full alteration and dry-cleaning custody cycle", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const anonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]!;
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
  const unique = Date.now();

  const { data: retailer } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");
  const retailerId = asId<"RetailerId">(retailer.id);

  let customerId: string | undefined;
  let planId: string | undefined;
  let membershipId: string | undefined;
  let alterationBookingId: string | undefined;
  let dryCleaningBookingId: string | undefined;
  let alterationPartnerId: string | undefined;
  let dryCleaningPartnerId: string | undefined;
  let alterationEngagementId: string | undefined;
  let dryCleaningEngagementId: string | undefined;
  let alterationItemId: string | undefined;
  let dryCleaningItemId: string | undefined;
  let testEngagementId: string | undefined;
  let testBookingId: string | undefined;
  let testPartnerId: string | undefined;
  let testItemId: string | undefined;

  try {
    // Create auth user first
    const customerEmail = `e2e-full-cycle-${unique}@paon.test`;
    const { data: authUser, error: authError } =
      await admin.auth.admin.createUser({
        email: customerEmail,
        password: `E2EPassword${unique}!`,
        email_confirm: true,
      });
    if (authError || !authUser.user)
      throw authError ?? new Error("auth user creation failed");

    // Create customer
    const customer = await new CustomerRepository(admin).create({
      retailerId,
      fullName: `E2E Full Cycle ${unique}`,
      email: customerEmail,
      lifecycleStage: "prospect",
    });
    customerId = customer.id;

    // Link customer to auth user
    const { error: linkError } = await admin
      .from("customers")
      .update({ user_id: authUser.user.id })
      .eq("id", customerId)
      .eq("retailer_id", retailerId);
    if (linkError) throw linkError;

    // Create wardrobe items
    const alterationItem = await new WardrobeRepository(
      admin,
    ).createExternalItem({
      retailerId,
      customerId,
      categoryCode: "jacket",
      displayName: `E2E Alteration Jacket ${unique}`,
      condition: "good",
      careState: "current",
      fitPerception: "true_to_size",
    });
    alterationItemId = alterationItem.id;

    const dryCleaningItem = await new WardrobeRepository(
      admin,
    ).createExternalItem({
      retailerId,
      customerId,
      categoryCode: "suit",
      displayName: `E2E Dry-Cleaning Suit ${unique}`,
      condition: "good",
      careState: "current",
      fitPerception: "true_to_size",
    });
    dryCleaningItemId = dryCleaningItem.id;

    // Create service plan and membership
    const { data: plan, error: planError } = await admin
      .from("service_plans")
      .insert({
        retailer_id: retailerId,
        kind: "high_maintenance",
        status: "active",
        title: `E2E Full Cycle Plan ${unique}`,
        summary: "Full cycle test plan",
        explanation: "Full cycle test explanation",
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
        customer_id: customerId,
      })
      .select("id")
      .single();
    if (membershipError || !membership)
      throw membershipError ?? new Error("membership fixture failed");
    membershipId = membership.id;

    // Create partners
    const { data: alterationPartner, error: alterationPartnerError } =
      await admin
        .from("service_partners")
        .insert({
          retailer_id: retailerId,
          display_name: `E2E Alteration Partner ${unique}`,
          capabilities: ["alteration"],
          turnaround_days: 5,
        })
        .select("id")
        .single();
    if (alterationPartnerError || !alterationPartner)
      throw (
        alterationPartnerError ?? new Error("alteration partner fixture failed")
      );
    alterationPartnerId = alterationPartner.id;

    const { data: dryCleaningPartner, error: dryCleaningPartnerError } =
      await admin
        .from("service_partners")
        .insert({
          retailer_id: retailerId,
          display_name: `E2E Dry-Cleaning Partner ${unique}`,
          capabilities: ["dry_cleaning"],
          turnaround_days: 3,
        })
        .select("id")
        .single();
    if (dryCleaningPartnerError || !dryCleaningPartner)
      throw (
        dryCleaningPartnerError ??
        new Error("dry-cleaning partner fixture failed")
      );
    dryCleaningPartnerId = dryCleaningPartner.id;

    // Create bookings via customer-authenticated client
    const customerPassword = `E2EPassword${unique}!`;
    const customerClient = createSupabaseDirectClient(
      supabaseUrl,
      process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]!,
    );
    const { error: signInError } = await customerClient.auth.signInWithPassword(
      {
        email: customerEmail,
        password: customerPassword,
      },
    );
    if (signInError) throw signInError;

    const repo = new ServicePlanRepository(customerClient);
    alterationBookingId = await repo.requestBooking({
      membershipId: asId<"ServiceMembershipId">(membershipId),
      kind: "repair",
      idempotencyKey: `e2e-repair-${unique}`,
    });

    dryCleaningBookingId = await repo.requestBooking({
      membershipId: asId<"ServiceMembershipId">(membershipId),
      kind: "cleaning",
      idempotencyKey: `e2e-dry-cleaning-${unique}`,
    });

    // Create partner engagements
    const partnerRepo = new ServicePartnerRepository(admin);
    const dueOn = new Date(Date.now() + 5 * 86_400_000)
      .toISOString()
      .slice(0, 10);

    const alterationEngagement = await partnerRepo.createEngagement(
      retailerId,
      {
        partnerId: asId<"ServicePartnerId">(alterationPartnerId),
        customerId,
        wardrobeItemId: asId<"WardrobeItemId">(alterationItemId),
        bookingId: asId<"ServiceBookingId">(alterationBookingId),
        jobReference: `ALT-${unique}`,
        capability: "alteration",
        instructions: "Hem the jacket sleeves.",
        dueOn,
      },
    );
    alterationEngagementId = alterationEngagement.id;

    const dryCleaningEngagement = await partnerRepo.createEngagement(
      retailerId,
      {
        partnerId: asId<"ServicePartnerId">(dryCleaningPartnerId),
        customerId,
        wardrobeItemId: asId<"WardrobeItemId">(dryCleaningItemId),
        bookingId: asId<"ServiceBookingId">(dryCleaningBookingId),
        jobReference: `DRY-${unique}`,
        capability: "dry_cleaning",
        instructions: "Standard dry clean and press.",
        dueOn,
      },
    );
    dryCleaningEngagementId = dryCleaningEngagement.id;

    // Verify initial custody state is with_retailer
    let altEngagement = await admin
      .from("service_partner_engagements")
      .select("*")
      .eq("id", alterationEngagementId)
      .single();
    expect(altEngagement.data?.custody_state).toBe("with_retailer");
    expect(altEngagement.data?.capability).toBe("alteration");

    // Move engagements through custody states
    const conditionNoteAlt = `Alteration complete ${unique}`;
    const conditionNoteDry = `Dry-cleaning done ${unique}`;

    // Alteration: with_retailer -> in_transit_to_partner -> with_partner -> in_transit_to_retailer -> returned_to_retailer
    await partnerRepo.recordCustodyTransition(retailerId, {
      engagementId: alterationEngagementId,
      fromState: "with_retailer",
      toState: "in_transit_to_partner",
      sentOn: new Date().toISOString().slice(0, 10),
    });

    await partnerRepo.recordCustodyTransition(retailerId, {
      engagementId: alterationEngagementId,
      fromState: "in_transit_to_partner",
      toState: "with_partner",
    });

    await partnerRepo.recordCustodyTransition(retailerId, {
      engagementId: alterationEngagementId,
      fromState: "with_partner",
      toState: "in_transit_to_retailer",
    });

    await partnerRepo.recordCustodyTransition(retailerId, {
      engagementId: alterationEngagementId,
      fromState: "in_transit_to_retailer",
      toState: "returned_to_retailer",
      conditionNote: conditionNoteAlt,
      returnedOn: new Date().toISOString().slice(0, 10),
    });

    // Dry-cleaning: with_retailer -> in_transit_to_partner -> with_partner -> in_transit_to_retailer -> returned_to_retailer
    await partnerRepo.recordCustodyTransition(retailerId, {
      engagementId: dryCleaningEngagementId,
      fromState: "with_retailer",
      toState: "in_transit_to_partner",
      sentOn: new Date().toISOString().slice(0, 10),
    });

    await partnerRepo.recordCustodyTransition(retailerId, {
      engagementId: dryCleaningEngagementId,
      fromState: "in_transit_to_partner",
      toState: "with_partner",
    });

    await partnerRepo.recordCustodyTransition(retailerId, {
      engagementId: dryCleaningEngagementId,
      fromState: "with_partner",
      toState: "in_transit_to_retailer",
    });

    await partnerRepo.recordCustodyTransition(retailerId, {
      engagementId: dryCleaningEngagementId,
      fromState: "in_transit_to_retailer",
      toState: "returned_to_retailer",
      conditionNote: conditionNoteDry,
      returnedOn: new Date().toISOString().slice(0, 10),
    });

    // Verify final states
    altEngagement = await admin
      .from("service_partner_engagements")
      .select("*")
      .eq("id", alterationEngagementId)
      .single();
    expect(altEngagement.data?.custody_state).toBe("returned_to_retailer");

    const dryEngagement = await admin
      .from("service_partner_engagements")
      .select("*")
      .eq("id", dryCleaningEngagementId)
      .single();
    expect(dryEngagement.data?.custody_state).toBe("returned_to_retailer");

    // Verify custody events were logged (4 transitions = 4 events)
    const altCustodyEvents = await admin
      .from("service_partner_custody_events")
      .select("*")
      .eq("engagement_id", alterationEngagementId);
    expect(altCustodyEvents.data?.length).toBe(4);

    const dryCustodyEvents = await admin
      .from("service_partner_custody_events")
      .select("*")
      .eq("engagement_id", dryCleaningEngagementId);
    expect(dryCustodyEvents.data?.length).toBe(4);

    // Test customer browser session and UI rendering
    const { data: magicLink, error: magicLinkError } =
      await admin.auth.admin.generateLink({
        type: "magiclink",
        email: customerEmail,
      });
    if (magicLinkError || !magicLink.properties)
      throw magicLinkError ?? new Error("magic link generation failed");

    // Navigate to auth link and authenticate customer
    await page.goto(
      `/auth/confirm?token_hash=${magicLink.properties.hashed_token}&type=magiclink`,
    );
    await expect(page).toHaveURL(/\/dashboard$/);

    // Navigate to services page
    await page.goto("/services");
    await expect(
      page.getByRole("heading", { name: "Care, held in view." }),
    ).toBeVisible();

    // Assert both engagements appear with distinct capabilities
    await expect(
      page.getByText(`E2E Alteration Jacket ${unique}`),
    ).toBeVisible();
    await expect(
      page.getByText(`E2E Dry-Cleaning Suit ${unique}`),
    ).toBeVisible();
    await expect(page.getByText("alteration", { exact: true })).toBeVisible();
    await expect(page.getByText("dry cleaning", { exact: true })).toBeVisible();

    // Verify we see the final returned state
    await expect(page.getByText("Back with your house").first()).toBeVisible();

    // Now test intermediate state by creating a new engagement in "with_partner" state
    const testItem = await new WardrobeRepository(admin).createExternalItem({
      retailerId,
      customerId,
      categoryCode: "shoes",
      displayName: `E2E Test Shoes ${unique}`,
      condition: "good",
      careState: "current",
      fitPerception: "true_to_size",
    });
    testItemId = testItem.id;

    testBookingId = await new ServicePlanRepository(
      customerClient,
    ).requestBooking({
      membershipId: asId<"ServiceMembershipId">(membershipId),
      kind: "care",
      idempotencyKey: `e2e-shoe-repair-${unique}`,
    });

    const testPartner = await admin
      .from("service_partners")
      .insert({
        retailer_id: retailerId,
        display_name: `E2E Test Partner ${unique}`,
        capabilities: ["shoe_repair"],
        turnaround_days: 2,
      })
      .select("id")
      .single();
    if (testPartner.error || !testPartner.data)
      throw testPartner.error ?? new Error("test partner fixture failed");
    testPartnerId = testPartner.data.id;

    const testEngagement = await partnerRepo.createEngagement(retailerId, {
      partnerId: asId<"ServicePartnerId">(testPartner.data.id),
      customerId,
      wardrobeItemId: asId<"WardrobeItemId">(testItemId),
      bookingId: asId<"ServiceBookingId">(testBookingId),
      jobReference: `TEST-${unique}`,
      capability: "shoe_repair",
      instructions: "Test shoe repair.",
      dueOn,
    });
    testEngagementId = testEngagement.id;

    // Move to with_partner state to test intermediate state rendering
    await partnerRepo.recordCustodyTransition(retailerId, {
      engagementId: testEngagement.id,
      fromState: "with_retailer",
      toState: "in_transit_to_partner",
      sentOn: new Date().toISOString().slice(0, 10),
    });
    await partnerRepo.recordCustodyTransition(retailerId, {
      engagementId: testEngagement.id,
      fromState: "in_transit_to_partner",
      toState: "with_partner",
    });

    // Reload page and verify intermediate state is visible
    await page.reload();
    await expect(page.getByText("In care")).toBeVisible();

    // Now move back to returned state for quality review testing
    await partnerRepo.recordCustodyTransition(retailerId, {
      engagementId: testEngagement.id,
      fromState: "with_partner",
      toState: "in_transit_to_retailer",
    });
    await partnerRepo.recordCustodyTransition(retailerId, {
      engagementId: testEngagement.id,
      fromState: "in_transit_to_retailer",
      toState: "returned_to_retailer",
      conditionNote: `Test pressing complete ${unique}`,
      returnedOn: new Date().toISOString().slice(0, 10),
    });

    // Reload page to show returned state with quality review form
    await page.reload();

    // Find and fill the rating input for the test shoes
    const ratingInput = page.locator("input[name='customerRating']").nth(2);
    const noteTextarea = page.locator("textarea[name='customerNote']").nth(2);
    const submitButton = page
      .getByRole("button", { name: /submit/i })
      .filter({ hasText: /submit/i })
      .nth(2);

    await ratingInput.fill("5");
    await noteTextarea.fill(`Great shoe repair service! ${unique}`);
    await submitButton.click();

    // Wait for page to reload and verify read-only display
    await page.waitForURL(/\/services/);
    await expect(page.getByText("Your review", { exact: true })).toBeVisible();
    await expect(page.getByText("Rating: 5/5")).toBeVisible();
    await expect(
      page.getByText(`Great shoe repair service! ${unique}`),
    ).toBeVisible();

    // Verify customer cannot directly read service_partner_engagements table
    const directResponse = await page
      .context()
      .request.get(`${supabaseUrl}/rest/v1/service_partner_engagements`, {
        headers: { apikey: anonKey },
      });
    expect(directResponse.ok()).toBe(false);
    const body: unknown = await directResponse.json();
    expect(body).toMatchObject({
      code: "42501",
      message: expect.stringContaining("permission denied"),
    });
  } finally {
    // Cleanup
    if (alterationEngagementId) {
      await admin
        .from("service_partner_custody_events")
        .delete()
        .eq("engagement_id", alterationEngagementId);
      await admin
        .from("service_partner_quality_reviews")
        .delete()
        .eq("engagement_id", alterationEngagementId);
      await admin
        .from("service_partner_engagements")
        .delete()
        .eq("id", alterationEngagementId);
    }
    if (dryCleaningEngagementId) {
      await admin
        .from("service_partner_custody_events")
        .delete()
        .eq("engagement_id", dryCleaningEngagementId);
      await admin
        .from("service_partner_quality_reviews")
        .delete()
        .eq("engagement_id", dryCleaningEngagementId);
      await admin
        .from("service_partner_engagements")
        .delete()
        .eq("id", dryCleaningEngagementId);
    }
    if (alterationPartnerId)
      await admin
        .from("service_partners")
        .delete()
        .eq("id", alterationPartnerId);
    if (dryCleaningPartnerId)
      await admin
        .from("service_partners")
        .delete()
        .eq("id", dryCleaningPartnerId);
    if (testEngagementId) {
      await admin
        .from("service_partner_custody_events")
        .delete()
        .eq("engagement_id", testEngagementId);
      await admin
        .from("service_partner_quality_reviews")
        .delete()
        .eq("engagement_id", testEngagementId);
      await admin
        .from("service_partner_engagements")
        .delete()
        .eq("id", testEngagementId);
    }
    if (testPartnerId)
      await admin.from("service_partners").delete().eq("id", testPartnerId);
    if (alterationBookingId)
      await admin
        .from("service_bookings")
        .delete()
        .eq("id", alterationBookingId);
    if (dryCleaningBookingId)
      await admin
        .from("service_bookings")
        .delete()
        .eq("id", dryCleaningBookingId);
    if (testBookingId)
      await admin.from("service_bookings").delete().eq("id", testBookingId);
    if (membershipId)
      await admin.from("service_memberships").delete().eq("id", membershipId);
    if (planId) await admin.from("service_plans").delete().eq("id", planId);
    if (alterationItemId)
      await admin.from("wardrobe_items").delete().eq("id", alterationItemId);
    if (dryCleaningItemId)
      await admin.from("wardrobe_items").delete().eq("id", dryCleaningItemId);
    if (testItemId)
      await admin.from("wardrobe_items").delete().eq("id", testItemId);
    if (customerId) await admin.from("customers").delete().eq("id", customerId);
  }
});
