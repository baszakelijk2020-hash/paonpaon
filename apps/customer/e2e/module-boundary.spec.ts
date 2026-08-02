import {
  PlatformModuleRepository,
  createSupabaseAdminClient,
} from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import {
  TEST_CUSTOMER_EMAIL,
  TEST_PRODUCT_SLUG,
  TEST_RETAILER_SLUG,
} from "./fixtures";

/**
 * The customer-app equivalent of the retailer app's module-navigation
 * proof: a suspended module must refuse the write at the server boundary,
 * not merely hide a control, because a stale tab or a forged fetch still
 * reaches the route. One representative mutation per module family is
 * proportionate — every other customer entry point for that module uses
 * the same `assertRetailerModuleActive` gate.
 */

test("a suspended relationship_intelligence module blocks the anonymous table-service inquiry", async ({
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
  const modules = new PlatformModuleRepository(admin);

  const { data: retailerRow } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailerRow) throw new Error("fixture retailer missing");
  const retailerId = asId<"RetailerId">(retailerRow.id);

  // Everything else depends on relationship_intelligence (directly or
  // transitively), so it must be contained first — the same order the
  // retailer app's module-navigation proof uses. network_ecosystem and
  // enterprise_verticals depend on the others in this set, so they must be
  // turned off before wardrobe_styling/commerce_growth/garment_service; the
  // restore order below reverses that.
  const offOrder = [
    "network_ecosystem",
    "enterprise_verticals",
    "wardrobe_styling",
    "commerce_growth",
    "garment_service_operations",
  ] as const;
  const restoreOrder = [
    "wardrobe_styling",
    "commerce_growth",
    "garment_service_operations",
    "enterprise_verticals",
    "network_ecosystem",
  ] as const;
  const inquiryEmail = `module-boundary-${Date.now()}@example.test`;

  try {
    for (const moduleKey of offOrder) {
      await modules.configure({
        retailerId,
        moduleKey,
        state: "off",
        authorityMode: "co_managed",
        source: "override",
        reason: "Browser proof relationship dependency containment",
      });
    }
    await modules.configure({
      retailerId,
      moduleKey: "relationship_intelligence",
      state: "suspended",
      authorityMode: "co_managed",
      source: "override",
      reason: "Browser proof relationship suspension blocks inquiries",
    });

    await page.goto(`/r/${TEST_RETAILER_SLUG}`);
    const blockedResponse = await page.request.post(
      `/r/${TEST_RETAILER_SLUG}/api/table-service-inquiry`,
      {
        data: {
          retailerId,
          name: "Module Boundary Test",
          email: inquiryEmail,
          message: "Testing suspended relationship intelligence.",
          intent: "freeform",
        },
      },
    );
    expect(blockedResponse.status()).toBe(403);

    const { count: blockedCount, error: blockedCountError } = await admin
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("retailer_id", retailerId)
      .eq("email", inquiryEmail);
    expect(blockedCountError).toBeNull();
    expect(blockedCount ?? 0).toBe(0);

    // Restoring the module must not leave the write path broken.
    await modules.configure({
      retailerId,
      moduleKey: "relationship_intelligence",
      state: "active",
      authorityMode: "co_managed",
      source: "add_on",
    });
    const restoredResponse = await page.request.post(
      `/r/${TEST_RETAILER_SLUG}/api/table-service-inquiry`,
      {
        data: {
          retailerId,
          name: "Module Boundary Test",
          email: inquiryEmail,
          message: "Testing restored relationship intelligence.",
          intent: "freeform",
        },
      },
    );
    expect(restoredResponse.status()).toBe(200);
    await expect
      .poll(async () => {
        const { count, error } = await admin
          .from("customers")
          .select("id", { count: "exact", head: true })
          .eq("retailer_id", retailerId)
          .eq("email", inquiryEmail);
        expect(error).toBeNull();
        return count ?? 0;
      })
      .toBe(1);
  } finally {
    await modules.configure({
      retailerId,
      moduleKey: "relationship_intelligence",
      state: "active",
      authorityMode: "co_managed",
      source: "add_on",
    });
    for (const moduleKey of restoreOrder) {
      await modules.configure({
        retailerId,
        moduleKey,
        state: "active",
        authorityMode: "co_managed",
        source: "add_on",
      });
    }
    const { data: customerRow } = await admin
      .from("customers")
      .select("id")
      .eq("retailer_id", retailerId)
      .eq("email", inquiryEmail)
      .maybeSingle();
    if (customerRow) {
      await admin.from("customers").delete().eq("id", customerRow.id);
    }
  }
});

