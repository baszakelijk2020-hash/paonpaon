import { createSupabaseAdminClient } from "@paon/database";
import { seedDemoData } from "@paon/database/demo-seed";
import { expect, test } from "@playwright/test";

/**
 * Stage 21.2 one-platform seam — shared-state round trip.
 *
 * Proves the storefront <-> customer-dashboard boundary keeps ONE identity
 * and ONE cart across the document navigation: add to bag on the raw
 * storefront, cross into the React dashboard, come Back, and the session +
 * cart are intact with no wrong-identity flash (CUSTOMER_ENVIRONMENT_REBUILD_V3
 * §3.1). The seam does not add cart plumbing — storefront and dashboard already
 * share the same Supabase + cookies; this locks that in.
 */
test("cart and auth survive a storefront -> dashboard -> storefront round trip", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const anonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error("Round-trip test requires local Supabase variables.");
  }

  await seedDemoData({ supabaseUrl, anonKey, serviceRoleKey });
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  // A real active variant for the seeded atelier-demo retailer.
  const { data: retailer } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", "atelier-demo")
    .single();
  if (!retailer) throw new Error("atelier-demo retailer missing after seed");
  const { data: products } = await admin
    .from("products")
    .select("id")
    .eq("retailer_id", retailer.id)
    .eq("status", "active")
    .limit(25);
  const productIds = (products ?? []).map((row) => row.id as string);
  const { data: variants } = await admin
    .from("product_variants")
    .select("id")
    .in("product_id", productIds)
    .limit(1);
  const variantId = variants?.[0]?.id as string | undefined;
  if (!variantId) throw new Error("no product variant to add to cart");

  // Sign in as the demo customer (magic link, same pattern as the perf spec).
  const { data: link, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: "contact+isabelle@nebelspiegel.com",
  });
  if (error || !link.properties) {
    throw error ?? new Error("magic link missing");
  }
  await page.goto(
    `/auth/confirm?token_hash=${link.properties.hashed_token}&type=magiclink`,
  );
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator("[data-customer-shell]")).toBeVisible();

  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });

  // On the raw storefront, add to bag through the same endpoint the founder
  // template's "Add to Bag" button posts to.
  await page.goto("/r/atelier-demo?category=Suits");
  const addResponse = await page.request.post("/r/atelier-demo/api/cart-add", {
    data: { variantId },
  });
  expect(addResponse.ok()).toBe(true);

  const summaryBefore = await (
    await page.request.get("/r/atelier-demo/api/cart-summary")
  ).json();
  expect(summaryBefore.authenticated).toBe(true);
  expect(summaryBefore.count).toBeGreaterThanOrEqual(1);

  // Cross the boundary into the React dashboard — must stay signed in.
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator("[data-customer-shell]")).toBeVisible();

  // Back to the storefront — session + cart intact, same identity.
  await page.goBack();
  await expect(page).toHaveURL(/\/r\/atelier-demo/);

  const summaryAfter = await (
    await page.request.get("/r/atelier-demo/api/cart-summary")
  ).json();
  expect(summaryAfter.authenticated).toBe(true);
  expect(summaryAfter.count).toBe(summaryBefore.count);

  expect(consoleErrors).toEqual([]);
});
