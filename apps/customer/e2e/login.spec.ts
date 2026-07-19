import { createSupabaseAdminClient } from "@paon/database";
import { expect, test } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL, TEST_RETAILER_DISPLAY_NAME } from "./fixtures";

test("redirects unauthenticated visitors to /login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("requesting a sign-in link shows a confirmation, not an error", async ({
  page,
}) => {
  await page.goto("/login");
  await page
    .getByLabel("Email")
    .fill(`e2e-new-shopper-${Date.now()}@paon.test`);
  await page.getByRole("button", { name: "Send sign-in link" }).click();
  await expect(page.getByRole("status")).toContainText("Check");
});

/**
 * Signs in via a real `verifyOtp` call against a token
 * `admin.auth.admin.generateLink` returns synchronously — the same
 * token a real magic-link email would carry — rather than reading the
 * email out of the local Inbucket mailer. This exercises the actual
 * `/auth/confirm` route and `link_my_customer_accounts` RPC end to
 * end; `apps/retailer/e2e/accept-invite.spec.ts` uses the same
 * technique for its invite flow.
 */
test("an existing customer signs in and sees their linked retailer", async ({
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

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: TEST_CUSTOMER_EMAIL,
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
  await expect(page.getByText(TEST_RETAILER_DISPLAY_NAME)).toBeVisible();
});
