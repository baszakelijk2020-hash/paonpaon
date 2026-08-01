import { createSupabaseAdminClient } from "@paon/database";
import { expect, test } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL, TEST_RETAILER_DISPLAY_NAME } from "./fixtures";

test("a signed-in shopper edits and persists their preferences with a retailer", async ({
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

  await page.goto("/account");
  await expect(
    page.getByRole("heading", {
      name: TEST_RETAILER_DISPLAY_NAME,
      exact: true,
    }),
  ).toBeVisible();

  await page.getByLabel("Preferred language").fill("fr-FR");
  await page.getByLabel("Preferred currency").selectOption("EUR");
  await page.getByLabel("SMS").check();
  await page.getByLabel("Send me marketing updates and offers").check();
  await page.getByLabel("Style notes").fill("Prefers wool over cashmere.");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByText("Preferences saved.")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Preferred language")).toHaveValue("fr-FR");
  await expect(page.getByLabel("Preferred currency")).toHaveValue("EUR");
  await expect(page.getByLabel("SMS")).toBeChecked();
  await expect(page.getByLabel("Email")).toBeChecked();
  await expect(
    page.getByLabel("Send me marketing updates and offers"),
  ).toBeChecked();
  await expect(page.getByLabel("Style notes")).toHaveValue(
    "Prefers wool over cashmere.",
  );
});
