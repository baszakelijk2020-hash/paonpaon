import { CorporateRepository, createSupabaseAdminClient } from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import { TEST_RETAILER_SLUG } from "./fixtures";

/**
 * Proves the Employee Portal auth path (PHASE 18.5 / BD-105) end to end:
 * a wearer with a login_email signs in via the same magic-link mechanism
 * shoppers use, lands on their own portal page (never the shopper
 * dashboard), and sees their real entitlement balance — the same
 * `computeEntitlementBalance` the retailer-staff corporate page already
 * calls.
 *
 * Session-type isolation itself (a `corporate_wearer` session refused
 * where a `customer` session is required) is not re-proven here in the
 * browser: this app's page views are almost entirely guest-browsable by
 * design (`PUBLIC_PATHS` in `middleware.ts`, ADR-014) — only mutating
 * Server Actions actually enforce `requireCustomerSession`, and that
 * check is accountType-generic (throws for ANY non-customer session,
 * not specifically wearer-aware) and already covered by
 * `packages/auth/src/guards.test.ts`.
 */
test("a corporate wearer signs in to the Employee Portal and sees their own entitlement", async ({
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
  const loginEmail = `e2e-wearer-${unique}@paon.test`;
  const repo = new CorporateRepository(admin);

  const account = await repo.createAccount(retailerId, {
    legalName: `E2E Employee Portal Co ${unique}`,
    accountReference: `E2E-EMP-${unique}`,
  });
  const programme = await repo.createProgramme(retailerId, {
    accountId: account.id,
    name: `E2E Employee Portal Programme ${unique}`,
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
    employeeReference: `E2E-EMP-${unique}`,
    displayName: `E2E Wearer ${unique}`,
    roleKey: "associate",
    joinedOn: "2025-01-01",
  });
  await repo.setWearerLoginEmail(wearer.id, loginEmail);

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

    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: loginEmail,
    });
    if (error || !data.properties) {
      throw new Error(
        `Failed to generate magic link: ${error?.message ?? "unknown error"}`,
      );
    }

    await page.goto(
      `/employee/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`,
    );
    await expect(page).toHaveURL(/\/employee$/);
    await expect(
      page.getByRole("heading", { name: `E2E Wearer ${unique}` }),
    ).toBeVisible();
    await expect(page.getByText(programme.name)).toBeVisible();
    await expect(page.getByText("suit")).toBeVisible();
    await expect(page.getByText("2/2 left")).toBeVisible();
  } finally {
    await admin.from("corporate_accounts").delete().eq("id", account.id);
  }
});
