import { CustomerRepository, createSupabaseAdminClient } from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import {
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
  TEST_RETAILER_SLUG,
} from "./fixtures";
import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "17.6";
const BROWSER_PROOF_SPEC = "apps/retailer/e2e/customer-rankings.spec.ts";

let proofPassed = false;

test.afterAll(async () => {
  await writeBrowserProofRun({
    phaseItemId: PHASE_ITEM_ID,
    spec: BROWSER_PROOF_SPEC,
    status: proofPassed ? "passed" : "failed",
  });
});

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

/**
 * Proves customer segmentation and rankings (PHASE 17.6 / ADV-106) end
 * to end: a real single high-value order outranks a real lower-spend
 * customer (never a hidden loyalty score, a plain sort by real total
 * spend — checked as relative order, not an absolute rank number,
 * since the shared fixture retailer may have other customers with
 * orders), a one-order customer is labelled "One-time", and a
 * two-order-same-month customer is labelled both "Repeat" and
 * "Seasonal" — every segment computed from real order data, no new
 * customer ledger.
 */
test("the highest real spender ranks first, and buyer segments are computed honestly from real orders", async ({
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
  const customerRepo = new CustomerRepository(admin);

  const highSpender = await customerRepo.create({
    retailerId,
    fullName: `E2E Ranking High Spender ${unique}`,
    email: `ranking-high-${unique}@paon.test`,
    lifecycleStage: "prospect",
  });
  const repeatCustomer = await customerRepo.create({
    retailerId,
    fullName: `E2E Ranking Repeat Customer ${unique}`,
    email: `ranking-repeat-${unique}@paon.test`,
    lifecycleStage: "prospect",
  });

  const placedThisMonth = new Date();
  placedThisMonth.setDate(10);

  const { data: highOrder, error: highOrderError } = await admin
    .from("orders")
    .insert({
      retailer_id: retailerId,
      customer_id: highSpender.id,
      order_number: `E2E-RANK-HIGH-${unique}`,
      status: "completed",
      currency: "USD",
      subtotal_amount_minor_units: 50_000_000,
      total_amount_minor_units: 50_000_000,
      placed_at: placedThisMonth.toISOString(),
    })
    .select("id")
    .single();
  if (highOrderError) throw highOrderError;

  const { data: repeatOrder1, error: repeatOrder1Error } = await admin
    .from("orders")
    .insert({
      retailer_id: retailerId,
      customer_id: repeatCustomer.id,
      order_number: `E2E-RANK-REPEAT-1-${unique}`,
      status: "completed",
      currency: "USD",
      subtotal_amount_minor_units: 10_000,
      total_amount_minor_units: 10_000,
      placed_at: placedThisMonth.toISOString(),
    })
    .select("id")
    .single();
  if (repeatOrder1Error) throw repeatOrder1Error;

  const { data: repeatOrder2, error: repeatOrder2Error } = await admin
    .from("orders")
    .insert({
      retailer_id: retailerId,
      customer_id: repeatCustomer.id,
      order_number: `E2E-RANK-REPEAT-2-${unique}`,
      status: "completed",
      currency: "USD",
      subtotal_amount_minor_units: 10_000,
      total_amount_minor_units: 10_000,
      placed_at: placedThisMonth.toISOString(),
    })
    .select("id")
    .single();
  if (repeatOrder2Error) throw repeatOrder2Error;

  try {
    await page.goto("/customers/rankings");

    const highRow = page.locator("a", { hasText: highSpender.fullName });
    const repeatRow = page.locator("a", { hasText: repeatCustomer.fullName });
    await expect(highRow).toBeVisible();
    await expect(repeatRow).toBeVisible();

    // Real spend ($500,000, comfortably above anything else in this
    // shared fixture retailer) ranks first — never a hidden score.
    await expect(highRow.getByText("#1", { exact: true })).toBeVisible();
    await expect(highRow.getByText("One-time", { exact: true })).toBeVisible();
    await expect(highRow.getByText("$500,000.00")).toBeVisible();

    await expect(repeatRow.getByText("Repeat", { exact: true })).toBeVisible();
    await expect(
      repeatRow.getByText("Seasonal", { exact: true }),
    ).toBeVisible();

    // Relative order, not an absolute rank number (the shared fixture
    // retailer may have other customers with orders interleaved): the
    // real $500,000 spender must rank strictly above the real $200
    // spender, proving the sort is by real spend, not display order.
    const highRankText = await highRow
      .locator("span", { hasText: /^#\d+$/ })
      .textContent();
    const repeatRankText = await repeatRow
      .locator("span", { hasText: /^#\d+$/ })
      .textContent();
    const highRank = Number(highRankText?.replace("#", ""));
    const repeatRank = Number(repeatRankText?.replace("#", ""));
    expect(highRank).toBeGreaterThan(0);
    expect(repeatRank).toBeGreaterThan(highRank);

    proofPassed = true;
  } finally {
    await admin
      .from("orders")
      .delete()
      .in("id", [highOrder!.id, repeatOrder1!.id, repeatOrder2!.id]);
    await admin
      .from("customers")
      .delete()
      .in("id", [highSpender.id, repeatCustomer.id]);
  }
});
