import { CustomerRepository, createSupabaseAdminClient } from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import {
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
  TEST_RETAILER_SLUG,
} from "./fixtures";

test("store feedback capture routes a consented signal to Mission Control for acknowledgement", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const admin = createSupabaseAdminClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
  );
  const { data: retailer } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");
  const customer = await new CustomerRepository(admin).create({
    retailerId: asId<"RetailerId">(retailer.id),
    fullName: `E2E Feedback Client ${Date.now()}`,
    email: `feedback-${Date.now()}@paon.test`,
    lifecycleStage: "prospect",
  });
  const garmentRef = `navy travel blazer ${Date.now()}`;
  try {
    const { data: preference, error } = await admin
      .from("customer_preferences")
      .upsert({
        customer_id: customer.id,
        personalization_opt_in: true,
        personalization_withdrawn_at: null,
      })
      .select("personalization_opt_in, personalization_withdrawn_at")
      .single();
    if (error) throw error;
    expect(preference).toMatchObject({
      personalization_opt_in: true,
      personalization_withdrawn_at: null,
    });
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
    await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
    await page.getByRole("button", { name: "Enter the atelier" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/store-sessions");
    await page.locator("#feedback-customer").selectOption(String(customer.id));
    await page.locator("#feedback-garment").fill(garmentRef);
    await page
      .locator("#feedback-text")
      .fill("Several clients asked for a lighter lining.");
    await page
      .locator("#store-feedback-form")
      .getByRole("button", { name: "Route feedback" })
      .click();
    await expect(
      page.getByText("Feedback routed for leadership review"),
    ).toBeVisible({ timeout: 15_000 });
    await page.goto("/mission-control");
    const card = page.locator("[data-store-feedback-id]", {
      hasText: garmentRef,
    });
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card
      .locator("input[name='followUpNote']")
      .fill("Buying team will review the lining assortment.");
    await card.getByRole("button", { name: "Acknowledge" }).click();
    await expect(card).toHaveCount(0, { timeout: 15_000 });
  } finally {
    await admin
      .from("store_feedback_signals")
      .delete()
      .eq("customer_id", customer.id);
    await admin.from("customers").delete().eq("id", customer.id);
  }
});