test("a suspended wardrobe_styling module blocks a wishlist save and preserves the wishlist afterward", async ({
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
  const modules = new PlatformModuleRepository(admin);

  const { data: retailerRow } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailerRow) throw new Error("fixture retailer missing");
  const retailerId = asId<"RetailerId">(retailerRow.id);
  const { data: productRow } = await admin
    .from("products")
    .select("id")
    .eq("retailer_id", retailerId)
    .eq("slug", TEST_PRODUCT_SLUG)
    .single();
  if (!productRow) throw new Error("fixture product missing");
  const { data: variantRow } = await admin
    .from("product_variants")
    .select("id")
    .eq("product_id", productRow.id)
    .limit(1)
    .single();
  if (!variantRow) throw new Error("fixture variant missing");

  const { data: customerRow } = await admin
    .from("customers")
    .select("id")
    .eq("retailer_id", retailerId)
    .eq("email", TEST_CUSTOMER_EMAIL)
    .maybeSingle();
  if (customerRow) {
    const { data: wishlistRow } = await admin
      .from("wishlists")
      .select("id")
      .eq("customer_id", customerRow.id)
      .eq("is_default", true)
      .maybeSingle();
    if (wishlistRow) {
      await admin
        .from("wishlist_items")
        .delete()
        .eq("wishlist_id", wishlistRow.id)
        .eq("product_variant_id", variantRow.id);
    }
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

  try {
    await modules.configure({
      retailerId,
      moduleKey: "wardrobe_styling",
      state: "suspended",
      authorityMode: "co_managed",
      source: "override",
      reason: "Browser proof wardrobe suspension blocks wishlist writes",
    });

    await page.goto(
      `/r/${TEST_RETAILER_SLUG}/products/${TEST_PRODUCT_SLUG}?legacy=1`,
    );
    const toggleButton = page.getByRole("button", {
      name: /Save to wishlist|Saved to wishlist/,
    });
    await toggleButton.click();
    await expect(page.getByText("isn't available right now")).toBeVisible();
    await expect(toggleButton).toHaveText("♡ Save to wishlist");

    const { count: blockedCount, error: blockedCountError } = await admin
      .from("wishlist_items")
      .select("wishlist_id", { count: "exact", head: true })
      .eq("product_variant_id", variantRow.id);
    expect(blockedCountError).toBeNull();
    expect(blockedCount ?? 0).toBe(0);

    await modules.configure({
      retailerId,
      moduleKey: "wardrobe_styling",
      state: "active",
      authorityMode: "co_managed",
      source: "add_on",
    });
    await toggleButton.click();
    await expect(toggleButton).toHaveText("♥ Saved to wishlist");
  } finally {
    await modules.configure({
      retailerId,
      moduleKey: "wardrobe_styling",
      state: "active",
      authorityMode: "co_managed",
      source: "add_on",
    });
    if (customerRow) {
      const { data: wishlistRow } = await admin
        .from("wishlists")
        .select("id")
        .eq("customer_id", customerRow.id)
        .eq("is_default", true)
        .maybeSingle();
      if (wishlistRow) {
        await admin
          .from("wishlist_items")
          .delete()
          .eq("wishlist_id", wishlistRow.id)
          .eq("product_variant_id", variantRow.id);
      }
    }
  }
});
