import { createSupabaseAdminClient } from "@paon/database";
import { type Page, expect, test } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL, TEST_RETAILER_SLUG } from "./fixtures";

async function signInAsShopper(page: Page): Promise<void> {
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
}

test("a signed-in shopper requests an appointment", async ({ page }) => {
  await signInAsShopper(page);

  await page.goto(`/r/${TEST_RETAILER_SLUG}/appointments`);
  await page.getByLabel("What would you like to book?").selectOption("fitting");

  const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const localValue = future.toISOString().slice(0, 16);
  await page.getByLabel("Preferred date & time").fill(localValue);
  await page.getByLabel(/Anything we should know/).fill("First fitting.");
  await page.getByRole("button", { name: "Request appointment" }).click();

  await expect(page).toHaveURL(/\/appointments\/[0-9a-f-]+$/);
  await expect(page.getByText("requested")).toBeVisible();

  await page.goto("/appointments");
  await expect(page.getByText("fitting")).toBeVisible();
});

test("a shopper sees their alteration status and pickup readiness", async ({
  page,
}) => {
  await signInAsShopper(page);

  await page.goto("/alterations");
  await expect(page.getByText("ready for pickup")).toBeVisible();

  await page.getByText("ready for pickup").first().click();
  await expect(page.getByText("Ready for pickup")).toBeVisible();
  await expect(page.getByText("Ready at the front desk.")).toBeVisible();
});
