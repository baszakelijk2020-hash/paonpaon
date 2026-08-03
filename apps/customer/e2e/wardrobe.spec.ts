import { WardrobeRepository, createSupabaseAdminClient } from "@paon/database";
import { expect, test } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL, TEST_RETAILER_SLUG } from "./fixtures";

/**
 * All 6 category carousels (suits/jackets/shirts/knitwear/shoes/
 * accessories) are always visible now — no click-to-expand rail. Browsing
 * the wardrobe means scrolling within a strip, not opening one section at
 * a time.
 */
test("all wardrobe carousels are visible at once, and a customer can still add and retire a garment", async ({
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
    .select("id, display_name")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");
  const { data: customerRow } = await admin
    .from("customers")
    .select("id")
    .eq("retailer_id", retailer.id)
    .eq("email", TEST_CUSTOMER_EMAIL)
    .maybeSingle();
  if (!customerRow) throw new Error("fixture customer missing");

  // Isolate this run's carousel assertions from any item another spec left
  // behind under the same customer/retailer.
  await admin
    .from("wardrobe_items")
    .delete()
    .eq("customer_id", customerRow.id)
    .eq("retailer_id", retailer.id)
    .eq("display_name", "E2E Rail Jacket");

  const wardrobeRepo = new WardrobeRepository(admin);
  await wardrobeRepo.createExternalItem({
    retailerId: retailer.id,
    customerId: customerRow.id,
    categoryCode: "jacket",
    displayName: "E2E Rail Jacket",
    condition: "good",
    careState: "current",
    fitPerception: "true_to_size",
  });

  try {
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

    await page.goto("/wardrobe");

    // Every category carousel renders simultaneously — no click needed to
    // reveal any of them.
    for (const label of [
      "Suits",
      "Jackets",
      "Shirts",
      "Knitwear",
      "Shoes",
      "Accessories",
    ]) {
      await expect(
        page.getByRole("heading", { name: label, exact: true }),
      ).toBeVisible();
    }
    const jacketsCarousel = page
      .locator("section", {
        has: page.getByRole("heading", { name: "Jackets" }),
      })
      .first();
    await expect(jacketsCarousel.getByText("E2E Rail Jacket")).toBeVisible();

    // The existing add/retire actions still work — scoped to this house's
    // own form, since a customer can have a wardrobe panel per retailer
    // relationship on the same page.
    const addForm = page.getByLabel(
      `Add external garment for ${retailer.display_name}`,
    );
    await addForm.getByLabel("Name").fill(`E2E Rail Added Shirt ${Date.now()}`);
    await addForm.getByLabel("Category").selectOption("shirt");
    await addForm.getByRole("button", { name: "Add to wardrobe" }).click();
    await expect(
      page.getByText("External garment added to your wardrobe."),
    ).toBeVisible();

    await jacketsCarousel
      .locator("article", { hasText: "E2E Rail Jacket" })
      .getByRole("button", { name: "Retire" })
      .click();
    await expect(page.getByText("Garment marked retired.")).toBeVisible();
    await expect(jacketsCarousel.getByText("E2E Rail Jacket")).toHaveCount(0);
  } finally {
    await admin
      .from("wardrobe_items")
      .delete()
      .eq("customer_id", customerRow.id)
      .eq("retailer_id", retailer.id)
      .or(
        "display_name.eq.E2E Rail Jacket,display_name.like.E2E Rail Added Shirt%",
      );
  }
});

/**
 * The "ideal wardrobe roadmap" — an approved plan's open gaps — now shows
 * up inside the same carousel as what the customer owns, not on a
 * separate roadmap-only page. A gap already filled by a real purchase is
 * excluded, since an owned card already represents it.
 */
test("an approved roadmap's open gap appears as an aspirational card in its category carousel", async ({
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
  const { data: customerRow } = await admin
    .from("customers")
    .select("id")
    .eq("retailer_id", retailer.id)
    .eq("email", TEST_CUSTOMER_EMAIL)
    .maybeSingle();
  if (!customerRow) throw new Error("fixture customer missing");
  const { data: staffRow } = await admin
    .from("retailer_staff_members")
    .select("id")
    .eq("retailer_id", retailer.id)
    .not("accepted_at", "is", null)
    .limit(1)
    .single();
  if (!staffRow) throw new Error("fixture staff member missing");

  const { data: roadmap, error: roadmapError } = await admin
    .from("wardrobe_roadmaps")
    .insert({
      retailer_id: retailer.id,
      customer_id: customerRow.id,
      title: "E2E Roadmap",
      status: "approved",
      authored_by_staff_id: staffRow.id,
      decided_at: new Date().toISOString(),
      decided_by_actor: "customer",
    })
    .select("id")
    .single();
  if (roadmapError || !roadmap) throw roadmapError ?? new Error("no roadmap");

  const { error: gapError } = await admin.from("wardrobe_roadmap_gaps").insert({
    roadmap_id: roadmap.id,
    retailer_id: retailer.id,
    title: "E2E Aspirational Knit",
    description: "A cable-knit for cold-weather layering.",
    rank: 1,
    category_code: "knitwear",
  });
  if (gapError) throw gapError;

  try {
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

    await page.goto("/wardrobe");
    const knitwearCarousel = page
      .locator("section", {
        has: page.getByRole("heading", { name: "Knitwear" }),
      })
      .first();
    await expect(knitwearCarousel.getByText("On your roadmap")).toBeVisible();
    await expect(
      knitwearCarousel.getByText("E2E Aspirational Knit"),
    ).toBeVisible();
  } finally {
    await admin.from("wardrobe_roadmaps").delete().eq("id", roadmap.id);
  }
});
