import { CorporateRepository, createSupabaseAdminClient } from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import { TEST_RETAILER_SLUG } from "./fixtures";
import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "18.5-employee-portal-request-appointment";
const BROWSER_PROOF_SPEC =
  "apps/customer/e2e/employee-portal-request-appointment.spec.ts";

let proofPassed = false;

test.afterAll(async () => {
  await writeBrowserProofRun({
    phaseItemId: PHASE_ITEM_ID,
    spec: BROWSER_PROOF_SPEC,
    status: proofPassed ? "passed" : "failed",
  });
});

/**
 * Proves PHASE 18.5's write-capable self-service closure: a wearer linked
 * to a real customer requests a real appointment from `/employee` through
 * `request_appointment_as_wearer`, persisted under their EXISTING linked
 * `customer_id` — asserted against the database, not just the UI. An
 * unlinked wearer never even sees the booking form (the RPC's own refusal
 * is separately proven in pgTAP `wearer_appointment_request_test.sql`).
 */
test("a linked wearer requests a real appointment from the Employee Portal", async ({
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

  const unique = Date.now();
  const loginEmail = `e2e-appt-wearer-${unique}@paon.test`;
  const repo = new CorporateRepository(admin);

  const account = await repo.createAccount(retailerId, {
    legalName: `E2E Wearer Appointment Co ${unique}`,
    accountReference: `E2E-WAPPT-${unique}`,
  });
  const programme = await repo.createProgramme(retailerId, {
    accountId: account.id,
    name: `E2E Wearer Appointment Programme ${unique}`,
    siteKeys: [],
  });
  const wearer = await repo.createWearer(retailerId, {
    programmeId: programme.id,
    employeeReference: `E2E-WAPPT-EMP-${unique}`,
    displayName: `E2E Wearer Appointment ${unique}`,
    roleKey: "associate",
    joinedOn: "2025-01-01",
  });
  await repo.setWearerLoginEmail(wearer.id, loginEmail);

  const { data: customer, error: customerError } = await admin
    .from("customers")
    .insert({
      retailer_id: retailerId,
      full_name: `E2E Wearer Appointment Customer ${unique}`,
      email: `e2e-wearer-appt-customer-${unique}@paon.test`,
      lifecycle_stage: "prospect",
    })
    .select("id")
    .single();
  if (customerError || !customer) {
    throw new Error(`could not seed customer: ${customerError?.message}`);
  }
  await repo.setWearerCustomerId(wearer.id, customer.id);

  try {
    const { data: createdUser, error: createUserError } =
      await admin.auth.admin.createUser({
        email: loginEmail,
        email_confirm: true,
      });
    if (createUserError || !createdUser.user) {
      throw new Error(
        `Failed to create wearer auth user: ${createUserError?.message}`,
      );
    }
    const wearerAuthUserId = createdUser.user.id;
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

    await page
      .getByLabel("What would you like to book?")
      .selectOption("fitting");

    const picker = page.locator('[data-datetime-field="startsAt"]');
    await picker
      .getByRole("radiogroup", { name: "Preferred date & time — day" })
      .getByRole("radio")
      .first()
      .click();
    await picker
      .getByRole("radiogroup", { name: "Preferred date & time — time" })
      .getByRole("radio", { name: "10:00", exact: true })
      .click();
    await expect(picker).not.toHaveAttribute("data-datetime-value", "");

    await page
      .getByLabel(/Anything we should know/)
      .fill(`E2E wearer fitting request ${unique}`);
    await page.getByRole("button", { name: "Request appointment" }).click();

    await expect(page.getByText("Appointment requested.")).toBeVisible({
      timeout: 30_000,
    });

    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from("appointments")
            .select("id, customer_id, type, status")
            .eq("customer_id", customer.id)
            .eq("type", "fitting")
            .maybeSingle();
          return data ?? null;
        },
        { timeout: 30_000 },
      )
      .toMatchObject({ customer_id: customer.id, status: "requested" });

    // No shadow customer keyed to the wearer's own auth.uid() was ever
    // created — the whole reason request_appointment_as_wearer exists,
    // instead of reusing request_appointment as-is.
    const { data: shadowCustomers } = await admin
      .from("customers")
      .select("id")
      .eq("retailer_id", retailerId)
      .eq("user_id", wearerAuthUserId);
    expect(shadowCustomers).toHaveLength(0);

    proofPassed = true;
  } finally {
    await admin.from("corporate_accounts").delete().eq("id", account.id);
    await admin.from("customers").delete().eq("id", customer.id);
  }
});
