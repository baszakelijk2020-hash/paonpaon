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
      projector_version: "clienteling-opportunity-v1",
    })
    .select("id")
    .single();
  if (opportunityError || !opportunity) throw opportunityError;

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

    const opportunityCard = page.locator("li", {
      hasText: `E2E why-now ${unique}`,
    });
    await expect(opportunityCard).toBeVisible();
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
      .eq("id", opportunity.id);
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
test("Mission Control surfaces pending price approvals, unread messages, and low stock", async ({
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

  // 1. Price approval: seed a real work order via the repository (not
  // the full UI intake journey — that flow has its own coverage) and a
  // pending price-change proposal on it directly, matching
  // dashboard-digest.spec.ts's own precedent for exactly this fixture.
  const customer = await new CustomerRepository(admin).create({
    retailerId,
    fullName: `E2E Mission Control Attention Client ${unique}`,
    email: `mission-control-attention-${unique}@paon.test`,
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

  // 2. Unread message.
  const { data: notification, error: notificationError } = await admin
    .from("notifications")
    .insert({
      retailer_id: retailerId,
      recipient_user_id: staffRow.user_id,
      category: "message",
      title: "Mission Control fixture notification",
      body: "Seeded for the unread-messages attention card e2e proof.",
    })
    .select("id")
    .single();
  if (notificationError) throw notificationError;

  // 3. Low stock.
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
    await expect(attention.locator('a[href="/messages"]')).toContainText(
      "conversation",
    );
    await expect(attention.locator('a[href="/products"]')).toContainText(
      "variant",
    );

    attentionProofPassed = true;
  } finally {
    await admin.from("product_variants").delete().eq("id", variant.id);
    await admin.from("products").delete().eq("id", product.id);
    await admin.from("notifications").delete().eq("id", notification.id);
    await admin.from("price_change_proposals").delete().eq("id", proposal.id);
    await admin.from("alteration_work_orders").delete().eq("id", alterationId);
    await admin.from("customers").delete().eq("id", customer.id);
  }
});
