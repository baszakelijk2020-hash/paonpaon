import { createSupabaseAdminClient } from "@paon/database";
import { expect, test } from "@playwright/test";

import {
  TEST_ORDER_PRODUCT_SLUG,
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
  TEST_RETAILER_SLUG,
} from "./fixtures";

test("a manager curates a gift experience, sends an invitation, and sees it redeemed", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Gifts e2e requires local Supabase variables.");
  }
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  const { data: retailer } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("E2E retailer is missing");
  const { data: product } = await admin
    .from("products")
    .select("id")
    .eq("retailer_id", retailer.id)
    .eq("slug", TEST_ORDER_PRODUCT_SLUG)
    .single();
  if (!product) throw new Error("E2E order fixture product is missing");
  const { data: variant } = await admin
    .from("product_variants")
    .select("id")
    .eq("product_id", product.id)
    .limit(1)
    .single();
  if (!variant) throw new Error("E2E order fixture variant is missing");

  const title = `E2E gift ${Date.now()}`;
  const recipientEmail = "e2e-gift-recipient@example.test";

  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/gifts");
  await page.getByPlaceholder("A little something").fill(title);
  await page
    .getByPlaceholder("A short note the recipient sees when they open it")
    .fill("Thought of you for the E2E suite.");
  await page
    .locator(`input[name="productVariantIds"][value="${variant.id}"]`)
    .check();
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/gifts",
    ),
    page.getByRole("button", { name: "Create gift experience" }).click(),
  ]);
  await expect(page).toHaveURL(/\/gifts$/);
  await expect(page.getByText(title)).toBeVisible();

  const { data: experience } = await admin
    .from("gift_experiences")
    .select("id")
    .eq("retailer_id", retailer.id)
    .eq("title", title)
    .single();
  if (!experience) throw new Error("Gift experience was not created");
  const { count: itemCount } = await admin
    .from("gift_curated_items")
    .select("id", { count: "exact", head: true })
    .eq("gift_experience_id", experience.id);
  expect(itemCount).toBe(1);

  const experienceCard = page
    .locator("div.flex.flex-col.gap-4")
    .filter({ hasText: title });
  await experienceCard
    .getByPlaceholder("Recipient email (optional)")
    .fill(recipientEmail);
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/gifts",
    ),
    experienceCard.getByRole("button", { name: "Send invitation" }).click(),
  ]);

  const { data: invitation } = await admin
    .from("gift_invitations")
    .select("invite_token")
    .eq("gift_experience_id", experience.id)
    .eq("recipient_email", recipientEmail)
    .single();
  expect(invitation?.invite_token).toBeTruthy();
  await expect(page.getByText(invitation!.invite_token)).toBeVisible();

  // The customer-app redemption journey is proven independently
  // (apps/customer/e2e/gift.spec.ts); simulate it here at the RPC layer
  // so this test also proves the retailer list reflects a real redemption.
  const { error: redeemError } = await admin.rpc("redeem_gift_invitation", {
    p_invite_token: invitation!.invite_token,
    p_curated_item_id: (
      await admin
        .from("gift_curated_items")
        .select("id")
        .eq("gift_experience_id", experience.id)
        .single()
    ).data!.id,
    p_recipient_name: "E2E Gift Recipient",
    p_recipient_email: recipientEmail,
  });
  expect(redeemError).toBeNull();

  await page.reload();
  await expect(
    experienceCard.getByText(`${recipientEmail} — Redeemed`),
  ).toBeVisible();

  await admin.from("gift_experiences").delete().eq("id", experience.id);
  await admin
    .from("customers")
    .delete()
    .eq("retailer_id", retailer.id)
    .eq("email", recipientEmail);
});
