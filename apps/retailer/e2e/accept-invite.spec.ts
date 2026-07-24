import {
  RetailerRepository,
  RetailerStaffRepository,
  createSupabaseAdminClient,
} from "@paon/database";
import type { UserId } from "@paon/domain";
import { expect, test } from "@playwright/test";

/**
 * Provisions its own retailer + invited (not yet accepted) owner per
 * test rather than reusing the shared global-setup.ts fixture, since it
 * specifically needs `pending_onboarding` state that other specs
 * running in parallel must not observe mid-test. The invite itself uses
 * `admin.auth.admin.generateLink` to get the same `token_hash` a real
 * invite email would carry, then navigates straight to `/auth/confirm`
 * with it — a real `verifyOtp` call against a real token, exercising
 * that route handler end to end, without needing to read the token back
 * out of the local Inbucket mailer.
 */
async function provisionInvitedOwner() {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "accept-invite.spec.ts requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
  const unique = Date.now();
  const email = `e2e-invited-owner-${unique}@paon.test`;

  const retailer = await new RetailerRepository(admin).create({
    legalName: `E2E Onboarding ${unique}, Inc.`,
    displayName: `E2E Onboarding ${unique}`,
    slug: `e2e-onboarding-${unique}`,
    tier: "boutique",
    defaultCurrency: "USD",
    defaultLocale: "en-US",
    billingAddress: {
      line1: "1 Test Street",
      city: "Testville",
      postalCode: "00000",
      countryCode: "US",
    },
  });

  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({ type: "invite", email });
  if (linkError || !linkData.user || !linkData.properties) {
    throw new Error(
      `Failed to generate invite link: ${linkError?.message ?? "unknown error"}`,
    );
  }

  const staff = await new RetailerStaffRepository(admin).create({
    retailerId: retailer.id,
    userId: linkData.user.id as UserId,
    fullName: "Invited Owner",
    email,
    role: "owner",
  });

  return { retailer, staff, tokenHash: linkData.properties.hashed_token };
}

test("an invited owner must set a password before reaching the workspace", async ({
  page,
}) => {
  const { retailer, tokenHash } = await provisionInvitedOwner();

  await page.goto(`/auth/confirm?token_hash=${tokenHash}&type=invite`);

  await expect(page).toHaveURL(/\/accept-invite$/);
  await expect(
    page.getByRole("heading", { name: "Set your password" }),
  ).toBeVisible();

  const newPassword = "E2E-accepted-password-456!";
  await page.getByLabel("Password", { exact: true }).fill(newPassword);
  await page.getByLabel("Confirm password").fill(newPassword);
  await page.getByRole("button", { name: "Set password & continue" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText(retailer.displayName).first()).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "The atelier, at a glance." }),
  ).toBeVisible();
  await expect(page.getByText("Active", { exact: true })).toBeVisible();
});
