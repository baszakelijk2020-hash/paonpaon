import { createSupabaseAdminClient } from "@paon/database";
import { expect, test } from "@playwright/test";

import {
  TEST_ORDER_PRODUCT_SLUG,
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
  TEST_RETAILER_SLUG,
} from "./fixtures";

/**
 * FT-10 Inspiration Box's own named gap ("expiry/revoke UI polish") turned
 * out to already be fully wired (revokeGiftExperience action, the Revoke
 * button, and resolve_gift_invitation's status derivation) — just never
 * exercised end to end. Proves revoking an experience actually blocks the
 * real recipient-facing reveal and redemption, not only the retailer list.
 */
test("revoking a gift experience blocks the recipient's reveal and redemption", async ({
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
    .select("id, slug")
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

  const title = `E2E revoke gift ${Date.now()}`;
  const recipientEmail = "e2e-gift-revoke-recipient@example.test";

  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/gifts");
  await page.getByPlaceholder("A little something").fill(title);
  await page
    .getByPlaceholder("A short note the recipient sees when they open it")
    .fill("Thought of you for the E2E revoke suite.");
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

  try {
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
    if (!invitation?.invite_token)
      throw new Error("Invitation was not created");
    const inviteToken = invitation.invite_token;

    // Confirm the reveal resolves normally BEFORE revoking — otherwise a
    // false pass could mean the later "revoked" check was never a real
    // transition. resolve_gift_invitation is the exact RPC the customer
    // app's gift reveal page calls server-side
    // (apps/customer/app/r/[slug]/gift/[token]/page.tsx); calling it
    // directly here proves the same effective-status derivation without
    // needing the customer app's own dev server running in this suite.
    const resolveBefore = await admin.rpc("resolve_gift_invitation", {
      p_invite_token: inviteToken,
    });
    expect(resolveBefore.error).toBeNull();
    expect((resolveBefore.data as { status: string }).status).not.toBe(
      "revoked",
    );

    // Revoke from the retailer side — the real UI action, not a direct
    // table update.
    await page.goto("/gifts");
    const experienceCardAgain = page
      .locator("div.flex.flex-col.gap-4")
      .filter({ hasText: title });
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          new URL(response.url()).pathname === "/gifts",
      ),
      experienceCardAgain.getByRole("button", { name: "Revoke" }).click(),
    ]);
    await expect(experienceCardAgain.getByText("revoked")).toBeVisible();

    // The recipient's own reveal must now refuse, not just the retailer
    // list showing "revoked".
    const resolveAfter = await admin.rpc("resolve_gift_invitation", {
      p_invite_token: inviteToken,
    });
    expect(resolveAfter.error).toBeNull();
    expect((resolveAfter.data as { status: string }).status).toBe("revoked");

    // Defense in depth: the redeem RPC itself must refuse too, not only
    // the reveal reporting "revoked".
    const { data: curatedItem } = await admin
      .from("gift_curated_items")
      .select("id")
      .eq("gift_experience_id", experience.id)
      .single();
    const { error: redeemError } = await admin.rpc("redeem_gift_invitation", {
      p_invite_token: inviteToken,
      p_curated_item_id: curatedItem!.id,
      p_recipient_name: "E2E Revoke Recipient",
      p_recipient_email: recipientEmail,
    });
    expect(redeemError).not.toBeNull();
  } finally {
    await admin.from("gift_experiences").delete().eq("id", experience.id);
    await admin
      .from("customers")
      .delete()
      .eq("retailer_id", retailer.id)
      .eq("email", recipientEmail);
  }
});
