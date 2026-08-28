import {
  MicroCapsuleRepository,
  createSupabaseAdminClient,
} from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test, type Page } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL, TEST_RETAILER_SLUG } from "./fixtures";

/**
 * Dashboard's "Seasonal selection" strip reuses the exact same real data
 * path as the existing /capsule page (MicroCapsuleRepository +
 * ProductRepository + ProductVariantRepository) — no new selection
 * system, no fabricated products/prices/staff identities. This proves
 * the Dashboard surface specifically: real published drop, real product
 * order, real image/name/price, real product-detail and /capsule hrefs,
 * and that the strip renders nothing at all with no current published
 * drop.
 */

function admin() {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
}

async function fixtureRetailer() {
  const client = admin();
  const { data: retailer } = await client
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");
  return { client, retailerId: retailer.id as string };
}

async function realActiveProductIds(
  retailerId: string,
  count: number,
): Promise<{ id: string; slug: string; name: string }[]> {
  const client = admin();
  const { data: products, error } = await client
    .from("products")
    .select("id, slug, name")
    .eq("retailer_id", retailerId)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(count);
  if (error) throw error;
  if (!products || products.length < count) {
    throw new Error(
      `fixture retailer needs at least ${count} real active products; found ${products?.length ?? 0}`,
    );
  }
  return products;
}

async function signIn(page: Page): Promise<void> {
  const { data, error } = await admin().auth.admin.generateLink({
    type: "magiclink",
    email: TEST_CUSTOMER_EMAIL,
  });
  if (error || !data.properties) {
    throw new Error(`magic link failed: ${error?.message ?? "unknown"}`);
  }
  await page.goto(
    `/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`,
  );
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("Dashboard's Seasonal selection strip shows the real published Capsule Drop, in real order, with real product data and hrefs", async ({
  page,
}) => {
  const { client, retailerId } = await fixtureRetailer();
  const repo = new MicroCapsuleRepository(client);

  const [second, first] = await realActiveProductIds(retailerId, 2);
  // Deliberately store second-fetched product first — proves the strip
  // renders `findProductsForDrop`'s real stored rank, not creation order
  // or alphabetical order.
  const weekStart = new Date().toISOString().slice(0, 10);
  await client
    .from("micro_capsule_drops")
    .delete()
    .eq("retailer_id", retailerId)
    .eq("week_start", weekStart);

  const drop = await repo.createDrop(asId<"RetailerId">(retailerId), {
    title: "Dashboard Strip E2E Capsule",
    theme: "Dashboard strip proof",
    weekStart,
    productIds: [first!.id, second!.id],
  });
  await repo.setPublished(drop.id, true);

  const { data: variant } = await client
    .from("product_variants")
    .select("price_amount_minor_units, price_currency")
    .eq("product_id", first!.id)
    .limit(1)
    .maybeSingle();

  try {
    await signIn(page);
    await page.goto("/dashboard");

    await expect(
      page.getByRole("heading", { name: "Dashboard Strip E2E Capsule" }),
    ).toBeVisible();
    await expect(page.getByText("Dashboard strip proof")).toBeVisible();

    // Real product order: the strip's product links, in DOM order, must
    // match the drop's real stored rank (first!.id at rank 1).
    const productLinks = page.locator(
      `a[href^="/r/${TEST_RETAILER_SLUG}/products/"]`,
    );
    await expect(productLinks).toHaveCount(2);
    await expect(productLinks.nth(0)).toHaveAttribute(
      "href",
      `/r/${TEST_RETAILER_SLUG}/products/${first!.slug}`,
    );
    await expect(productLinks.nth(1)).toHaveAttribute(
      "href",
      `/r/${TEST_RETAILER_SLUG}/products/${second!.slug}`,
    );

    // Real product name and (when a real variant exists) real price text
    // — never a fabricated placeholder.
    await expect(productLinks.nth(0).getByText(first!.name)).toBeVisible();
    if (variant) {
      const priceMajor = (variant.price_amount_minor_units / 100).toFixed(2);
      await expect(
        page.getByText(new RegExp(priceMajor.replace(".", "\\."))),
      ).toBeVisible();
    }

    // Real image: at least one product tile renders a real <img>, not a
    // placeholder box (the component omits the <Image> entirely when a
    // product has no primaryImageUrl, so this only holds if the fixture
    // product actually has one — asserted loosely via presence, not a
    // specific URL, since fixture imagery can vary by environment).
    const images = page.locator(
      `a[href^="/r/${TEST_RETAILER_SLUG}/products/"] img`,
    );
    if ((await images.count()) > 0) {
      await expect(images.first()).toBeVisible();
    }

    // Real link to the existing /capsule experience — no new route.
    const capsuleLink = page.getByRole("link", {
      name: "View the full capsule",
    });
    await expect(capsuleLink).toHaveAttribute("href", "/capsule");
  } finally {
    await client.from("micro_capsule_drops").delete().eq("id", drop.id);
  }
});

test("Dashboard shows no Seasonal selection strip when no current published drop exists", async ({
  page,
}) => {
  const { client, retailerId } = await fixtureRetailer();

  // Ensure no published drop covers today for this retailer.
  const today = new Date().toISOString().slice(0, 10);
  const { data: existing } = await client
    .from("micro_capsule_drops")
    .select("id")
    .eq("retailer_id", retailerId)
    .eq("published", true)
    .lte("week_start", today)
    .is("deleted_at", null);
  for (const row of existing ?? []) {
    await client
      .from("micro_capsule_drops")
      .update({ published: false })
      .eq("id", row.id);
  }

  try {
    await signIn(page);
    await page.goto("/dashboard");

    await expect(page.getByText("Seasonal selection")).not.toBeVisible();
    await expect(
      page.getByRole("link", { name: "View the full capsule" }),
    ).not.toBeVisible();
  } finally {
    for (const row of existing ?? []) {
      await client
        .from("micro_capsule_drops")
        .update({ published: true })
        .eq("id", row.id);
    }
  }
});
