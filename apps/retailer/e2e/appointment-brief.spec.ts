import {
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

const PHASE_ITEM_ID = "17.3";
const BROWSER_PROOF_SPEC = "apps/retailer/e2e/appointment-brief.spec.ts";

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
 * Proves PHASE 17.3's own real additions end to end: a real price
 * comfort band computed from real order totals (never a fabricated
 * band with no orders behind it), purchase history rendered on the
 * appointment page, a wishlisted variant the customer already bought
 * correctly excluded from "favourited, never bought" while an unbought
 * one is correctly included, and the sensitive-info toggle hides the
 * customer's real contact details until explicitly shown.
 */
test("the appointment brief shows a real price band, purchase history, an honest wishlist gap, and hides contact info until shown", async ({
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
    fullName: `E2E Appointment Brief Client ${unique}`,
    email: `appointment-brief-${unique}@paon.test`,
    phone: "+15551234567",
    lifecycleStage: "prospect",
  });

  // Two products: one the customer has both wishlisted AND bought (must
  // NOT appear as a gap), one only wishlisted (must appear as a gap).
  const { data: boughtProduct } = await admin
    .from("products")
    .insert({
      retailer_id: retailerId,
      name: `E2E Brief Bought Jacket ${unique}`,
      slug: `e2e-brief-bought-${unique}`,
      status: "active",
    })
    .select("id")
    .single();
  const { data: boughtVariant } = await admin
    .from("product_variants")
    .insert({
      product_id: boughtProduct!.id,
      sku: `BRIEF-BOUGHT-${unique}`,
      price_amount_minor_units: 200_000,
      price_currency: "USD",
      inventory_quantity: 10,
    })
    .select("id")
    .single();

  const { data: unboughtProduct } = await admin
    .from("products")
    .insert({
      retailer_id: retailerId,
      name: `E2E Brief Unbought Overcoat ${unique}`,
      slug: `e2e-brief-unbought-${unique}`,
      status: "active",
    })
    .select("id")
    .single();
  const { data: unboughtVariant } = await admin
    .from("product_variants")
    .insert({
      product_id: unboughtProduct!.id,
      sku: `BRIEF-UNBOUGHT-${unique}`,
      price_amount_minor_units: 300_000,
      price_currency: "USD",
      inventory_quantity: 10,
    })
    .select("id")
    .single();

  // A real order for the bought variant — premium band (avg $2,000).
  const { data: order } = await admin
    .from("orders")
    .insert({
      retailer_id: retailerId,
      customer_id: customer.id,
      order_number: `E2E-BRIEF-${unique}`,
      status: "completed",
      currency: "USD",
      subtotal_amount_minor_units: 200_000,
      total_amount_minor_units: 200_000,
      placed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  await admin.from("order_lines").insert({
    order_id: order!.id,
    product_variant_id: boughtVariant!.id,
    quantity: 1,
    unit_price_amount_minor_units: 200_000,
    unit_price_currency: "USD",
  });

  // A wishlist with both variants.
  const { data: wishlist } = await admin
    .from("wishlists")
    .insert({ customer_id: customer.id })
    .select("id")
    .single();
  await admin.from("wishlist_items").insert([
    { wishlist_id: wishlist!.id, product_variant_id: boughtVariant!.id },
    { wishlist_id: wishlist!.id, product_variant_id: unboughtVariant!.id },
  ]);

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

  try {
    await page.goto(`/appointments/${appointment.id}`);
    await expect(page.getByText("Purchase and fit intelligence")).toBeVisible();

    // Real price band: one order at $2,000 -> premium.
    await expect(page.getByText("premium comfort")).toBeVisible();
    await expect(page.getByText(/Average order.*\$2,000\.00/)).toBeVisible();

    // Purchase history.
    await expect(page.getByText(`E2E-BRIEF-${unique}`)).toBeVisible();

    // Honest wishlist gap: the unbought item appears, the bought one
    // never does — proving the match against real order lines, not a
    // guess.
    await expect(
      page.getByText(`E2E Brief Unbought Overcoat ${unique}`),
    ).toBeVisible();
    await expect(
      page.getByText(`E2E Brief Bought Jacket ${unique}`),
    ).toHaveCount(0);

    // Sensitive-info toggle: hidden by default, real email revealed only
    // after an explicit click.
    await expect(
      page.getByText(`appointment-brief-${unique}@paon.test`),
    ).toHaveCount(0);
    await expect(page.getByText(/tap Show only when/)).toBeVisible();
    await page.getByRole("button", { name: "Show" }).first().click();
    await expect(
      page.getByText(`appointment-brief-${unique}@paon.test`),
    ).toBeVisible();

    proofPassed = true;
  } finally {
    await admin.from("wishlist_items").delete().eq("wishlist_id", wishlist!.id);
    await admin.from("wishlists").delete().eq("id", wishlist!.id);
    await admin.from("order_lines").delete().eq("order_id", order!.id);
    await admin.from("orders").delete().eq("id", order!.id);
    await admin.from("appointments").delete().eq("id", appointment.id);
    await admin.from("product_variants").delete().eq("id", boughtVariant!.id);
    await admin.from("products").delete().eq("id", boughtProduct!.id);
    await admin.from("product_variants").delete().eq("id", unboughtVariant!.id);
    await admin.from("products").delete().eq("id", unboughtProduct!.id);
    await admin.from("customers").delete().eq("id", customer.id);
  }
});
