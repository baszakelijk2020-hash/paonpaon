import { CorporateRepository, createSupabaseAdminClient } from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import { TEST_RETAILER_SLUG } from "./fixtures";
import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "18.5-employee-portal-linked-customer-data";
const BROWSER_PROOF_SPEC =
  "apps/customer/e2e/employee-portal-linked-customer.spec.ts";

let proofPassed = false;

test.afterAll(async () => {
  await writeBrowserProofRun({
    phaseItemId: PHASE_ITEM_ID,
    spec: BROWSER_PROOF_SPEC,
    status: proofPassed ? "passed" : "failed",
  });
});

/**
 * Proves PHASE 18.5's own named gap is closed: once a wearer is linked to
 * a real Customer relationship (`corporate_wearers.customer_id`, migration
 * 20260809200000), their real appointment, order, alteration and approved
 * measurement version render on the Employee Portal — through the exact
 * same `AppointmentRepository`/`OrderRepository`/`CustomerAlterationRepository`/
 * `MeasurementMonitorRepository` the customer-facing dashboard already
 * uses, gated by the new additive RLS this migration adds. A second,
 * unlinked wearer in the same programme proves the negative: they see
 * none of it.
 */
test("a wearer linked to a real customer sees their real appointments, orders, alterations and measurements", async ({
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
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");
  const retailerId = asId<"RetailerId">(retailer.id);

  const { data: staff } = await admin
    .from("retailer_staff_members")
    .select("id")
    .eq("retailer_id", retailerId)
    .limit(1)
    .single();
  if (!staff) throw new Error("fixture staff missing");

  const unique = Date.now();
  const loginEmail = `e2e-linked-wearer-${unique}@paon.test`;
  const repo = new CorporateRepository(admin);

  const account = await repo.createAccount(retailerId, {
    legalName: `E2E Linked Wearer Co ${unique}`,
    accountReference: `E2E-LW-${unique}`,
  });
  const programme = await repo.createProgramme(retailerId, {
    accountId: account.id,
    name: `E2E Linked Wearer Programme ${unique}`,
    siteKeys: [],
  });
  await repo.createEntitlementVersion(retailerId, {
    programmeId: programme.id,
    effectiveFrom: "2026-01-01",
    rules: [
      {
        roleKey: "associate",
        garmentKey: "suit",
        quantity: 2,
        period: "annual",
      },
    ],
  });
  const wearer = await repo.createWearer(retailerId, {
    programmeId: programme.id,
    employeeReference: `E2E-LW-EMP-${unique}`,
    displayName: `E2E Linked Wearer ${unique}`,
    roleKey: "associate",
    joinedOn: "2025-01-01",
  });
  await repo.setWearerLoginEmail(wearer.id, loginEmail);

  // A second, unlinked wearer in the same programme — the negative case.
  const unlinkedWearer = await repo.createWearer(retailerId, {
    programmeId: programme.id,
    employeeReference: `E2E-LW-UNLINKED-${unique}`,
    displayName: `E2E Unlinked Wearer ${unique}`,
    roleKey: "associate",
    joinedOn: "2025-01-01",
  });

  const { data: customer, error: customerError } = await admin
    .from("customers")
    .insert({
      retailer_id: retailerId,
      full_name: `E2E Linked Wearer Customer ${unique}`,
      email: `e2e-linked-wearer-customer-${unique}@paon.test`,
      lifecycle_stage: "prospect",
    })
    .select("id")
    .single();
  if (customerError || !customer) {
    throw new Error(`could not seed customer: ${customerError?.message}`);
  }
  await repo.setWearerCustomerId(wearer.id, customer.id);

  const startsAt = new Date(Date.now() + 86_400_000).toISOString();
  const endsAt = new Date(Date.now() + 90_000_000).toISOString();
  const { data: appointment, error: appointmentError } = await admin
    .from("appointments")
    .insert({
      retailer_id: retailerId,
      customer_id: customer.id,
      type: "fitting",
      status: "confirmed",
      starts_at: startsAt,
      ends_at: endsAt,
    })
    .select("id")
    .single();
  if (appointmentError || !appointment) {
    throw new Error(`could not seed appointment: ${appointmentError?.message}`);
  }

  const { error: orderError } = await admin.from("orders").insert({
    retailer_id: retailerId,
    customer_id: customer.id,
    order_number: `E2E-LW-ORDER-${unique}`,
    status: "placed",
    channel: "online",
    currency: "USD",
    subtotal_amount_minor_units: 10000,
    total_amount_minor_units: 10000,
  });
  if (orderError)
    throw new Error(`could not seed order: ${orderError.message}`);

  const { data: garment, error: garmentError } = await admin
    .from("physical_garments")
    .insert({
      retailer_id: retailerId,
      customer_id: customer.id,
      source_kind: "external",
      category_code: "jacket",
      garment_type: "E2E Suit Jacket",
      description: "Navy suit jacket",
      intake_condition: "good",
    })
    .select("id")
    .single();
  if (garmentError || !garment) {
    throw new Error(
      `could not seed physical garment: ${garmentError?.message}`,
    );
  }
  const { error: alterationError } = await admin
    .from("alteration_work_orders")
    .insert({
      retailer_id: retailerId,
      customer_id: customer.id,
      physical_garment_id: garment.id,
      status: "approved",
      original_quote_currency: "USD",
    });
  if (alterationError) {
    throw new Error(`could not seed alteration: ${alterationError.message}`);
  }

  const { error: measurementError } = await admin
    .from("customer_measurement_versions")
    .insert({
      retailer_id: retailerId,
      customer_id: customer.id,
      version: 1,
      values: [
        { key: "chest", millimetres: 1020, capturedBy: "advisor_manual" },
      ],
      approved_by_staff_id: staff.id,
    });
  if (measurementError) {
    throw new Error(`could not seed measurement: ${measurementError.message}`);
  }

  const { error: wardrobeError } = await admin.from("wardrobe_items").insert({
    retailer_id: retailerId,
    customer_id: customer.id,
    ownership_kind: "external",
    provenance_source: "customer_added",
    category_code: "jacket",
    display_name: "E2E Navy Blazer",
    condition: "good",
    created_by_actor: "customer",
  });
  if (wardrobeError) {
    throw new Error(`could not seed wardrobe item: ${wardrobeError.message}`);
  }

  try {
    const { error: createUserError } = await admin.auth.admin.createUser({
      email: loginEmail,
      email_confirm: true,
    });
    if (createUserError) {
      throw new Error(
        `Failed to create wearer auth user: ${createUserError.message}`,
      );
    }
    const { data: linkData, error: linkError } =
      await admin.auth.admin.generateLink({
        type: "magiclink",
        email: loginEmail,
      });
    if (linkError || !linkData.properties) {
      throw new Error(
        `Failed to generate magic link: ${linkError?.message ?? "unknown"}`,
      );
    }

    await page.goto(
      `/employee/auth/confirm?token_hash=${linkData.properties.hashed_token}&type=magiclink`,
    );
    await expect(page).toHaveURL(/\/employee$/);

    await expect(page.getByText("Your appointments")).toBeVisible();
    await expect(page.getByText("fitting")).toBeVisible();
    await expect(page.getByText("Your orders")).toBeVisible();
    await expect(page.getByText(`E2E-LW-ORDER-${unique}`)).toBeVisible();
    await expect(page.getByText("Your alterations")).toBeVisible();
    await expect(page.getByText("E2E Suit Jacket")).toBeVisible();
    await expect(page.getByText("Your measurements")).toBeVisible();
    await expect(page.getByText("chest")).toBeVisible();
    await expect(page.getByText("1020 mm")).toBeVisible();
    await expect(page.getByText("Your wardrobe")).toBeVisible();
    await expect(page.getByText("E2E Navy Blazer")).toBeVisible();

    // Negative: the unlinked colleague's own portal shows none of it. The
    // Employee Portal has no sign-out control of its own, so a fresh
    // identity means a fresh cookie jar, not a UI sign-out click.
    await page.context().clearCookies();

    const otherLoginEmail = `e2e-unlinked-wearer-${unique}@paon.test`;
    await repo.setWearerLoginEmail(unlinkedWearer.id, otherLoginEmail);
    const { error: createOtherUserError } = await admin.auth.admin.createUser({
      email: otherLoginEmail,
      email_confirm: true,
    });
    if (createOtherUserError) {
      throw new Error(
        `Failed to create other wearer auth user: ${createOtherUserError.message}`,
      );
    }
    const { data: otherLinkData, error: otherLinkError } =
      await admin.auth.admin.generateLink({
        type: "magiclink",
        email: otherLoginEmail,
      });
    if (otherLinkError || !otherLinkData.properties) {
      throw new Error(
        `Failed to generate other magic link: ${otherLinkError?.message ?? "unknown"}`,
      );
    }
    await page.goto(
      `/employee/auth/confirm?token_hash=${otherLinkData.properties.hashed_token}&type=magiclink`,
    );
    await expect(page).toHaveURL(/\/employee$/);
    await expect(page.getByText("Your appointments")).toHaveCount(0);
    await expect(page.getByText("Your orders")).toHaveCount(0);
    await expect(page.getByText("Your alterations")).toHaveCount(0);
    await expect(page.getByText("Your measurements")).toHaveCount(0);
    await expect(page.getByText("Your wardrobe")).toHaveCount(0);

    proofPassed = true;
  } finally {
    await admin.from("corporate_accounts").delete().eq("id", account.id);
    await admin.from("customers").delete().eq("id", customer.id);
  }
});
