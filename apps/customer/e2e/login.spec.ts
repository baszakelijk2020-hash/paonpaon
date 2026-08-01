import { createSupabaseAdminClient } from "@paon/database";
import { DEMO_PASSWORD, seedDemoData } from "@paon/database/demo-seed";
import { expect, test } from "@playwright/test";

import {
  AUTH_DELIVERABLE_DOMAIN,
  TEST_CUSTOMER_EMAIL,
  TEST_RETAILER_DISPLAY_NAME,
} from "./fixtures";

// Its own empty context. /dashboard deliberately offers a private-client
// preview before sign-in; the contract is that no private account data leaks
// and the guest gets an explicit sign-in path.
test.describe("unauthenticated", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("shows the guest client preview without private account data", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(
      page.getByRole("heading", {
        name: "Your wardrobe, beautifully in motion.",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("main").getByRole("link", {
        name: "Sign in",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByText(TEST_CUSTOMER_EMAIL)).toHaveCount(0);
  });
});

test("requesting a sign-in link shows a confirmation, not an error", async ({
  page,
}) => {
  await page.goto("/login");
  await page
    .getByLabel("Email")
    .fill(`e2e-new-shopper-${Date.now()}@${AUTH_DELIVERABLE_DOMAIN}`);
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
  await expect(
    page.getByText(TEST_RETAILER_DISPLAY_NAME, { exact: true }),
  ).toBeVisible();
});

test("a seeded private-client persona has deterministic demo access", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const anonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error("Demo login test requires the local Supabase variables.");
  }
  await seedDemoData({ supabaseUrl, anonKey, serviceRoleKey });

  await page.goto("/login?demo=1");
  await page.getByLabel("Demo email").fill("contact+isabelle@nebelspiegel.com");
  await page.getByLabel("Demo password").fill(DEMO_PASSWORD);
  await page
    .getByRole("button", { name: "Enter the private client demo" })
    .click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Maison Dubois", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Your wardrobe, beautifully in motion.",
    }),
  ).toBeVisible();
});
