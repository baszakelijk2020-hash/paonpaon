import {
  OrderRepository,
  PlatformModuleRepository,
  ProductRepository,
  ProductVariantRepository,
  RetailerBranchRepository,
  RetailerRepository,
  RetailerStaffRepository,
  assertSafeSupabaseWriteTarget,
  createSupabaseAdminClient,
  createSupabaseDirectClient,
} from "@paon/database";
import { ensureProgrammeProofSeed } from "@paon/database/programme-proof-seed";
import { PLATFORM_MODULES, type RetailerId, type UserId } from "@paon/domain";

import {
  TEST_ORDER_PRODUCT_SLUG,
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
  TEST_RETAILER_SLUG,
} from "./fixtures";

/**
 * Provisions one active, fully-onboarded retailer with an accepted
 * owner before the e2e suite runs — the stable workspace login.spec.ts,
 * workspace.spec.ts and accept-invite.spec.ts's "already accepted"
 * case sign in against. accept-invite.spec.ts's own "not yet accepted"
 * scenario provisions its own retailer per test instead (see that
 * file) since it needs `pending_onboarding` state a shared fixture
 * can't safely offer to tests running in parallel. Idempotent so
 * re-running locally against the same stack doesn't fail on a
 * duplicate record.
 */
async function globalSetup(): Promise<void> {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const supabaseAnonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    throw new Error(
      "e2e global setup requires the local Supabase URL, anon key, and service-role key — run `supabase start` and export its printed values first.",
    );
  }

  assertSafeSupabaseWriteTarget({
    supabaseUrl,
    operation: "Retailer Playwright fixture setup",
  });

  // Inventory, loss-prevention and POS share the programme proof personas.
  // Seed that canonical graph once before Playwright starts parallel workers;
  // asking each worker to race through the same auth-user creation makes a
  // clean database depend on which test happens to win the first insert.
  const proof = await ensureProgrammeProofSeed({
    supabaseUrl,
    anonKey: supabaseAnonKey,
    serviceRoleKey,
  });

  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
  const retailerRepo = new RetailerRepository(admin);
  const staffRepo = new RetailerStaffRepository(admin);

  let retailer = await retailerRepo.findBySlug(TEST_RETAILER_SLUG);
  if (!retailer) {
    retailer = await retailerRepo.create({
      legalName: "E2E Workspace, Inc.",
      displayName: "E2E Workspace",
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

  await new RetailerBranchRepository(admin).ensureDefaultBranch({
    retailerId: retailer.id,
  });

  // Both shared e2e houses intentionally exercise the complete platform.
  // New production retailers receive modules through plans/add-ons instead.
  const moduleRepository = new PlatformModuleRepository(admin);
  for (const retailerId of [proof.retailerId as RetailerId, retailer.id]) {
    for (const platformModule of PLATFORM_MODULES) {
      await moduleRepository.configure({
        retailerId,
        moduleKey: platformModule.key,
        state: "active",
        authorityMode:
          platformModule.key === "platform_core" ? "paon" : "co_managed",
        source: "add_on",
      });
    }
  }
  // workspace.spec.ts temporarily edits the display name and restores it.
  // A failed/interrupted run must not make the next run inherit an ever-longer
  // name, otherwise the business-profile test eventually exceeds validation.
  if (retailer.displayName !== "E2E Workspace") {
    const { error } = await admin
      .from("retailers")
      .update({ display_name: "E2E Workspace" })
      .eq("id", retailer.id);
    if (error) throw error;
  }

  const { data: existingUsers, error: listError } =
    await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) {
    throw listError;
  }

  let userId = existingUsers.users.find(
    (user) => user.email === TEST_OWNER_EMAIL,
  )?.id;

  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email: TEST_OWNER_EMAIL,
      password: TEST_OWNER_PASSWORD,
      email_confirm: true,
    });
    if (error || !data.user) {
      throw new Error(
        `Failed to create e2e owner user: ${error?.message ?? "unknown error"}`,
      );
    }
    userId = data.user.id;
  }

  const existingStaff = await staffRepo.findByUserId(userId as UserId);
  if (!existingStaff) {
    await staffRepo.create({
      retailerId: retailer.id,
      userId: userId as UserId,
      fullName: "E2E Owner",
      email: TEST_OWNER_EMAIL,
      role: "owner",
    });
  }

  // Fixture-only: force this staff member straight to "accepted" — a
  // production account only reaches that state by calling
  // accept_retailer_staff_invite as themselves (docs/DECISIONS.md
  // ADR-012), but the service-role client used here has no
  // `auth.uid()` to satisfy that function's own-record check. Reaching
  // around the repository here (rather than adding a backdoor method
  // to it) keeps that guarantee real for every actual caller.
  await admin
    .from("retailer_staff_members")
    .update({ accepted_at: new Date().toISOString() })
    .eq("retailer_id", retailer.id)
    .is("accepted_at", null);

  if (retailer.status !== "active") {
    await admin
      .from("retailers")
      .update({ status: "active" })
      .eq("id", retailer.id);
  }

  // A pre-placed order for workspace.spec.ts's order-management test —
  // seeded via place_order (granted to service_role for exactly this;
  // see 20260719000012_create_orders.sql) rather than inserting into
  // orders/order_lines directly, so the fixture goes through the same
  // path a real checkout does.
  const productRepo = new ProductRepository(admin);
  const variantRepo = new ProductVariantRepository(admin);
  const customerClient = createSupabaseDirectClient(
    supabaseUrl,
    supabaseAnonKey,
  );
  const { error: signInError } = await customerClient.auth.signInWithPassword({
    email: TEST_OWNER_EMAIL,
    password: TEST_OWNER_PASSWORD,
  });
  if (signInError) throw signInError;
  const orderRepo = new OrderRepository(customerClient);

  let product = await productRepo.findBySlug(
    retailer.id,
    TEST_ORDER_PRODUCT_SLUG,
  );
  if (!product) {
    product = await productRepo.create({
      retailerId: retailer.id,
      name: "E2E Order Fixture Product",
      slug: TEST_ORDER_PRODUCT_SLUG,
      description: "",
      status: "active",
      isMadeToOrder: false,
      isAlterable: false,
    });
  }

  let variants = await variantRepo.findByProduct(product.id);
  if (variants.length === 0) {
    await variantRepo.create({
      productId: product.id,
      sku: "E2E-ORDER-FIXTURE",
      price: { amountMinorUnits: 10000, currency: "USD" },
      inventoryQuantity: 50,
    });
    variants = await variantRepo.findByProduct(product.id);
  }

  const existingOrders = await orderRepo.findByRetailer(retailer.id);
  if (existingOrders.length === 0) {
    const variant = variants[0];
    if (variant) {
      await orderRepo.placeOrder({
        retailerId: retailer.id,
        productVariantId: variant.id,
        quantity: 1,
      });
    }
  }
}

export default globalSetup;
