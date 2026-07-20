/**
 * One-off demo data seed for a LIVE (not local) Supabase project — for
 * manually testing the deployed apps end to end. Idempotent: safe to
 * re-run, skips anything that already exists by natural key (slug,
 * email).
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   pnpm --filter @paon/database seed:demo
 */
import type {
  CurrencyCode,
  CustomerId,
  RetailerId,
  StaffId,
  UserId,
} from "@paon/domain";

import {
  AlterationRepository,
  AlterationTaskRepository,
  AlterationUpdateRepository,
  AlterationWorkflowRepository,
  AppointmentRepository,
  AvailabilityWindowRepository,
  CollectionRepository,
  CustomerRepository,
  EventRepository,
  LoyaltyRepository,
  OrderRepository,
  PlatformStaffRepository,
  ProductRepository,
  ProductVariantRepository,
  RetailerRepository,
  RetailerStaffRepository,
  WorkshopRepository,
  createSupabaseAdminClient,
  createSupabaseDirectClient,
} from "../src";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value)
    throw new Error(`Missing required environment variable "${name}".`);
  return value;
}

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const ANON_KEY = requireEnv("SUPABASE_ANON_KEY");
const SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const DEMO_PASSWORD = "Demo-PAON-2026!";

const admin = createSupabaseAdminClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const logins: { role: string; email: string; password: string }[] = [];

async function ensureUser(email: string, fullName: string): Promise<UserId> {
  const { data: existing, error: listError } =
    await admin.auth.admin.listUsers();
  if (listError) throw listError;
  const found = existing.users.find((u) => u.email === email);
  if (found) return found.id as UserId;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) {
    throw new Error(
      `Failed to create user ${email}: ${error?.message ?? "unknown"}`,
    );
  }
  return data.user.id as UserId;
}

async function signedInClient(email: string) {
  const client = createSupabaseDirectClient(SUPABASE_URL, ANON_KEY);
  const { error } = await client.auth.signInWithPassword({
    email,
    password: DEMO_PASSWORD,
  });
  if (error) throw error;
  return client;
}

async function seedPlatformAdmin() {
  const email = "contact@nebelspiegel.com";
  const userId = await ensureUser(email, "Founder");
  const repo = new PlatformStaffRepository(admin);
  let staff = await repo.findByUserId(userId);
  staff ??= await repo.create({
    userId,
    fullName: "Founder",
    role: "platform_owner",
  });
  if (!staff.acceptedAt) {
    await admin
      .from("platform_staff_members")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", staff.id);
  }
  logins.push({
    role: "Platform admin (PAON Admin)",
    email,
    password: DEMO_PASSWORD,
  });
}

interface RetailerSpec {
  slug: string;
  displayName: string;
  legalName: string;
  currency: CurrencyCode;
  products: {
    name: string;
    slug: string;
    sku: string;
    priceMinor: number;
    size?: string;
  }[];
  collectionName: string;
  collectionSlug: string;
  customers: {
    name: string;
    email: string;
    portal: boolean;
    lifecycle: "prospect" | "first_purchase" | "returning" | "vip" | "lapsed";
  }[];
}

