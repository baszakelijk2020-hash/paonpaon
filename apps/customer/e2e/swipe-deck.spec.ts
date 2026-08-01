import { createSupabaseAdminClient } from "@paon/database";
import { expect, test } from "@playwright/test";

import {
  TEST_CUSTOMER_EMAIL,
  TEST_PRODUCT_SLUG,
  TEST_RETAILER_SLUG,
} from "./fixtures";

test("the founder swipe deck persists choices, deduplicates signals, and resumes", async ({
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

  const { data: customer } = await admin
    .from("customers")
    .select("id")
    .eq("retailer_id", retailer.id)
    .eq("email", TEST_CUSTOMER_EMAIL)
    .single();
  if (!customer) throw new Error("fixture customer missing");
  const { error: consentError } = await admin
    .from("customer_preferences")
    .upsert(
      {
        customer_id: customer.id,
        personalization_opt_in: true,
        personalization_withdrawn_at: null,
      },
      { onConflict: "customer_id" },
    );
  if (consentError) throw consentError;
  const { error: signalCleanupError } = await admin.rpc(
    "anonymize_behavioral_events_for_customer",
    {
      p_retailer_id: retailer.id,
      p_customer_id: customer.id,
    },
  );
  if (signalCleanupError) throw signalCleanupError;

  const { data: wishlist } = await admin
    .from("wishlists")
    .select("id")
    .eq("customer_id", customer.id)
    .eq("is_default", true)
    .maybeSingle();
  if (wishlist) {
    await admin
      .from("wishlist_items")
      .delete()
      .eq("wishlist_id", wishlist.id)
      .eq("product_variant_id", variant.id);
  }

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

  const captureStartedAt = new Date().toISOString();
  const swipePath = `/r/${TEST_RETAILER_SLUG}/swipe?products=${encodeURIComponent(product.id)}`;
  await page.goto(swipePath);
  const card = page.getByRole("button", {
    name: /E2E Storefront Overcoat.*right arrow to save/i,
  });
  await expect(card).toBeVisible();
  await card.focus();
  await page.keyboard.press("ArrowRight");
  await expect(card).not.toBeVisible();

  const decisionCard = page.getByRole("button", {
    name: /Press the right arrow to save or the left arrow to skip/i,
  });
  let decisionCount = 1;
  for (let guard = 0; guard < 20 && (await decisionCard.count()) > 0; guard++) {
    const previousLabel = await decisionCard.getAttribute("aria-label");
    await decisionCard.press("ArrowLeft");
    decisionCount += 1;
    await expect
      .poll(async () => {
        if ((await decisionCard.count()) === 0) return true;
        return (
          (await decisionCard.getAttribute("aria-label")) !== previousLabel
        );
      })
      .toBe(true);
  }
  await expect(page.getByText("You’ve seen everything for now.")).toBeVisible();

  await expect
    .poll(async () => {
      const { data: persistedWishlist } = await admin
        .from("wishlists")
        .select("id")
        .eq("customer_id", customer.id)
        .eq("is_default", true)
        .single();
      if (!persistedWishlist) return 0;
      const { count } = await admin
        .from("wishlist_items")
        .select("*", { count: "exact", head: true })
        .eq("wishlist_id", persistedWishlist.id)
        .eq("product_variant_id", variant.id);
      return count;
    })
    .toBe(1);

  const capturedCount = async () => {
    const { count } = await admin
      .from("behavioral_events")
      .select("*", { count: "exact", head: true })
      .eq("customer_id", customer.id)
      .gte("occurred_at", captureStartedAt)
      .contains("properties", { via: "swipe" });
    return count;
  };
  await expect.poll(capturedCount).toBe(decisionCount);

  await page.reload();
  await expect(page.getByText("You’ve seen everything for now.")).toBeVisible();
  await expect(decisionCard).toHaveCount(0);
  await expect.poll(capturedCount).toBe(decisionCount);

  await page.goto("/account");
  await page
    .getByLabel(/Allow personalised recommendations and advisor preparation/i)
    .uncheck();
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByText("Preferences saved.")).toBeVisible();
  await expect.poll(capturedCount).toBe(0);
  await expect
    .poll(async () => {
      const { count } = await admin
        .from("behavioral_events")
        .select("*", { count: "exact", head: true })
        .gte("occurred_at", captureStartedAt)
        .like("idempotency_key", "swipe:%")
        .not("anonymized_at", "is", null);
      return count;
    })
    .toBe(decisionCount);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(swipePath);
  await expect(decisionCard).toBeVisible();
  await expect(
    page.getByRole("button", { name: /E2E Storefront Overcoat/i }),
  ).toHaveCount(0);

  const box = await decisionCard.boundingBox();
  if (!box) throw new Error("resumed mobile swipe card has no bounds");
  const touch = await page.context().newCDPSession(page);
  const startX = box.x + box.width * 0.75;
  const y = box.y + box.height * 0.5;
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: startX, y }],
  });
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: startX - 150, y }],
  });
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(page.getByText("You’ve seen everything for now.")).toBeVisible();

  await page.goto("/wishlist");
  await expect(page.getByText("E2E Storefront Overcoat")).toBeVisible();
});
