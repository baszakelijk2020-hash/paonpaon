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
 * calls. Also closes 18.5's own named gap: cross-employee isolation — a
 * second wearer in the SAME programme, with their own real entitlement
 * balance, never appears anywhere on the first wearer's own portal page.
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

  // A second wearer in the SAME programme — never signed in during this
  // test, so anything of theirs appearing on the first wearer's own
  // portal page would be a real cross-employee isolation failure.
  const otherWearer = await repo.createWearer(retailerId, {
    programmeId: programme.id,
    employeeReference: `E2E-OTHER-${unique}`,
    displayName: `E2E Other Wearer ${unique}`,
    roleKey: "associate",
    joinedOn: "2025-01-01",
  });

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

    // Cross-employee isolation (PHASE 18.5's own named gap, closed): the
    // other wearer's own identity never appears on this wearer's page.
    await expect(page.getByText(otherWearer.displayName)).toHaveCount(0);

    // PHASE 18.8's own named, real, previously-reproduced gap: a
    // wearer's Server Action POST from this exact page was redirected
    // to /employee/login moments after the GET above correctly
    // resolved as this wearer. Root cause (found via CDP-level
    // Network.responseReceivedExtraInfo tracing, since Playwright's own
    // response.headers() hides Set-Cookie the same way real browser JS
    // can't see it): middleware.ts's /fonts/* proxy requests — a
    // background subresource fetch every page makes, unrelated to this
    // form — fell through to the generic "not a customer account"
    // branch and silently signed the wearer out (Max-Age=0) seconds
    // after page load, so the cookie was already gone by the time a
    // human would finish filling this form. Fixed with an early return
    // for /fonts/* in middleware.ts, mirroring the existing storefront/
    // confirm-route carve-outs. This is the real regression proof for
    // that fix — if the middleware carve-out regresses, this hangs on
    // the redirect to /employee/login instead of finding the new
    // request in the list below.
    await page.getByLabel("What's the problem?").selectOption("fit_issue");
    const detail = `Diagnostic-proof request ${unique}`;
    await page.getByLabel("Details").fill(detail);
    await page.getByRole("button", { name: "Send to my advisor" }).click();

    await expect(page).toHaveURL(/\/employee$/);
    await expect(page.getByText(detail)).toBeVisible();
    await expect(
      page
        .locator("li", { hasText: detail })
        .getByText("Open", { exact: true }),
    ).toBeVisible();
  } finally {
    await admin.from("corporate_accounts").delete().eq("id", account.id);
  }
});