const RETAILERS: RetailerSpec[] = [
  {
    slug: "maison-dubois",
    displayName: "Maison Dubois",
    legalName: "Maison Dubois SARL",
    currency: "EUR",
    collectionName: "Signature Tailoring",
    collectionSlug: "signature-tailoring",
    products: [
      {
        name: "Single-Breasted Wool Suit",
        slug: "single-breasted-wool-suit",
        sku: "MD-SUIT-001",
        priceMinor: 285000,
        size: "50",
      },
      {
        name: "Silk Pocket Square",
        slug: "silk-pocket-square",
        sku: "MD-ACC-002",
        priceMinor: 8500,
      },
      {
        name: "Cashmere Overcoat",
        slug: "cashmere-overcoat",
        sku: "MD-COAT-003",
        priceMinor: 420000,
        size: "50",
      },
    ],
    customers: [
      {
        name: "Isabelle Laurent",
        email: "contact+isabelle@nebelspiegel.com",
        portal: true,
        lifecycle: "vip",
      },
      {
        name: "Marc Fontaine",
        email: "contact+marc@nebelspiegel.com",
        portal: true,
        lifecycle: "returning",
      },
      {
        name: "Sophie Renard",
        email: "contact+sophie@nebelspiegel.com",
        portal: false,
        lifecycle: "first_purchase",
      },
    ],
  },
  {
    slug: "casa-marchetti",
    displayName: "Casa Marchetti",
    legalName: "Casa Marchetti S.r.l.",
    currency: "EUR",
    collectionName: "Atelier Leather",
    collectionSlug: "atelier-leather",
    products: [
      {
        name: "Hand-Stitched Leather Briefcase",
        slug: "leather-briefcase",
        sku: "CM-BAG-001",
        priceMinor: 195000,
      },
      {
        name: "Made-to-Measure Blazer",
        slug: "made-to-measure-blazer",
        sku: "CM-JKT-002",
        priceMinor: 310000,
        size: "48",
      },
      {
        name: "Calfskin Belt",
        slug: "calfskin-belt",
        sku: "CM-ACC-003",
        priceMinor: 12500,
      },
    ],
    customers: [
      {
        name: "Giulia Romano",
        email: "contact+giulia@nebelspiegel.com",
        portal: true,
        lifecycle: "vip",
      },
      {
        name: "Luca Bianchi",
        email: "contact+luca@nebelspiegel.com",
        portal: true,
        lifecycle: "returning",
      },
      {
        name: "Elena Conti",
        email: "contact+elena@nebelspiegel.com",
        portal: false,
        lifecycle: "prospect",
      },
    ],
  },
];

const STAFF_ROLES: {
  role: "owner" | "manager" | "sales_associate" | "workshop_manager";
  label: string;
}[] = [
  { role: "owner", label: "owner" },
  { role: "manager", label: "manager" },
  { role: "sales_associate", label: "sales" },
  { role: "workshop_manager", label: "workshop" },
];

