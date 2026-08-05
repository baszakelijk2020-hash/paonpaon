import { CustomerRepository, createSupabaseAdminClient } from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import {
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
  TEST_RETAILER_SLUG,
} from "./fixtures";
import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "17.12";
const BROWSER_PROOF_SPEC = "apps/retailer/e2e/cart-soft-close.spec.ts";

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
 * Proves ambient/frictionless checkout's provider-neutral core (PHASE
 * 17.12 / ADV-112): a customer's real, server-persisted draft cart
 * (never a new persistence layer — the existing `orders` "draft" status
 * already is digital-to-physical) surfaces on the advisor's customer
 * page with a real SMS/WhatsApp/Email deep link to the customer's own
 * cart page, so the advisor sends a review-and-pay gesture to the
 * customer's own device rather than ringing the sale up on a register.
 * A customer with no draft cart shows no such card — never a fabricated
 * empty state.
 */
test("a customer's real draft cart surfaces with a working soft-close deep link, and no cart means no card", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  const { data: retailer } = await admin
    .from("retailers")
    .select("id, slug")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");
  const retailerId = asId<"RetailerId">(retailer.id);

  const unique = Date.now();
  const customerRepo = new CustomerRepository(admin);

  const withCart = await customerRepo.create({
    retailerId,
    fullName: `E2E Cart Soft Close ${unique}`,
    email: `cart-soft-close-${unique}@paon.test`,
    phone: "+1 (555) 345-6789",
    lifecycleStage: "prospect",
  });
  const withoutCart = await customerRepo.create({
    retailerId,
    fullName: `E2E No Cart ${unique}`,
    email: `no-cart-${unique}@paon.test`,
    lifecycleStage: "prospect",
  });

  const { data: cartRow, error: cartError } = await admin
    .from("orders")
    .insert({
      retailer_id: retailerId,
      customer_id: withCart.id,
      order_number: `E2E-CART-${unique}`,
      status: "draft",
      channel: "online",
      currency: "USD",
      subtotal_amount_minor_units: 189_900,
      total_amount_minor_units: 189_900,
    })
    .select("id")
    .single();
  if (cartError || !cartRow) throw new Error("failed to seed draft cart");

  try {
    await page.goto(`/customers/${withCart.id}`);
    const card = page.locator("[data-cart-soft-close-card]").first();
    await expect(card).toBeVisible();
    await expect(card.getByText("$1,899.00")).toBeVisible();
    await expect(card.locator('a[data-channel="sms"]')).toHaveAttribute(
      "href",
      /^sms:\+15553456789\?&body=/,
    );
    await expect(card.locator('a[data-channel="whatsapp"]')).toHaveAttribute(
      "href",
      /^https:\/\/wa\.me\/15553456789\?text=/,
    );
    const emailHref = await card
      .locator('a[data-channel="email"]')
      .getAttribute("href");
    expect(emailHref).toContain(`mailto:${withCart.email}`);
    expect(decodeURIComponent(emailHref ?? "")).toContain(
      `/r/${TEST_RETAILER_SLUG}/cart`,
    );

    await page.goto(`/customers/${withoutCart.id}`);
    await expect(page.locator("[data-cart-soft-close-card]")).toHaveCount(0);

    proofPassed = true;
  } finally {
    await admin.from("orders").delete().eq("id", cartRow.id);
    await admin.from("customers").delete().eq("id", withCart.id);
    await admin.from("customers").delete().eq("id", withoutCart.id);
  }
});
