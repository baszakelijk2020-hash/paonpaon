import { createSupabaseAdminClient } from "@paon/database";
import { expect, test } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL, TEST_RETAILER_DISPLAY_NAME } from "./fixtures";

/**
 * C3 — customer sign-out control.
 *
 * The customer shell exposes the existing `signOut` server action
 * (apps/customer/app/(dashboard)/actions.ts) as a visible "Sign out"
 * control. Signing out clears the Supabase session and lands the customer
 * on the canonical /login route; a subsequent visit to a protected route
 * exposes no customer data.
 */
test("signed-in customer can sign out, session clears, and no customer data leaks afterward", async ({
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

  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto(
    `/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`,
  );
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/account");

  // Signed in: private retailer/account content is visible.
  await expect(
    page
      .getByRole("heading", { name: TEST_RETAILER_DISPLAY_NAME, exact: true })
      .first(),
  ).toBeVisible();

  const signOutButton = page.getByRole("button", { name: "Sign out" });
  await expect(signOutButton).toBeVisible();
  await signOutButton.click();

  // The real signOut server action clears the Supabase session and redirects
  // to the canonical login route.
  await expect(page).toHaveURL(/\/login$/);

  const cookies = await page.context().cookies();
  const hasSupabaseSessionCookie = cookies.some(
    (cookie) =>
      cookie.name.includes("-auth-token") &&
      !cookie.name.includes("code-verifier"),
  );
  expect(hasSupabaseSessionCookie).toBe(false);

  // Post-sign-out, protected customer routes expose no customer data.
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText(TEST_CUSTOMER_EMAIL)).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: TEST_RETAILER_DISPLAY_NAME }),
  ).toHaveCount(0);

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText(TEST_CUSTOMER_EMAIL)).toHaveCount(0);
  await expect(
    page.getByRole("main").getByRole("link", { name: "Sign in", exact: true }),
  ).toBeVisible();
});
