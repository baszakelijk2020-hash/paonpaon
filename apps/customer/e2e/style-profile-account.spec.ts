import { createSupabaseAdminClient } from "@paon/database";
import { expect, test } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL, TEST_RETAILER_SLUG } from "./fixtures";

/**
 * FT-05's "customer can view/correct appropriate Self-Portrait facts" actor
 * requirement is satisfied by the existing account-page style-profile-panel
 * (PAON's StyleProfile is the founder's Self-Portrait), but that panel had
 * zero direct e2e proof — swipe-deck.spec.ts proves evidence generation and
 * visits /account only for the unrelated global consent toggle, never the
 * panel's own per-concept "Remove inference" control. This closes that gap.
 */
test("a shopper sees and removes an inferred style preference on their account page", async ({
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

  const productSlug = "e2e-style-profile-account-item";
  let { data: product } = await admin
    .from("products")
    .select("id")
    .eq("retailer_id", retailer.id)
    .eq("slug", productSlug)
    .maybeSingle();
  if (!product) {
    const { data: created, error: createError } = await admin
      .from("products")
      .insert({
        retailer_id: retailer.id,
        name: "E2E Style Profile Account Jacket",
        slug: productSlug,
        description: "Fixture product for the account style-profile panel.",
        status: "active",
        is_made_to_order: false,
        is_alterable: false,
      })
      .select("id")
      .single();
    if (createError) throw createError;
    product = created;
  } else {
    const { error: activateError } = await admin
      .from("products")
      .update({ status: "active", deleted_at: null })
      .eq("id", product.id);
    if (activateError) throw activateError;
  }
  const { data: existingVariant } = await admin
    .from("product_variants")
    .select("id")
    .eq("product_id", product.id)
    .limit(1)
    .maybeSingle();
  if (!existingVariant) {
    const { error: variantError } = await admin
      .from("product_variants")
      .insert({
        product_id: product.id,
        sku: "E2E-ACCOUNT-SP-1",
        size: "One size",
        price_amount_minor_units: 310000,
        price_currency: "USD",
        inventory_quantity: 5,
      });
    if (variantError) throw variantError;
  }

  const conceptSlug = "e2e-account-style-profile-concept";
  let { data: concept } = await admin
    .from("metadata_concepts")
    .select("id")
    .eq("retailer_id", retailer.id)
    .eq("kind", "style")
    .eq("slug", conceptSlug)
    .maybeSingle();
  if (!concept) {
    const { data: created, error: conceptError } = await admin
      .from("metadata_concepts")
      .insert({
        retailer_id: retailer.id,
        kind: "style",
        slug: conceptSlug,
        canonical_name: "Relaxed tailoring",
        attributes: {},
        active: true,
      })
      .select("id")
      .single();
    if (conceptError) throw conceptError;
    concept = created;
  } else {
    const { error: activateConceptError } = await admin
      .from("metadata_concepts")
      .update({ active: true, deleted_at: null })
      .eq("id", concept.id);
    if (activateConceptError) throw activateConceptError;
  }
  const { data: reviewer } = await admin
    .from("retailer_staff_members")
    .select("id")
    .eq("retailer_id", retailer.id)
    .limit(1)
    .single();
  if (!reviewer) throw new Error("fixture metadata reviewer missing");
  const { error: oldAssignmentError } = await admin
    .from("entity_metadata_assignments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("retailer_id", retailer.id)
    .eq("concept_id", concept.id)
    .eq("target_id", product.id)
    .is("deleted_at", null);
  if (oldAssignmentError) throw oldAssignmentError;
  const { error: assignmentError } = await admin
    .from("entity_metadata_assignments")
    .insert({
      retailer_id: retailer.id,
      target_type: "product",
      target_id: product.id,
      concept_id: concept.id,
      source: "paon",
      confidence: 1,
      review_status: "accepted",
      evidence: { summary: "E2E account style-profile fixture" },
      reviewed_by_staff_id: reviewer.id,
      reviewed_at: new Date().toISOString(),
    });
  if (assignmentError) throw assignmentError;

  const { data: customer } = await admin
    .from("customers")
    .select("id")
    .eq("retailer_id", retailer.id)
    .eq("email", TEST_CUSTOMER_EMAIL)
    .single();
  if (!customer) throw new Error("fixture customer missing");
  await admin
    .from("customer_style_preference_evidence")
    .delete()
    .eq("customer_id", customer.id)
    .eq("concept_id", concept.id);
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
    const swipePath = `/r/${TEST_RETAILER_SLUG}/swipe?products=${encodeURIComponent(product.id)}`;
    await page.goto(swipePath);
    const card = page.getByRole("button", {
      name: /E2E Style Profile Account Jacket.*right arrow to save/i,
    });
    await expect(card).toBeVisible();
    await card.focus();
    await page.keyboard.press("ArrowRight");
    await expect(card).not.toBeVisible();

    await expect
      .poll(async () => {
        const { data: profile } = await admin
          .from("customer_style_profiles")
          .select("inferred_preferences")
          .eq("customer_id", customer.id)
          .single();
        const inferred = Array.isArray(profile?.inferred_preferences)
          ? profile.inferred_preferences
          : [];
        return inferred.some(
          (entry) =>
            typeof entry === "object" &&
            entry !== null &&
            "conceptId" in entry &&
            entry.conceptId === concept.id,
        );
      })
      .toBe(true);

    await page.goto("/account");
    await expect(page.getByText("Relaxed tailoring")).toBeVisible();
    await expect(page.getByText(/Confidence \d+%/)).toBeVisible();
    await page.getByText("Why this exists").click();
    await expect(
      page.getByRole("button", { name: "Remove inference" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Remove inference" }).click();
    await expect(
      page.getByText("Inferred preference removed.", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Relaxed tailoring")).not.toBeVisible();

    const { data: withdrawnProfile } = await admin
      .from("customer_style_profiles")
      .select("inferred_preferences")
      .eq("customer_id", customer.id)
      .single();
    const remaining = Array.isArray(withdrawnProfile?.inferred_preferences)
      ? withdrawnProfile.inferred_preferences
      : [];
    expect(
      remaining.some(
        (entry) =>
          typeof entry === "object" &&
          entry !== null &&
          "conceptId" in entry &&
          entry.conceptId === concept.id,
      ),
    ).toBe(false);
  } finally {
    // The swipe-right saved the fixture variant to the shared customer's
    // wishlist and recorded a decided-product event — both leak into other
    // specs (wishlist.spec.ts asserts exactly one saved item; the swipe
    // deck excludes already-decided products by deckVersion) unless
    // cleaned up here, matching swipe-deck.spec.ts's own state hygiene.
    const { data: wishlist } = await admin
      .from("wishlists")
      .select("id")
      .eq("customer_id", customer.id)
      .eq("is_default", true)
      .maybeSingle();
    const { data: variantRow } = await admin
      .from("product_variants")
      .select("id")
      .eq("product_id", product.id)
      .limit(1)
      .maybeSingle();
    if (wishlist && variantRow) {
      await admin
        .from("wishlist_items")
        .delete()
        .eq("wishlist_id", wishlist.id)
        .eq("product_variant_id", variantRow.id);
    }
    await admin.rpc("anonymize_behavioral_events_for_customer", {
      p_retailer_id: retailer.id,
      p_customer_id: customer.id,
    });
  }
});
