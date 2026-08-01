import {
  CollectionRepository,
  ProductRepository,
  ProductVariantRepository,
  createSupabaseAdminClient,
} from "@paon/database";
import { expect, test } from "@playwright/test";

import { TEST_PRODUCT_SLUG, TEST_RETAILER_SLUG } from "./fixtures";

const COLLECTION_SLUG = "e2e-capsule-collection";
const OTHER_PRODUCT_SLUG = "e2e-outside-collection-product";

test("storefront template includes products from every collection", async ({
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
  const collectionRepo = new CollectionRepository(admin);
  const productRepo = new ProductRepository(admin);
  const variantRepo = new ProductVariantRepository(admin);

  const { data: retailerRow } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailerRow) throw new Error("fixture retailer missing");
  const retailerId = retailerRow.id as never;

  let collection = (await collectionRepo.findByRetailer(retailerId)).find(
    (item) => item.slug === COLLECTION_SLUG,
  );
  if (!collection) {
    collection = await collectionRepo.create({
      retailerId,
      name: "E2E Capsule",
      slug: COLLECTION_SLUG,
    });
  }

  const mainProduct = await productRepo.findBySlug(
    retailerId,
    TEST_PRODUCT_SLUG,
  );
  if (!mainProduct) throw new Error("fixture product missing");
  await admin
    .from("product_collections")
    .upsert(
      { product_id: mainProduct.id, collection_id: collection.id },
      { onConflict: "product_id,collection_id" },
    );

  let otherProduct = await productRepo.findBySlug(
    retailerId,
    OTHER_PRODUCT_SLUG,
  );
  if (!otherProduct) {
    otherProduct = await productRepo.create({
      retailerId,
      name: "E2E Outside-Collection Blazer",
      slug: OTHER_PRODUCT_SLUG,
      description: "Deliberately not in the capsule collection.",
      status: "active",
      isMadeToOrder: false,
      isAlterable: false,
    });
  }
  const otherVariants = await variantRepo.findByProduct(otherProduct.id);
  if (otherVariants.length === 0) {
    await variantRepo.create({
      productId: otherProduct.id,
      sku: "E2E-BLAZER-OUTSIDE",
      price: { amountMinorUnits: 320000, currency: "USD" },
      inventoryQuantity: 5,
    });
  }

  // Catalogue browsing lives in the verbatim paon.html template at
  // /r/[slug], not a separate Tailwind shop list. Its category rail only
  // renders one category at a time, so prove the server supplied both
  // collection-linked and unlinked products in the real template payload.
  const response = await page.goto(`/r/${TEST_RETAILER_SLUG}`);
  const html = await response?.text();
  expect(html).toContain("E2E Storefront Overcoat");
  expect(html).toContain("E2E Outside-Collection Blazer");
});
