import {
  AlterationRepository,
  AlterationUpdateRepository,
  CustomerRepository,
  ProductRepository,
  ProductVariantRepository,
  RetailerRepository,
  createSupabaseAdminClient,
} from "@paon/database";

import {
  TEST_CUSTOMER_EMAIL,
  TEST_PRODUCT_SLUG,
  TEST_RETAILER_DISPLAY_NAME,
  TEST_RETAILER_SLUG,
} from "./fixtures";

/**
 * Provisions one active retailer with a still-unlinked `customers` row
 * (email only, no `user_id`) and one active, in-stock product before
 * the e2e suite runs — the customer record is what
 * `link_my_customer_accounts` should pick up the first time
 * TEST_CUSTOMER_EMAIL signs in (see login.spec.ts); the product is what
 * storefront.spec.ts orders. Idempotent so re-running locally against
 * the same stack doesn't fail on duplicate records.
 */
async function globalSetup(): Promise<void> {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "e2e global setup requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY — run `supabase start` and export its printed values first.",
    );
  }

  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
  const retailerRepo = new RetailerRepository(admin);
  const customerRepo = new CustomerRepository(admin);
  const productRepo = new ProductRepository(admin);
  const variantRepo = new ProductVariantRepository(admin);

  let retailer = await retailerRepo.findBySlug(TEST_RETAILER_SLUG);
  if (!retailer) {
    retailer = await retailerRepo.create({
      legalName: `${TEST_RETAILER_DISPLAY_NAME}, Inc.`,
      displayName: TEST_RETAILER_DISPLAY_NAME,
      slug: TEST_RETAILER_SLUG,
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
  }

  // Storefront visibility (docs/DECISIONS.md ADR-014) requires an
  // active retailer — RetailerRepository.create defaults to
  // pending_onboarding.
  if (retailer.status !== "active") {
    await admin
      .from("retailers")
      .update({ status: "active" })
      .eq("id", retailer.id);
  }

  const existingCustomers = await customerRepo.findByRetailer(retailer.id);
  const alreadyExists = existingCustomers.some(
    (customer) => customer.email === TEST_CUSTOMER_EMAIL,
  );

  if (!alreadyExists) {
    await customerRepo.create({
      retailerId: retailer.id,
      fullName: "E2E Shopper",
      email: TEST_CUSTOMER_EMAIL,
      lifecycleStage: "returning",
    });
  }

  let product = await productRepo.findBySlug(retailer.id, TEST_PRODUCT_SLUG);
  if (!product) {
    product = await productRepo.create({
      retailerId: retailer.id,
      name: "E2E Storefront Overcoat",
      slug: TEST_PRODUCT_SLUG,
      description: "A test product for storefront e2e coverage.",
      status: "active",
      isMadeToOrder: false,
      isAlterable: false,
    });
  }

  const existingVariants = await variantRepo.findByProduct(product.id);
  if (existingVariants.length === 0) {
    await variantRepo.create({
      productId: product.id,
      sku: "E2E-OVERCOAT-42",
      size: "42",
      price: { amountMinorUnits: 450000, currency: "USD" },
      inventoryQuantity: 10,
    });
  }

  // A ready-for-pickup alteration for TEST_CUSTOMER_EMAIL's customer —
  // what appointments-alterations.spec.ts's "sees pickup readiness"
  // test reads. Seeded directly (admin client bypasses RLS) rather
  // than through any RPC, since alteration creation has no
  // client-trust concerns place_order/request_appointment have to
  // guard against.
  const customer = (await customerRepo.findByRetailer(retailer.id)).find(
    (c) => c.email === TEST_CUSTOMER_EMAIL,
  );
  if (customer) {
    const alterationRepo = new AlterationRepository(admin);
    const alterationUpdateRepo = new AlterationUpdateRepository(admin);
    const existingAlterations = await alterationRepo.findByCustomer(
      customer.id,
    );
    if (existingAlterations.length === 0) {
      const alteration = await alterationRepo.create({
        retailerId: retailer.id,
        customerId: customer.id,
        instructions: "Take in the waist by 1 inch.",
      });
      await alterationUpdateRepo.add({
        alterationId: alteration.id,
        retailerId: retailer.id,
        status: "ready_for_pickup",
        note: "Ready at the front desk.",
      });
    }
  }
}

export default globalSetup;
