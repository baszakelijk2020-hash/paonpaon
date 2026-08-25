import { WardrobeRepository, createSupabaseAdminClient } from "@paon/database";
import { expect, test } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL, TEST_RETAILER_SLUG } from "./fixtures";

const WARDROBE_RAILS_IN_ORDER = [
  "Suits",
  "Jackets",
  "Trousers",
  "Shirts",
  "Outerwear",
  "Knitwear",
  "Shoes",
  "Accessories",
];

/**
 * Customer Environment Rebuild V3 §5.2: exactly eight rails, in this exact
 * order, every one rendered even when empty, and each carries exactly ten
 * empty slots beyond any owned/advisor-selection cards.
 */
test("all eight wardrobe rails render in order, each with real owned cards and exactly ten empty slots", async ({
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

  await admin
    .from("wardrobe_items")
    .delete()
    .eq("customer_id", customerRow.id)
    .eq("retailer_id", retailer.id)
    .eq("display_name", "E2E Rail Jacket");

  const wardrobeRepo = new WardrobeRepository(admin);
  const item = await wardrobeRepo.createExternalItem({
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

    for (const label of WARDROBE_RAILS_IN_ORDER) {
      await expect(
        page.getByRole("heading", { name: label, exact: true }),
      ).toBeVisible();
    }

    const headings = await page
      .getByRole("heading", { level: 3 })
      .allTextContents();
    expect(headings).toEqual(WARDROBE_RAILS_IN_ORDER);

    const jacketsRail = page.locator("section", {
      has: page.getByRole("heading", { name: "Jackets", exact: true }),
    });
    await expect(
      jacketsRail.getByText("E2E Rail Jacket").first(),
    ).toBeVisible();
    await expect(
      jacketsRail.getByText("1 piece", { exact: true }),
    ).toBeVisible();
    await expect(jacketsRail.locator("[data-empty-slot]")).toHaveCount(10);

    const suitsRail = page.locator("section", {
      has: page.getByRole("heading", { name: "Suits", exact: true }),
    });
    await expect(suitsRail.locator("[data-empty-slot]")).toHaveCount(10);

    // No external-garment add form/copy exists anywhere on the page.
    await expect(page.getByText(/bought elsewhere/i)).toHaveCount(0);
    await expect(page.getByText(/purchased here/i)).toHaveCount(0);
    await expect(page.getByText(/^house$/i)).toHaveCount(0);

    // Opening Actions + and retiring replaces the card face in place —
    // the rail and card never grow, and the item is gone once confirmed.
    const jacketCard = jacketsRail
      .locator("article", { hasText: "E2E Rail Jacket" })
      .first();
    const railBoxBefore = await jacketsRail.boundingBox();
    await jacketCard.getByRole("button", { name: "Actions +" }).click();
    await jacketCard
      .getByRole("button", { name: "Retire", exact: true })
      .click();
    await jacketCard.getByRole("button", { name: "Confirm retire" }).click();
    // The retired card leaves the rail once the server state refreshes —
    // verified against the real persisted row, not a transient toast that
    // can race the card's own removal from the tree.
    await expect(jacketsRail.getByText("E2E Rail Jacket")).toHaveCount(0);
    const railBoxAfter = await jacketsRail.boundingBox();
    expect(railBoxAfter?.height).toBe(railBoxBefore?.height);
    const { data: retiredRow } = await admin
      .from("wardrobe_items")
      .select("retired_at")
      .eq("id", item.id)
      .single();
    expect(retiredRow?.retired_at).not.toBeNull();
  } finally {
    await admin.from("wardrobe_items").delete().eq("id", item.id);
  }
});

/**
 * An approved roadmap's open gap shows up as an "Advisor selection" card in
 * its category rail (contract §5.5) — not on a separate roadmap page.
 */
test("an approved roadmap's open gap appears as an advisor-selection card in its category rail", async ({
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
    const knitwearRail = page.locator("section", {
      has: page.getByRole("heading", { name: "Knitwear", exact: true }),
    });
    await expect(knitwearRail.getByText("Advisor selection")).toBeVisible();
    await expect(
      knitwearRail.getByText("E2E Aspirational Knit").first(),
    ).toBeVisible();
  } finally {
    await admin.from("wardrobe_roadmaps").delete().eq("id", roadmap.id);
  }
});

/**
 * PHASE 17.13's own named gap: "Book an alteration"/"Book a cleaning" from
 * a specific wardrobe item, now reached through the card's Actions + deck
 * (contract §5.4). Proves the real write path — a real message lands in
 * the customer's own conversation with this retailer, naming the exact
 * item — not just a success-looking UI state, and that the success
 * banner's own link resolves to that same real conversation.
 */
test("booking an alteration for a wardrobe item sends a real message naming the item", async ({
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

  await admin
    .from("wardrobe_items")
    .delete()
    .eq("customer_id", customerRow.id)
    .eq("retailer_id", retailer.id)
    .eq("display_name", "E2E Alteration Request Blazer");

  const wardrobeRepo = new WardrobeRepository(admin);
  const item = await wardrobeRepo.createExternalItem({
    retailerId: retailer.id,
    customerId: customerRow.id,
    categoryCode: "jacket",
    displayName: "E2E Alteration Request Blazer",
    brand: "E2E House",
    condition: "good",
    careState: "current",
    fitPerception: "true_to_size",
  });
  let sentMessageId: string | undefined;

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
    const jacketsRail = page.locator("section", {
      has: page.getByRole("heading", { name: "Jackets", exact: true }),
    });
    const card = jacketsRail.locator("article", {
      hasText: "E2E Alteration Request Blazer",
    });
    await expect(card).toBeVisible();

    await card.getByRole("button", { name: "Actions +" }).click();
    await card.getByRole("button", { name: "Book an alteration" }).click();
    await expect(page.getByText("Request sent to your advisor.")).toBeVisible();
    const messagesLink = page.getByRole("link", { name: "View in Messages" });
    await expect(messagesLink).toBeVisible();
    const href = await messagesLink.getAttribute("href");
    expect(href).toMatch(/^\/messages\/[0-9a-f-]{36}$/);

    const conversationId = href!.split("/").pop()!;
    const { data: conversation } = await admin
      .from("conversations")
      .select("id, customer_id, retailer_id")
      .eq("id", conversationId)
      .single();
    expect(conversation?.customer_id).toBe(customerRow.id);
    expect(conversation?.retailer_id).toBe(retailer.id);

    const { data: messages } = await admin
      .from("messages")
      .select("id, body, sender_type")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(1);
    sentMessageId = messages?.[0]?.id;
    expect(messages?.[0]?.sender_type).toBe("customer");
    expect(messages?.[0]?.body).toBe(
      "I'd like to book an alteration for this item from my wardrobe: " +
        "E2E House E2E Alteration Request Blazer.",
    );

    await messagesLink.click();
    await expect(page).toHaveURL(new RegExp(`/messages/${conversationId}$`));
    await expect(
      page.getByText("E2E Alteration Request Blazer", { exact: false }).last(),
    ).toBeVisible();
  } finally {
    await admin.from("wardrobe_items").delete().eq("id", item.id);
    if (sentMessageId) {
      await admin.from("messages").delete().eq("id", sentMessageId);
    }
  }
});
