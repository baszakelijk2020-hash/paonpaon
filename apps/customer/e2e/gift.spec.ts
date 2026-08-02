import { createSupabaseAdminClient } from "@paon/database";
import { expect, test } from "@playwright/test";

import { TEST_PRODUCT_SLUG, TEST_RETAILER_SLUG } from "./fixtures";

test("an anonymous recipient opens a gift link and redeems a curated piece", async ({
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
  const { data: product } = await admin
    .from("products")
    .select("id")
    .eq("retailer_id", retailer.id)
    .eq("slug", TEST_PRODUCT_SLUG)
    .single();
  if (!product) throw new Error("fixture product missing");
  const { data: variant } = await admin
    .from("product_variants")
    .select("id")
    .eq("product_id", product.id)
    .limit(1)
    .single();
  if (!variant) throw new Error("fixture variant missing");

  const experienceTitle = `Customer e2e gift ${Date.now()}`;
  const { data: experience } = await admin
    .from("gift_experiences")
    .insert({
      retailer_id: retailer.id,
      title: experienceTitle,
      intro_message: "Thought of you.",
      status: "active",
    })
    .select("id")
    .single();
  if (!experience) throw new Error("could not seed gift experience");
  const { data: curatedItem } = await admin
    .from("gift_curated_items")
    .insert({
      gift_experience_id: experience.id,
      product_variant_id: variant.id,
    })
    .select("id")
    .single();
  if (!curatedItem) throw new Error("could not seed curated item");
  const { data: invitation } = await admin
    .from("gift_invitations")
    .insert({ gift_experience_id: experience.id })
    .select("invite_token")
    .single();
  if (!invitation) throw new Error("could not seed invitation");

  const recipientEmail = `gift-e2e-${Date.now()}@example.test`;

  try {
    await page.goto(`/r/${TEST_RETAILER_SLUG}/gift/${invitation.invite_token}`);
    await expect(
      page.getByRole("heading", { name: experienceTitle }),
    ).toBeVisible();
    await expect(
      page.getByText("E2E Storefront Overcoat").first(),
    ).toBeVisible();

    const { data: openedInvitation } = await admin
      .from("gift_invitations")
      .select("status")
      .eq("gift_experience_id", experience.id)
      .single();
    expect(openedInvitation?.status).toBe("opened");

    await page.getByPlaceholder("Your name").fill("Gift E2E Recipient");
    await page.getByPlaceholder("Your email").fill(recipientEmail);
    await page.getByRole("button", { name: "Choose this piece" }).click();
    await expect(page.getByRole("status")).toContainText(
      "let the atelier know",
    );

    const { data: redeemedInvitation } = await admin
      .from("gift_invitations")
      .select("status, redeemed_curated_item_id, redeemed_recipient_email")
      .eq("gift_experience_id", experience.id)
      .single();
    expect(redeemedInvitation?.status).toBe("redeemed");
    expect(redeemedInvitation?.redeemed_curated_item_id).toBe(curatedItem.id);
    expect(redeemedInvitation?.redeemed_recipient_email).toBe(recipientEmail);

    const { count: customerCount } = await admin
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("retailer_id", retailer.id)
      .eq("email", recipientEmail);
    expect(customerCount).toBe(1);

    // Redeemed links must not offer a second redemption.
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Choose this piece" }),
    ).toHaveCount(0);
    await expect(page.getByText("You chose")).toBeVisible();
  } finally {
    // gift_curated_items and gift_invitations cascade from gift_experiences.
    await admin.from("gift_experiences").delete().eq("id", experience.id);
    await admin
      .from("customers")
      .delete()
      .eq("retailer_id", retailer.id)
      .eq("email", recipientEmail);
  }
});
