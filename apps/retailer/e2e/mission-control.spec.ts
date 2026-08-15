import {
  AlterationRepository,
  AppointmentRepository,
  CustomerRepository,
  createSupabaseAdminClient,
} from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import {
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
  TEST_RETAILER_SLUG,
} from "./fixtures";
import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "17.2";
const BROWSER_PROOF_SPEC = "apps/retailer/e2e/mission-control.spec.ts";

let calendarProofPassed = false;
let attentionProofPassed = false;

test.afterAll(async () => {
  await writeBrowserProofRun({
    phaseItemId: PHASE_ITEM_ID,
    spec: BROWSER_PROOF_SPEC,
    status: calendarProofPassed && attentionProofPassed ? "passed" : "failed",
  });
});

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

// Serial, not the config's default fullyParallel: true — the two tests
// contribute to shared module-level proof flags that a single afterAll
// combines into one evidence run. Under fullyParallel, Playwright may run
// them in separate worker processes with separate module instances, so
// the flag one test sets is invisible to the other's afterAll, and
// whichever worker's afterAll writes last silently overwrites a real
// "both passed" result with a false "failed" — caught when 17.2's
// evidence-closure review found `docs/evidence/runs/17.2.json` recording
// `status: "failed"` immediately after both tests visibly passed in the
// terminal output.
test.describe.serial("mission control", () => {
  test("today's appointment slots into its hour, and a priority task can be accepted", async ({
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
    const customer = await new CustomerRepository(admin).create({
      retailerId,
      fullName: `E2E Mission Control Client ${unique}`,
      email: `mission-control-${unique}@paon.test`,
      lifecycleStage: "prospect",
    });

    const startsAt = new Date();
    startsAt.setMinutes(0, 0, 0);
    startsAt.setHours(startsAt.getHours() + 1);
    const endsAt = new Date(startsAt.getTime() + 30 * 60_000);

    const appointment = await new AppointmentRepository(admin).create({
      retailerId,
      customerId: customer.id,
      type: "fitting",
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    });

    const { data: opportunity, error: opportunityError } = await admin
      .from("clienteling_opportunities")
      .insert({
        retailer_id: retailerId,
        customer_id: customer.id,
        opportunity_type: "interest_follow_up",
        why_now: `E2E why-now ${unique}`,
        suggested_action: `E2E suggested action ${unique}`,
        channel: "in_person",
        status: "draft",
        priority: 2,
        confidence: 0.82,
        evidence: [{ insightStatement: `E2E cited evidence ${unique}` }],
        projector_version: "clienteling-opportunity-v1",
      })
      .select("id")
      .single();
    if (opportunityError || !opportunity) throw opportunityError;

    // Operational coordination: an assigned pick must show who owns it, not
    // just an unassigned one, so a manager can tell distributed queue work
    // apart from unclaimed work at a glance.
    const { data: ownerStaff } = await admin
      .from("retailer_staff_members")
      .select("id, full_name")
      .eq("retailer_id", retailerId)
      .eq("email", TEST_OWNER_EMAIL)
      .single();
    if (!ownerStaff) throw new Error("owner staff record missing");
    const { data: assignedOpportunity, error: assignedOpportunityError } =
      await admin
        .from("clienteling_opportunities")
        .insert({
          retailer_id: retailerId,
          customer_id: customer.id,
          opportunity_type: "interest_follow_up",
          why_now: `E2E assigned why-now ${unique}`,
          suggested_action: `E2E assigned suggested action ${unique}`,
          channel: "in_person",
          status: "draft",
          assigned_staff_id: ownerStaff.id,
          projector_version: "clienteling-opportunity-v1",
        })
        .select("id")
        .single();
    if (assignedOpportunityError || !assignedOpportunity) {
      throw assignedOpportunityError;
    }

    try {
      await page.goto("/mission-control");
      await expect(
        page.getByRole("heading", { name: "Mission Control" }),
      ).toBeVisible();

      // Scoped to the appointment slot specifically: this same customer also
      // has a clienteling opportunity below, so their name legitimately
      // appears twice on the page and an unscoped text match is ambiguous.
      await expect(
        page
          .locator(`[data-appointment-id="${appointment.id}"]`)
          .getByText(`E2E Mission Control Client ${unique}`),
      ).toBeVisible();

      // Scoped away from the decision feed on purpose. The same opportunity
      // legitimately renders twice on this page — once in the "What's next"
      // decision feed and once in the opportunities list — so matching on the
      // why-now text alone is a strict-mode violation. The assertions below
      // (priority, confidence, cited evidence, assignment) belong to the
      // opportunities-list rendering, so exclude the feed explicitly.
      const opportunityCard = page
        .locator("li", { hasText: `E2E why-now ${unique}` })
        .filter({ hasNotText: "Ranked reasons to act now" })
        .filter({ hasText: "Priority" });
      await expect(opportunityCard).toBeVisible();
      // Decision intelligence: priority, confidence and cited evidence must
      // be visible, not just the "why now" headline — the founder's own
      // "ranked, explainable why-now/what-next view with evidence,
      // uncertainty" requirement for Mission Control.
      await expect(opportunityCard.getByText("Priority 2")).toBeVisible();
      await expect(opportunityCard.getByText("82% confidence")).toBeVisible();
      await expect(
        opportunityCard.getByText(`E2E cited evidence ${unique}`),
      ).toBeVisible();
      await expect(opportunityCard.getByText("Unassigned")).toBeVisible();

      const assignedCard = page.locator("li", {
        hasText: `E2E assigned why-now ${unique}`,
      });
      await expect(assignedCard.getByText(ownerStaff.full_name)).toBeVisible();

      await opportunityCard.getByRole("button", { name: "Accept" }).click();
      await expect(opportunityCard).toHaveCount(0);

      const { data: updated } = await admin
        .from("clienteling_opportunities")
        .select("status")
        .eq("id", opportunity.id)
        .single();
      expect(updated?.status).toBe("accepted");

      calendarProofPassed = true;
    } finally {
      await admin
        .from("clienteling_opportunities")
        .delete()
        .in("id", [opportunity.id, assignedOpportunity.id]);
      await admin.from("appointments").delete().eq("id", appointment.id);
      await admin.from("customers").delete().eq("id", customer.id);
    }
  });

  /**
   * Proves PHASE 17.2's own gap closure: the three sources /dashboard's own
   * "Needs your attention" brief already aggregates (pending price
   * approvals, unread messages, low stock) now ALSO appear on Mission
   * Control itself, not only on the separate advisor-brief page — so
   * nothing actionable requires leaving Mission Control to discover, the
   * item's own acceptance line. Seeding mirrors `dashboard-digest.spec.ts`'s
   * own already-proven fixtures exactly (same repository calls render both
   * pages; this proves the render, not a second copy of the query logic).
   */
  test("Mission Control surfaces a real conversation thread and keeps non-message updates out of the conversation count", async ({
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

    const { data: staffRow } = await admin
      .from("retailer_staff_members")
      .select("id, user_id")
      .eq("retailer_id", retailerId)
      .eq("email", TEST_OWNER_EMAIL)
      .single();
    if (!staffRow?.user_id) throw new Error("fixture owner staff row missing");

    const unique = Date.now();

    // Seed a customer and a real work order so the attention card still
    // has a price-approval item alongside the message threads.
    const customer = await new CustomerRepository(admin).create({
      retailerId,
      fullName: `E2E Mission Control Shared Client ${unique}`,
      email: `mission-control-shared-${unique}@paon.test`,
      phone: "+1 (555) 222-3344",
      lifecycleStage: "prospect",
    });
    const alterationId = await new AlterationRepository(admin).createIntake({
      customerId: customer.id,
      sourceKind: "external",
      categoryCode: "jacket",
      garmentType: `E2E Mission Control Jacket ${unique}`,
      description: "Fixture garment for the mission-control e2e proof.",
      labelMetadata: {},
      intakeCondition: "Good condition, no visible wear.",
      observations: [
        {
          area: "Waist",
          observation: "Waist needs taking in by 1 inch.",
          classification: "work_now",
        },
      ],
      tasks: [{ title: "Take in waist 1 inch", classification: "work_now" }],
    });
    const { data: workOrder } = await admin
      .from("alteration_work_orders")
      .select("work_order_number, original_quote_currency")
      .eq("id", alterationId)
      .single();
    if (!workOrder) throw new Error("fixture work order not found");
    const { data: proposal, error: proposalError } = await admin
      .from("price_change_proposals")
      .insert({
        alteration_id: alterationId,
        retailer_id: retailerId,
        original_amount_minor_units: 12000,
        proposed_amount_minor_units: 15000,
        currency: workOrder.original_quote_currency,
        explanation: "Extra hand-finishing required at the waist.",
        status: "pending",
        proposed_by_staff_id: staffRow.id,
      })
      .select("id")
      .single();
    if (proposalError) throw proposalError;

    await page.goto(`/customers/${customer.id}`);
    await page.getByRole("button", { name: "Message client" }).click();
    await expect(page).toHaveURL(/\/messages\?c=[0-9a-f-]+$/);
    const conversationId = new URL(page.url()).searchParams.get("c");
    if (!conversationId) throw new Error("Conversation id missing from URL");

    const { data: messageNotifications, error: messageNotificationError } =
      await admin
        .from("notifications")
        .insert([
          {
            retailer_id: retailerId,
            recipient_user_id: staffRow.user_id,
            category: "message",
            title: "Mission Control thread ping",
            body: "Seeded for the deduped shared-thread proof.",
            action_href: `/messages?c=${conversationId}`,
          },
          {
            retailer_id: retailerId,
            recipient_user_id: staffRow.user_id,
            category: "message",
            title: "Mission Control thread follow-up",
            body: "Seeded for the deduped shared-thread proof.",
            action_href: `/messages?c=${conversationId}`,
          },
        ])
        .select("id");
    if (messageNotificationError) throw messageNotificationError;

    const { data: updateNotification, error: updateNotificationError } =
      await admin
        .from("notifications")
        .insert({
          retailer_id: retailerId,
          recipient_user_id: staffRow.user_id,
          category: "marketing",
          title: "Mission Control update fixture",
          body: "Seeded for the non-message unread proof.",
        })
        .select("id")
        .single();
    if (updateNotificationError) throw updateNotificationError;

    const { data: product, error: productError } = await admin
      .from("products")
      .insert({
        retailer_id: retailerId,
        name: "Mission Control low-stock fixture",
        slug: `mission-control-low-stock-${unique}`,
        status: "active",
      })
      .select("id")
      .single();
    if (productError) throw productError;
    const { data: variant, error: variantError } = await admin
      .from("product_variants")
      .insert({
        product_id: product.id,
        sku: `MC-LOW-${unique}`,
        price_amount_minor_units: 10000,
        price_currency: "USD",
        inventory_quantity: 3,
      })
      .select("id")
      .single();
    if (variantError) throw variantError;

    try {
      await page.goto("/mission-control");
      await expect(page.getByText("Needs your attention")).toBeVisible();

      const attention = page.locator("#mission-control-attention");
      await expect(
        attention.getByText(
          `Price approval needed · ${workOrder.work_order_number}`,
        ),
      ).toBeVisible();
      const conversationLink = attention.locator(
        `a[href="/messages?c=${conversationId}"]`,
      );
      await expect(conversationLink).toHaveCount(1);
      await expect(conversationLink).toContainText(customer.fullName);
      await expect(attention.locator('a[href="/messages"]')).toHaveCount(0);
      await expect(attention.locator('a[href="/notifications"]')).toContainText(
        /other unread update/,
      );
      await expect(attention.locator('a[href="/products"]')).toContainText(
        "variant",
      );
      await conversationLink.click();
      await expect(page).toHaveURL(
        new RegExp(`/messages\\?c=${conversationId}$`),
      );

      attentionProofPassed = true;
    } finally {
      if (conversationId) {
        await admin
          .from("messages")
          .delete()
          .eq("conversation_id", conversationId);
        await admin.from("conversations").delete().eq("id", conversationId);
      }
      if (messageNotifications?.length) {
        await admin
          .from("notifications")
          .delete()
          .in(
            "id",
            messageNotifications.map((notification) => notification.id),
          );
      }
      if (updateNotification?.id) {
        await admin
          .from("notifications")
          .delete()
          .eq("id", updateNotification.id);
      }
      // Guarded like the notification cleanups above. These four were
      // unguarded, and a failure BEFORE any of them existed made the finally
      // block throw on the first undefined id — abandoning every cleanup after
      // it. That is how two "Mission Control low-stock fixture" products came
      // to exist at once, which then broke visual-roadmap.spec.ts with a
      // strict-mode violation when it selected that product by name. A test's
      // own cleanup must never depend on the test having got far enough.
      if (variant?.id)
        await admin.from("product_variants").delete().eq("id", variant.id);
      if (product?.id)
        await admin.from("products").delete().eq("id", product.id);
      if (proposal?.id)
        await admin
          .from("price_change_proposals")
          .delete()
          .eq("id", proposal.id);
      if (alterationId)
        await admin
          .from("alteration_work_orders")
          .delete()
          .eq("id", alterationId);
      if (customer?.id)
        await admin.from("customers").delete().eq("id", customer.id);
    }
  });
});

// Not part of the shared 17.2 proof flags/evidence run above (this covers
// new "Outcome learning" scope beyond 17.2's own checked acceptance
// criteria) -- a plain, independent journey proving completed
// opportunities with a real outcome now surface on Mission Control.
test("Mission Control surfaces a completed opportunity's real outcome, and excludes one with none", async ({
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
  const customer = await new CustomerRepository(admin).create({
    retailerId,
    fullName: `E2E Outcome Client ${unique}`,
    email: `mission-control-outcome-${unique}@paon.test`,
    lifecycleStage: "prospect",
  });

  const order = await admin
    .from("orders")
    .insert({
      retailer_id: retailerId,
      customer_id: customer.id,
      order_number: `E2E-OUT-${unique}`,
      status: "placed",
      subtotal_amount_minor_units: 0,
      total_amount_minor_units: 0,
      currency: "USD",
    })
    .select("id")
    .single();
  if (order.error || !order.data) throw order.error;

  const { data: withOutcome, error: withOutcomeError } = await admin
    .from("clienteling_opportunities")
    .insert({
      retailer_id: retailerId,
      customer_id: customer.id,
      opportunity_type: "interest_follow_up",
      why_now: `E2E outcome why-now ${unique}`,
      suggested_action: `E2E outcome suggested action ${unique}`,
      channel: "in_person",
      status: "completed",
      projector_version: "clienteling-opportunity-v1",
      outcome_order_id: order.data.id,
    })
    .select("id")
    .single();
  if (withOutcomeError || !withOutcome) throw withOutcomeError;

  const { data: noOutcome, error: noOutcomeError } = await admin
    .from("clienteling_opportunities")
    .insert({
      retailer_id: retailerId,
      customer_id: customer.id,
      opportunity_type: "interest_follow_up",
      why_now: `E2E no-outcome why-now ${unique}`,
      suggested_action: `E2E no-outcome suggested action ${unique}`,
      channel: "in_person",
      status: "completed",
      projector_version: "clienteling-opportunity-v1",
    })
    .select("id")
    .single();
  if (noOutcomeError || !noOutcome) throw noOutcomeError;

  try {
    // The file-level test.beforeEach above already logs in as the owner.
    await page.goto("/mission-control");
    await expect(
      page.getByRole("heading", { name: "Recent outcomes" }),
    ).toBeVisible();

    const outcomeCard = page.locator("li", {
      hasText: `E2E outcome suggested action ${unique}`,
    });
    await expect(outcomeCard).toBeVisible();
    await expect(outcomeCard.getByText("Order placed")).toBeVisible();
    await expect(
      outcomeCard.getByRole("link", { name: "Order placed" }),
    ).toHaveAttribute("href", `/orders/${order.data.id}`);

    // Completed with nothing behind it never appears — this list proves a
    // real outcome, not merely that the status is "completed".
    await expect(
      page.getByText(`E2E no-outcome suggested action ${unique}`),
    ).toHaveCount(0);
  } finally {
    await admin
      .from("clienteling_opportunities")
      .delete()
      .in("id", [withOutcome.id, noOutcome.id]);
    await admin.from("orders").delete().eq("id", order.data.id);
    await admin.from("customers").delete().eq("id", customer.id);
  }
});

// Decision intelligence: proves the unified decision feed ranks entries
// from multiple signal kinds (clienteling opportunities, appointments,
// unread messages, price approvals, low stock) in a single feed, ordered
// by the ranking formula rather than signal-type silos.
test("Decision feed shows ranked entries from multiple signal kinds", async ({
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
  const customer = await new CustomerRepository(admin).create({
    retailerId,
    fullName: `E2E Decision Feed Client ${unique}`,
    email: `decision-feed-${unique}@paon.test`,
    lifecycleStage: "prospect",
  });

  // Seed two signal kinds: a clienteling opportunity and an appointment
  const { data: opportunity, error: opportunityError } = await admin
    .from("clienteling_opportunities")
    .insert({
      retailer_id: retailerId,
      customer_id: customer.id,
      opportunity_type: "interest_follow_up",
      why_now: `E2E decision feed opportunity ${unique}`,
      suggested_action: "Reach out with new collection",
      channel: "in_person",
      status: "draft",
      priority: 1,
      confidence: 0.95,
      evidence: [{ insightStatement: `E2E decision feed evidence ${unique}` }],
      projector_version: "clienteling-opportunity-v1",
    })
    .select("id")
    .single();
  if (opportunityError || !opportunity) throw opportunityError;

  // Appointment scheduled for within 2 hours (high urgency)
  const startsAt = new Date();
  startsAt.setMinutes(startsAt.getMinutes() + 30);
  const endsAt = new Date(startsAt.getTime() + 30 * 60_000);

  const appointment = await new AppointmentRepository(admin).create({
    retailerId,
    customerId: customer.id,
    type: "styling_consultation",
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
  });

  try {
    await page.goto("/mission-control");
    await expect(
      page.getByRole("heading", { name: "Mission Control" }),
    ).toBeVisible();

    // Decision intelligence: the unified "What's next" feed should be visible
    const decisionFeed = page.locator("#mission-control-decision-feed");
    await expect(decisionFeed).toBeVisible();
    await expect(
      // Apostrophe-agnostic on purpose: the page renders `What&rsquo;s next`
      // (U+2019, correct typography for prose), while a straight U+0027 in the
      // matcher silently never matches. That mismatch is what made this proof
      // fail, not a missing feature.
      decisionFeed.getByRole("heading", { name: /What.s next/ }),
    ).toBeVisible();

    // Both signal kinds should appear in the same ranked feed.
    //
    // Deliberately NOT asserting a global feed count. The feed is retailer-wide
    // and this test shares its fixture retailer with the rest of the suite, so
    // any other signal present makes an exact count fail for a reason that has
    // nothing to do with what is being proven. The claim under test is the
    // RANKING, so assert on this test's own two entries and their relative
    // order instead.
    const feedItems = decisionFeed.locator("li");
    await expect(feedItems.first()).toBeVisible();

    const appointmentItem = feedItems
      .filter({ hasText: "styling consultation" })
      .first();
    const opportunityItem = feedItems
      .filter({ hasText: `E2E decision feed opportunity ${unique}` })
      .first();

    await expect(appointmentItem).toBeVisible();
    await expect(
      appointmentItem.getByText(/appointment.*within|starts in|few minutes/i),
    ).toBeVisible();
    await expect(opportunityItem).toContainText("95% confidence");

    // The appointment (imminent within 2 hours) must rank ABOVE the
    // opportunity: appointment_soon scores baseWeight 85 + urgency 30 = 115,
    // while clienteling_opportunity scores 60 + confidence (0.95*20=19)
    // + priority (10-1*5=5) = 84.
    const orderedText = await feedItems.allTextContents();
    const appointmentIndex = orderedText.findIndex((text) =>
      text.includes("styling consultation"),
    );
    const opportunityIndex = orderedText.findIndex((text) =>
      text.includes(`E2E decision feed opportunity ${unique}`),
    );
    expect(appointmentIndex).toBeGreaterThanOrEqual(0);
    expect(opportunityIndex).toBeGreaterThanOrEqual(0);
    expect(appointmentIndex).toBeLessThan(opportunityIndex);
  } finally {
    await admin
      .from("clienteling_opportunities")
      .delete()
      .eq("id", opportunity.id);
    await admin.from("appointments").delete().eq("id", appointment.id);
    await admin.from("customers").delete().eq("id", customer.id);
  }
});
