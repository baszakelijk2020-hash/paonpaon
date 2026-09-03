import { createSupabaseAdminClient } from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test, type Page } from "@playwright/test";

import {
  AUTH_DELIVERABLE_DOMAIN,
  TEST_CUSTOMER_EMAIL,
  TEST_PRODUCT_SLUG,
  TEST_RETAILER_SLUG,
} from "./fixtures";
import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "10.2";
const BROWSER_PROOF_SPEC =
  "apps/customer/e2e/honeymoon-programme-multi-role.spec.ts";
const RETAILER_BASE_URL = "http://localhost:3001";

const PREPARATION_TITLE = "Prepare fitting notes and confirm lead time";
const COLLECTION_TITLE = "Arrange collection or delivery briefing";
const AFTERCARE_TITLE = "Schedule aftercare and fit check-in";

let proofPassed = false;

test.afterAll(async () => {
  await writeBrowserProofRun({
    phaseItemId: PHASE_ITEM_ID,
    spec: BROWSER_PROOF_SPEC,
    status: proofPassed ? "passed" : "failed",
  });
});

async function signInCustomer(
  page: Page,
  admin: ReturnType<typeof createSupabaseAdminClient>,
  email: string,
): Promise<void> {
  const { data: existingUsers, error: listUsersError } =
    await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listUsersError) throw listUsersError;
  const hasAuthUser = existingUsers.users.some((user) => user.email === email);
  if (!hasAuthUser) {
    const { error: createUserError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (createUserError) throw createUserError;
  }

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error || !data.properties) {
    throw new Error(
      `Failed to generate magic link: ${error?.message ?? "unknown error"}`,
    );
  }
  await page.goto(
    `/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`,
  );
  await expect(page).toHaveURL(/\/dashboard$/);
}

/**
 * PHASE 10.2 multi-role browser proof: the same order-to-delivery programme is
 * visible to retailer staff and the owning customer with matching action truth.
 */
test("honeymoon-programme: retailer and customer see the same order-to-delivery actions", async ({
  page,
}) => {
  test.setTimeout(180_000);

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
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");
  const retailerId = asId<"RetailerId">(retailer.id);

  const { data: customerRow } = await admin
    .from("customers")
    .select("id")
    .eq("retailer_id", retailerId)
    .eq("email", TEST_CUSTOMER_EMAIL)
    .maybeSingle();
  if (!customerRow) throw new Error("fixture customer missing");

  const { data: product } = await admin
    .from("products")
    .select("id")
    .eq("retailer_id", retailerId)
    .eq("slug", TEST_PRODUCT_SLUG)
    .single();
  if (!product) throw new Error("fixture product missing");

  const { data: variant } = await admin
    .from("product_variants")
    .select("id, inventory_quantity")
    .eq("product_id", product.id)
    .eq("sku", "E2E-OVERCOAT-42")
    .maybeSingle();
  if (!variant) throw new Error("fixture product variant missing");

  const ownerEmail = `honeymoon-owner-${Date.now()}@${AUTH_DELIVERABLE_DOMAIN}`;
  const ownerPassword = "TestPassword123!";
  const { data: ownerAuth, error: ownerAuthError } =
    await admin.auth.admin.createUser({
      email: ownerEmail,
      password: ownerPassword,
      email_confirm: true,
    });
  if (ownerAuthError || !ownerAuth.user) {
    throw new Error(
      `failed to create retailer owner: ${ownerAuthError?.message ?? "unknown"}`,
    );
  }

  const { error: staffError } = await admin
    .from("retailer_staff_members")
    .insert({
      retailer_id: retailerId,
      user_id: ownerAuth.user.id,
      email: ownerEmail,
      role: "owner",
      full_name: "Honeymoon E2E Owner",
      accepted_at: new Date().toISOString(),
    });
  if (staffError) throw staffError;

  const orderNumber = `E2E-HONEYMOON-MR-${Date.now()}`;
  const priceMinorUnits = 450000;
  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      retailer_id: retailerId,
      customer_id: customerRow.id,
      order_number: orderNumber,
      status: "placed",
      channel: "online",
      currency: "USD",
      subtotal_amount_minor_units: priceMinorUnits,
      total_amount_minor_units: priceMinorUnits,
    })
    .select("id")
    .single();
  if (orderError || !order) {
    throw new Error(
      `Failed to create order: ${orderError?.message ?? "unknown error"}`,
    );
  }

  const { error: lineError } = await admin.from("order_lines").insert({
    order_id: order.id,
    product_variant_id: variant.id,
    quantity: 1,
    unit_price_amount_minor_units: priceMinorUnits,
    unit_price_currency: "USD",
    requires_production: false,
    requires_alteration: false,
  });
  if (lineError) {
    throw new Error(`Failed to insert order_line: ${lineError.message}`);
  }

  try {
    await page.goto(`${RETAILER_BASE_URL}/login`);
    await page.getByLabel("Email").fill(ownerEmail);
    await page.getByLabel("Password").fill(ownerPassword);
    await page.getByRole("button", { name: "Enter the atelier" }).click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });

    await page.goto(`${RETAILER_BASE_URL}/orders/${order.id}`);
    const retailerCard = page.getByTestId("honeymoon-programme-card");
    await expect(retailerCard).toBeVisible();
    await expect(retailerCard.getByText(PREPARATION_TITLE)).toBeVisible();
    await expect(retailerCard.getByText(COLLECTION_TITLE)).toBeVisible();
    await expect(retailerCard.getByText(AFTERCARE_TITLE)).toBeVisible();
    await expect(
      retailerCard.getByText("Not yet actionable").first(),
    ).toBeVisible();

    await page.context().clearCookies();
    await signInCustomer(page, admin, TEST_CUSTOMER_EMAIL);

    await page.goto(`/orders/${order.id}`);
    const customerCard = page.getByTestId("honeymoon-programme-card");
    await expect(customerCard).toBeVisible();
    await expect(customerCard.getByText(PREPARATION_TITLE)).toBeVisible();
    await expect(customerCard.getByText(COLLECTION_TITLE)).toBeVisible();
    await expect(customerCard.getByText(AFTERCARE_TITLE)).toBeVisible();
    await expect(
      customerCard.getByText("See your seven-day look plan"),
    ).toBeVisible();

    proofPassed = true;
  } finally {
    const { data: programme } = await admin
      .from("honeymoon_programmes")
      .select("id")
      .eq("order_id", order.id)
      .maybeSingle();
    if (programme) {
      await admin
        .from("honeymoon_programme_actions")
        .delete()
        .eq("programme_id", programme.id);
      await admin.from("honeymoon_programmes").delete().eq("id", programme.id);
    }
    await admin.from("order_lines").delete().eq("order_id", order.id);
    await admin.from("orders").delete().eq("id", order.id);
    await admin.from("retailer_staff_members").delete().eq("email", ownerEmail);
    await admin.auth.admin.deleteUser(ownerAuth.user.id);
  }
});