async function seedRetailer(spec: RetailerSpec) {
  const retailerRepo = new RetailerRepository(admin);
  const staffRepo = new RetailerStaffRepository(admin);
  const collectionRepo = new CollectionRepository(admin);
  const productRepo = new ProductRepository(admin);
  const variantRepo = new ProductVariantRepository(admin);
  const customerRepo = new CustomerRepository(admin);

  let retailer = await retailerRepo.findBySlug(spec.slug);
  retailer ??= await retailerRepo.create({
    legalName: spec.legalName,
    displayName: spec.displayName,
    slug: spec.slug,
    tier: "house",
    defaultCurrency: spec.currency,
    defaultLocale: "en-US",
    billingAddress: {
      line1: "1 Demo Street",
      city: "Demo City",
      postalCode: "00000",
      countryCode: "FR",
    },
  });
  if (retailer.status !== "active") {
    await admin
      .from("retailers")
      .update({ status: "active" })
      .eq("id", retailer.id);
  }
  const retailerId = retailer.id as RetailerId;

  // Workshop ("alteration partner") — created before staff since
  // workshop_manager/worker roles require a workshop_id at insert time
  // (retailer_staff_workshop_role_check).
  const workshopRepo = new WorkshopRepository(admin);
  let workshop = (await workshopRepo.findByRetailer(retailerId)).find(
    (w) => w.name === `${spec.displayName} Workshop Partner`,
  );
  workshop ??= await workshopRepo.create({
    retailerId,
    name: `${spec.displayName} Workshop Partner`,
    email: `contact+${spec.slug}-workshop-partner@nebelspiegel.com`,
  });

  // Staff
  const staffIds: Record<string, StaffId> = {};
  for (const { role, label } of STAFF_ROLES) {
    const email = `contact+${spec.slug}-${label}@nebelspiegel.com`;
    const fullName = `${spec.displayName} ${label.charAt(0).toUpperCase()}${label.slice(1)}`;
    const userId = await ensureUser(email, fullName);
    let staff = await staffRepo.findByUserId(userId);
    staff ??= await staffRepo.create({
      retailerId,
      userId,
      fullName,
      email,
      role,
      ...(role === "workshop_manager" ? { workshopId: workshop.id } : {}),
    });
    if (!staff.acceptedAt) {
      await admin
        .from("retailer_staff_members")
        .update({ accepted_at: new Date().toISOString() })
        .eq("id", staff.id);
    }
    staffIds[role] = staff.id;
    logins.push({
      role: `${spec.displayName} — ${label}`,
      email,
      password: DEMO_PASSWORD,
    });
  }

  // Collection
  let collection = (await collectionRepo.findByRetailer(retailerId)).find(
    (c) => c.slug === spec.collectionSlug,
  );
  collection ??= await collectionRepo.create({
    retailerId,
    name: spec.collectionName,
    slug: spec.collectionSlug,
  });

  // Products + variants
  const productIds = [];
  for (const p of spec.products) {
    let product = await productRepo.findBySlug(retailerId, p.slug);
    product ??= await productRepo.create({
      retailerId,
      name: p.name,
      slug: p.slug,
      description: `${p.name} — demo product for ${spec.displayName}.`,
      status: "active",
      isMadeToOrder: false,
      isAlterable: true,
    });
    if (!product.collectionIds.includes(collection.id)) {
      product = await productRepo.update(product.id, {
        name: product.name,
        slug: product.slug,
        description: product.description,
        status: product.status,
        isMadeToOrder: product.isMadeToOrder,
        isAlterable: product.isAlterable,
        collectionIds: [collection.id],
      });
    }
    const variants = await variantRepo.findByProduct(product.id);
    if (variants.length === 0) {
      await variantRepo.create({
        productId: product.id,
        sku: p.sku,
        ...(p.size ? { size: p.size } : {}),
        price: { amountMinorUnits: p.priceMinor, currency: spec.currency },
        inventoryQuantity: 25,
      });
    }
    productIds.push(product.id);
  }

  // Loyalty program — must be enabled before orders are delivered for
  // accrue_loyalty_on_delivered_order() to do anything (it no-ops
  // silently when no enabled program row exists for the retailer).
  const loyaltyRepoEarly = new LoyaltyRepository(admin);
  await loyaltyRepoEarly.saveProgram(retailerId, {
    name: `${spec.displayName} Rewards`,
    enabled: true,
    pointsPerCurrencyUnit: 1,
    referralPoints: 100,
  });

  // Customers
  const customerIds: CustomerId[] = [];
  for (const c of spec.customers) {
    const existing = (await customerRepo.findByRetailer(retailerId)).find(
      (x) => x.email === c.email,
    );
    let customer = existing;
    customer ??= await customerRepo.create({
      retailerId,
      fullName: c.name,
      email: c.email,
      lifecycleStage: c.lifecycle,
    });
    customerIds.push(customer.id);

    if (c.portal) {
      await ensureUser(c.email, c.name);
      const portalClient = await signedInClient(c.email);
      await new CustomerRepository(portalClient).linkMyAccounts();
      logins.push({
        role: `${spec.displayName} customer — ${c.name}`,
        email: c.email,
        password: DEMO_PASSWORD,
      });
    }
  }

  // Orders: portal customers buy something, staff advances status to delivered
  const orderRepo = new OrderRepository(admin);
  const portalCustomers = spec.customers.filter((c) => c.portal);
  const variantsForFirstProduct = await variantRepo.findByProduct(
    productIds[0]!,
  );
  const firstVariant = variantsForFirstProduct[0];
  if (firstVariant) {
    for (const c of portalCustomers) {
      const portalClient = await signedInClient(c.email);
      const custOrderRepo = new OrderRepository(portalClient);
      const existingOrders = await orderRepo.findByRetailer(retailerId);
      const alreadyOrdered = existingOrders.length >= portalCustomers.length;
      if (!alreadyOrdered) {
        const orderId = await custOrderRepo.placeOrder({
          retailerId,
          productVariantId: firstVariant.id,
          quantity: 1,
        });
        await orderRepo.updateStatus(orderId, "placed");
        await orderRepo.updateStatus(orderId, "in_production");
        await orderRepo.updateStatus(orderId, "ready_for_fulfillment");
        await orderRepo.updateStatus(orderId, "shipped");
        await orderRepo.updateStatus(orderId, "delivered");
      }
    }

    // Fixup: re-fire the delivery trigger for any already-delivered
    // order that predates the loyalty program above (accrual is a
    // no-op without an enabled program row, and it only runs on a
    // status *transition*, not on read).
    const deliveredWithoutAccrual = await admin
      .from("orders")
      .select("id")
      .eq("retailer_id", retailerId)
      .eq("status", "delivered");
    for (const row of deliveredWithoutAccrual.data ?? []) {
      const { data: ledgerRows } = await admin
        .from("loyalty_ledger_entries")
        .select("id")
        .eq("related_order_id", row.id)
        .eq("type", "earn_purchase");
      if (!ledgerRows || ledgerRows.length === 0) {
        await admin
          .from("orders")
          .update({ status: "shipped" })
          .eq("id", row.id);
        await admin
          .from("orders")
          .update({ status: "delivered" })
          .eq("id", row.id);
      }
    }
  }

  // Appointment + availability
  const availabilityRepo = new AvailabilityWindowRepository(admin);
  const appointmentRepo = new AppointmentRepository(admin);
  const ownerStaffId = staffIds["owner"]!;
  const existingWindows = await availabilityRepo.findByStaff(ownerStaffId);
  if (existingWindows.length === 0) {
    await availabilityRepo.create({
      staffId: ownerStaffId,
      retailerId,
      dayOfWeek: 2,
      startTime: "09:00",
      endTime: "17:00",
    });
  }
  const existingAppointments = await appointmentRepo.findByRetailer(retailerId);
  if (existingAppointments.length === 0 && customerIds[0]) {
    const start = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    await appointmentRepo.create({
      retailerId,
      customerId: customerIds[0],
      staffId: ownerStaffId,
      type: "styling_consultation",
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      notes: "Demo appointment.",
    });
  }

  // Alteration referencing the workshop created above.
  if (customerIds[0]) {
    const alterationRepo = new AlterationRepository(admin);
    const alterationTaskRepo = new AlterationTaskRepository(admin);
    const alterationUpdateRepo = new AlterationUpdateRepository(admin);
    const alterationWorkflowRepo = new AlterationWorkflowRepository(admin);

    const existingAlterations = (
      await alterationRepo.findByRetailer(retailerId)
    ).filter((w) => w.customerId === customerIds[0]);
    let alteration = existingAlterations[0] ?? null;
    if (!alteration) {
      const alterationId = await alterationRepo.createIntake({
        customerId: customerIds[0],
        sourceKind: "external",
        categoryCode: "jacket",
        garmentType: "Wool jacket",
        description: "Demo garment intake",
        labelMetadata: {},
        intakeCondition: "Good condition",
        observations: [
          {
            area: "Sleeve",
            observation: "One inch long",
            classification: "work_now",
          },
        ],
        tasks: [
          { title: "Shorten sleeve by one inch", classification: "work_now" },
        ],
      });
      alteration = await alterationRepo.findById(alterationId);
    }
    if (alteration) {
      let status = alteration.status;
      if (status === "intake") {
        await alterationUpdateRepo.transition({
          alterationId: alteration.id,
          toStatus: "quoted",
          customerVisible: true,
        });
        status = "quoted";
      }
      if (status === "quoted") {
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
      if (status === "assigned") {
        const tasks = await alterationTaskRepo.findByAlteration(alteration.id);
        for (const task of tasks.filter(
          (t) => t.classification === "work_now",
        )) {
          if (task.status === "assigned")
            await alterationTaskRepo.updateStatus(task.id, "in_progress");
        }
      }
    }
  }

  // Loyalty reward
  const loyaltyRepo = new LoyaltyRepository(admin);
  const existingRewards = await loyaltyRepo.findRewards(retailerId);
  if (existingRewards.length === 0) {
    await loyaltyRepo.createReward(retailerId, {
      name: "10% Off Next Purchase",
      type: "discount_percent",
      pointsCost: 500,
    });
  }

  // Retailer event
  const eventRepo = new EventRepository(admin);
  const existingEvents = await admin
    .from("retailer_events")
    .select("id")
    .eq("retailer_id", retailerId)
    .limit(1);
  if (!existingEvents.data || existingEvents.data.length === 0) {
    const start = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);
    await eventRepo.create(retailerId, {
      name: `${spec.displayName} Trunk Show`,
      description: "An evening preview of the new collection.",
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      venueName: `${spec.displayName} Atelier`,
      visibility: "public",
      capacity: 40,
    });
  }

  console.log(`Seeded ${spec.displayName} (${spec.slug}).`);
}

async function main() {
  await seedPlatformAdmin();
  for (const spec of RETAILERS) {
    await seedRetailer(spec);
  }

  console.log("\n=== Demo logins (all use the same password) ===");
  console.log(`Password: ${DEMO_PASSWORD}\n`);
  for (const l of logins) {
    console.log(`${l.role.padEnd(45)} ${l.email}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
