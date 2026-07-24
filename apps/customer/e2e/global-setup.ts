import {
  AlterationRepository,
  AlterationTaskRepository,
  AlterationUpdateRepository,
  AlterationWorkflowRepository,
  CustomerRepository,
  ProductRepository,
  ProductVariantRepository,
  RetailerRepository,
  RetailerStaffRepository,
  WorkshopRepository,
  createSupabaseAdminClient,
} from "@paon/database";
import type { UserId } from "@paon/domain";

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
  const storefrontVariant = existingVariants.find(
    (variant) => variant.sku === "E2E-OVERCOAT-42",
  );
  if (storefrontVariant) {
    await variantRepo.update(storefrontVariant.id, {
      sku: "E2E-OVERCOAT-42",
      size: "42",
      price: { amountMinorUnits: 450000, currency: "USD" },
      inventoryQuantity: 10,
    });
  } else {
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
  // test reads. This uses the same transactional garment-first intake and
  // validated transition path as production; the functions deliberately
  // grant service_role for fixtures/internal tooling.
  const customer = (await customerRepo.findByRetailer(retailer.id)).find(
    (c) => c.email === TEST_CUSTOMER_EMAIL,
  );
  if (customer) {
    const alterationRepo = new AlterationRepository(admin);
    const alterationTaskRepo = new AlterationTaskRepository(admin);
    const alterationUpdateRepo = new AlterationUpdateRepository(admin);
    const alterationWorkflowRepo = new AlterationWorkflowRepository(admin);
    const staffRepo = new RetailerStaffRepository(admin);
    const workshopRepo = new WorkshopRepository(admin);

    const fixtureActorEmail = "e2e-alteration-actor@paon.test";
    const { data: existingUsers, error: listUsersError } =
      await admin.auth.admin.listUsers({ perPage: 1000 });
    if (listUsersError) throw listUsersError;
    let fixtureActorUserId = existingUsers.users.find(
      (user) => user.email === fixtureActorEmail,
    )?.id;
    if (!fixtureActorUserId) {
      const { data, error } = await admin.auth.admin.createUser({
        email: fixtureActorEmail,
        password: "E2E-alteration-actor-123!",
        email_confirm: true,
      });
      if (error || !data.user) {
        throw new Error(
          `Failed to create alteration fixture actor: ${error?.message ?? "unknown error"}`,
        );
      }
      fixtureActorUserId = data.user.id;
    }
    let fixtureActor = await staffRepo.findByUserId(
      fixtureActorUserId as UserId,
    );
    if (!fixtureActor) {
      fixtureActor = await staffRepo.create({
        retailerId: retailer.id,
        userId: fixtureActorUserId as UserId,
        fullName: "E2E Alteration Actor",
        email: fixtureActorEmail,
        role: "owner",
      });
    }
    await admin
      .from("retailer_staff_members")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", fixtureActor.id)
      .is("accepted_at", null);

    let workshop = (await workshopRepo.findByRetailer(retailer.id)).find(
      (candidate) => candidate.name === "E2E Alteration Workshop",
    );
    workshop ??= await workshopRepo.create({
      retailerId: retailer.id,
      name: "E2E Alteration Workshop",
    });

    const existingAlterations = (
      await alterationRepo.findByRetailer(retailer.id)
    ).filter((workOrder) => workOrder.customerId === customer.id);
    let alteration = existingAlterations[0] ?? null;
    if (!alteration) {
      const alterationId = await alterationRepo.createIntake({
        customerId: customer.id,
        sourceKind: "external",
        categoryCode: "trousers",
        garmentType: "Wool trousers",
        description: "Charcoal wool trousers",
        labelMetadata: {},
        intakeCondition: "Clean, no visible damage",
        observations: [
          {
            area: "Waist",
            observation: "One inch loose",
            classification: "work_now",
          },
        ],
        tasks: [
          { title: "Take in waist by one inch", classification: "work_now" },
        ],
      });
      alteration = await alterationRepo.findById(alterationId);
    }
    if (!alteration) throw new Error("Alteration fixture was not created.");

    let status = alteration.status;
    if (status === "intake") {
      await alterationUpdateRepo.transition({
        alterationId: alteration.id,
        toStatus: "quoted",
        customerVisible: true,
      });
      status = "quoted";
    }
    if (status === "quoted" || status === "awaiting_approval") {
      await alterationUpdateRepo.transition({
        alterationId: alteration.id,
        toStatus: "approved",
        customerVisible: true,
      });
      status = "approved";
    }
    if (status === "approved") {
      await alterationWorkflowRepo.assign({
        alterationId: alteration.id,
        workshopId: workshop.id,
      });
      status = "assigned";
    }
    if (status === "assigned" || status === "in_progress") {
      const tasks = await alterationTaskRepo.findByAlteration(alteration.id);
      for (const task of tasks.filter(
        (candidate) => candidate.classification === "work_now",
      )) {
        if (task.status === "assigned") {
          await alterationTaskRepo.updateStatus(task.id, "in_progress");
        }
        if (task.status === "assigned" || task.status === "in_progress") {
          await alterationTaskRepo.updateStatus(task.id, "review_ready");
        }
      }
      if (status === "assigned") {
        await alterationUpdateRepo.transition({
          alterationId: alteration.id,
          toStatus: "in_progress",
          customerVisible: true,
        });
      }
      await alterationUpdateRepo.transition({
        alterationId: alteration.id,
        toStatus: "completion_review",
        customerVisible: true,
      });
      status = "completion_review";
    }
    if (status === "completion_review") {
      await alterationUpdateRepo.transition({
        alterationId: alteration.id,
        toStatus: "ready_for_pickup",
        note: "Ready at the front desk.",
        customerVisible: true,
      });
    }
  }
}

export default globalSetup;
