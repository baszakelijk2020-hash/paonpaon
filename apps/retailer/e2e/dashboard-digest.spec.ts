import { createSupabaseAdminClient } from "@paon/database";
import { expect, test } from "@playwright/test";

import { TEST_OWNER_EMAIL, TEST_OWNER_PASSWORD } from "./fixtures";

/**
 * Proves the "Needs your attention" dashboard digest (docs/DECISIONS.md
 * ADR-037) actually surfaces a pending price approval and that the
 * alteration detail page puts pricing decisions before read-only history
 * in DOM order — the two structural fixes the UX audit called for.
 *
 * Seeds the pending proposal by inserting directly as service_role rather
 * than exercising the full workshop-manager propose flow — reaching that
 * state legitimately needs its own workshop + workshop_manager staff
 * fixture, which is out of scope for what this test is verifying (the
 * dashboard/detail-page read surfaces, not the propose RPC itself, which
 * already has its own coverage in alteration-workflow-repository.test.ts).
 */
test("owner sees a pending price approval on the dashboard and can jump straight to it", async ({
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

  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // Create a garment work order through the real UI flow, same as
  // workspace.spec.ts's intake test.
  await page.goto("/alterations/new");
  await page.getByLabel("Customer").selectOption({ index: 1 });
  await page.getByLabel("Garment type").fill("Dashboard digest fixture jacket");
  await page.getByLabel("Description").fill("Fixture garment for e2e.");
  await page
    .getByLabel("Intake condition")
    .fill("Good condition, no visible wear.");
  await page.getByLabel("Observation area").fill("Waist");
  await page
    .getByLabel("Observation", { exact: true })
    .fill("Waist needs taking in by 1 inch.");
  await page.getByLabel("Work-now task").fill("Take in waist 1 inch");
  await page.getByRole("button", { name: "Create work order" }).click();
  await expect(page).toHaveURL(/\/alterations\/([0-9a-f-]+)$/);
  const alterationId = page.url().match(/\/alterations\/([0-9a-f-]+)$/)?.[1];
  if (!alterationId) throw new Error("Failed to capture alteration id");

  // Seed a pending price proposal directly (see file docstring).
  const { data: workOrder } = await admin
    .from("alteration_work_orders")
    .select("retailer_id, work_order_number, original_quote_currency")
    .eq("id", alterationId)
    .single();
  if (!workOrder) throw new Error("Fixture work order not found");
  const { data: staffRow } = await admin
    .from("retailer_staff_members")
    .select("id")
    .eq("retailer_id", workOrder.retailer_id)
    .eq("email", TEST_OWNER_EMAIL)
    .single();
  if (!staffRow) throw new Error("Fixture staff row not found");
  const { error: insertError } = await admin
    .from("price_change_proposals")
    .insert({
      alteration_id: alterationId,
      retailer_id: workOrder.retailer_id,
      original_amount_minor_units: 12000,
      proposed_amount_minor_units: 15000,
      currency: workOrder.original_quote_currency,
      explanation: "Extra hand-finishing required at the waist.",
      status: "pending",
      proposed_by_staff_id: staffRow.id,
    });
  if (insertError) throw insertError;

  // The dashboard surfaces it as an actionable card, not buried in a list.
  await page.goto("/dashboard");
  await expect(page.getByText("Needs your attention")).toBeVisible();
  await expect(
    page.getByText(`Price approval needed · ${workOrder.work_order_number}`),
  ).toBeVisible();

  // Clicking through lands on the pricing anchor, and the pricing section
  // renders before chain-of-custody in DOM order (not buried at the
  // bottom of the page).
  await page
    .getByText(`Price approval needed · ${workOrder.work_order_number}`)
    .click();
  await expect(page).toHaveURL(
    new RegExp(`/alterations/${alterationId}#pricing$`),
  );
  await expect(
    page.getByRole("heading", { name: "Pricing proposals" }),
  ).toBeVisible();
  await expect(page.getByText(/Proposed by E2E Owner/)).toBeVisible();

  const headings = await page
    .getByRole("heading", { level: 2 })
    .allTextContents();
  const pricingIndex = headings.indexOf("Pricing proposals");
  const custodyIndex = headings.indexOf("Chain of custody");
  expect(pricingIndex).toBeGreaterThanOrEqual(0);
  expect(custodyIndex).toBeGreaterThanOrEqual(0);
  expect(pricingIndex).toBeLessThan(custodyIndex);
});

/**
 * The price-approval card above is the only "Needs your attention" card
 * type with any browser proof (docs/FOUNDER_TOOL_BLUEPRINTS.md FT-05 flags
 * the advisor-facing Today dashboard as real but unverified). Today's
 * appointment is the most central of the remaining card types, so this
 * proves the dashboard reads a real appointment — not just the booking
 * flow already covered by workspace.spec.ts — and links through correctly.
 * Seeded directly (see the file docstring above for why direct seeding is
 * in scope here): the read surface under test is the dashboard card, not
 * the booking Server Action, which has its own coverage.
 */
test("owner sees today's appointment as a dashboard attention card", async ({
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

  const { data: retailer } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", "e2e-retailer-workspace")
    .single();
  if (!retailer) throw new Error("E2E retailer is missing");
  const { data: customer } = await admin
    .from("customers")
    .select("id, full_name")
    .eq("retailer_id", retailer.id)
    .limit(1)
    .single();
  if (!customer) throw new Error("E2E fixture customer is missing");

  // Noon UTC on the current UTC calendar date — matches the dashboard's
  // own `isToday` (UTC year/month/date comparison) regardless of what
  // time the suite happens to run.
  const now = new Date();
  const startsAt = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      12,
      0,
      0,
    ),
  );
  const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);

  const { data: appointment, error: insertError } = await admin
    .from("appointments")
    .insert({
      retailer_id: retailer.id,
      customer_id: customer.id,
      type: "styling_consultation",
      status: "confirmed",
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
    })
    .select("id")
    .single();
  if (insertError) throw insertError;

  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await expect(page.getByText("Needs your attention")).toBeVisible();
  const card = page
    .locator("#attention a[href*='/appointments/']")
    .filter({ hasText: customer.full_name });
  await expect(card).toBeVisible();
  await expect(card).toContainText("Styling consultation");

  await card.click();
  await expect(page).toHaveURL(`/appointments/${appointment!.id}`);

  await admin.from("appointments").delete().eq("id", appointment!.id);
});
