import {
  CustomerRepository,
  ProductRepository,
  WardrobeRepository,
  createSupabaseAdminClient,
} from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import { TEST_RETAILER_SLUG } from "./fixtures";
import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "17.13";
const BROWSER_PROOF_SPEC = "apps/customer/e2e/wardrobe-card-reveal.spec.ts";

let proofPassed = false;

test.afterAll(async () => {
  await writeBrowserProofRun({
    phaseItemId: PHASE_ITEM_ID,
    spec: BROWSER_PROOF_SPEC,
    status: proofPassed ? "passed" : "failed",
  });
});

/**
 * Proves the QR wardrobe card's physical-to-digital bridge (PHASE 17.13 /
 * ADV-113) end to end: scanning the tag (an anonymous GET, no session)
 * shows the garment's real information — never the owning customer's
 * name or email, which never appear on the page. A linked catalogue
 * product surfaces a real "Shop this piece" link; retiring the item
 * (the existing `WardrobeRepository.retire`, reused rather than
 * duplicated) flips the page to a retired notice; and an unknown token
 * resolves to a real 404, not a broken render.
 */
test("an anonymous scan reveals the garment's own information, a linked product links out, retiring updates the public page, and an unknown token 404s", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  const { data: retailer } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");
  const retailerId = asId<"RetailerId">(retailer.id);

  const { data: staff } = await admin
    .from("retailer_staff_members")
    .select("id")
    .eq("retailer_id", retailerId)
    .limit(1)
    .single();
  if (!staff) throw new Error("fixture staff missing");

  const unique = Date.now();
  const customerRepo = new CustomerRepository(admin);
  const wardrobeRepo = new WardrobeRepository(admin);
  const productRepo = new ProductRepository(admin);

  const customer = await customerRepo.create({
    retailerId,
    fullName: `E2E Wardrobe Card Customer ${unique}`,
    email: `wardrobe-card-${unique}@paon.test`,
    lifecycleStage: "prospect",
  });

  const products = await productRepo.findByRetailer(retailerId);
  const product = products[0];
  if (!product) throw new Error("fixture retailer has no products");

  const item = await wardrobeRepo.createCatalogueItem(
    {
      retailerId,
      customerId: customer.id,
      productId: product.id,
      categoryCode: "jacket",
      displayName: `E2E Card Blazer ${unique}`,
      brand: "PAON Atelier",
      description: "A three-roll two navy blazer, hand-finished.",
      condition: "good",
      careState: "current",
      fitPerception: "true_to_size",
    },
    asId<"StaffId">(staff.id),
  );

  try {
    // Anonymous scan: no login, no cookies set for this request.
    await page.context().clearCookies();
    await page.goto(`/r/${TEST_RETAILER_SLUG}/wardrobe/${item.publicToken}`);

    await expect(page.getByText("E2E Card Blazer")).toBeVisible();
    await expect(page.getByText("PAON Atelier")).toBeVisible();
    await expect(
      page.getByText("A three-roll two navy blazer, hand-finished."),
    ).toBeVisible();

    // Never the owning customer's identity.
    await expect(page.getByText(customer.fullName)).toHaveCount(0);
    await expect(page.getByText(customer.email!)).toHaveCount(0);

    // A linked catalogue product resolves to a real, working link.
    const shopLink = page.getByRole("link", { name: "Shop this piece" });
    await expect(shopLink).toBeVisible();
    await expect(shopLink).toHaveAttribute(
      "href",
      `/r/${TEST_RETAILER_SLUG}/products/${product.slug}`,
    );

    // Retiring (the existing repository method, not a duplicate action)
    // is reflected on the very next anonymous load.
    await wardrobeRepo.retire(retailerId, item.id);
    await page.reload();
    await expect(
      page.getByText("This piece has been retired from active wear."),
    ).toBeVisible();

    // An unknown token is a real 404, not a broken/empty render.
    const missingResponse = await page.goto(
      `/r/${TEST_RETAILER_SLUG}/wardrobe/00000000-0000-4000-8000-000000000000`,
    );
    expect(missingResponse?.status()).toBe(404);

    proofPassed = true;
  } finally {
    await admin.from("wardrobe_items").delete().eq("id", item.id);
    await admin.from("customers").delete().eq("id", customer.id);
  }
});
