import { resolve } from "node:path";

import { WardrobeRepository, createSupabaseAdminClient } from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test, type Page } from "@playwright/test";

import {
  TEST_CUSTOMER_EMAIL,
  TEST_PRODUCT_SLUG,
  TEST_RETAILER_SLUG,
} from "./fixtures";

/**
 * PHASE 20.26 — Wardrobe eight-rail contract proof.
 *
 * CUSTOMER_ENVIRONMENT_REBUILD_V3 §5.2: exactly eight rails, in the contract
 * order, each rendered even when empty; a rail is a full-width slice with no
 * rounded outer container; each rail carries exactly ten empty slots; the
 * header count is owned real items only (advisor selections and empty slots
 * excluded); retailer purchase-linked garments only. §5.3: the owned card
 * image is edge-to-edge object-contain, never clipped.
 *
 * Test-only proof lane — no application code is changed. Deeper card-face and
 * Actions+ deck behaviour is proven in wardrobe-v3-presentation.spec.ts (20.9);
 * this spec pins the structural rail contract.
 */

const RAILS_IN_ORDER = [
  "Suits",
  "Jackets",
  "Trousers",
  "Shirts",
  "Outerwear",
  "Knitwear",
  "Shoes",
  "Accessories",
];

const OWNED_DISPLAY_NAME = "V26 Rail Contract Derby";
const PHOTO_URL =
  "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22400%22%20height%3D%22600%22%3E%3Crect%20width%3D%22400%22%20height%3D%22600%22%20fill%3D%22%23b7ab97%22%2F%3E%3C%2Fsvg%3E";

const EVIDENCE_DIR = resolve(
  process.cwd(),
  "../../docs/evidence/runs/20.26-wardrobe-rail-contract-v3",
);

function admin() {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) throw new Error("requires local Supabase.");
  return createSupabaseAdminClient(url, key);
}

async function seedPurchaseLinkedShoe(): Promise<{ id: string }> {
  const client = admin();
  const { data: retailer } = await client
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");
  const { data: customer } = await client
    .from("customers")
    .select("id")
    .eq("retailer_id", retailer.id)
    .eq("email", TEST_CUSTOMER_EMAIL)
    .maybeSingle();
  if (!customer) throw new Error("fixture customer missing");
  const { data: staff } = await client
    .from("retailer_staff_members")
    .select("id")
    .eq("retailer_id", retailer.id)
    .not("accepted_at", "is", null)
    .limit(1)
    .single();
  if (!staff) throw new Error("fixture staff member missing");
  const { data: product } = await client
    .from("products")
    .select("id")
    .eq("retailer_id", retailer.id)
    .eq("slug", TEST_PRODUCT_SLUG)
    .single();
  if (!product) throw new Error("fixture product missing");

  await client
    .from("wardrobe_items")
    .delete()
    .eq("customer_id", customer.id)
    .eq("display_name", OWNED_DISPLAY_NAME);

  const item = await new WardrobeRepository(client).createCatalogueItem(
    {
      retailerId: retailer.id,
      customerId: customer.id,
      categoryCode: "shoes",
      displayName: OWNED_DISPLAY_NAME,
      brand: "PAON Atelier",
      condition: "good",
      careState: "current",
      fitPerception: "true_to_size",
      productId: product.id,
      identifyingPhotoUrl: PHOTO_URL,
    },
    asId<"StaffId">(staff.id),
  );
  return { id: item.id };
}

async function signInAndOpenWardrobe(page: Page) {
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
  await page.goto("/wardrobe");
}

test("exactly eight rails in contract order, each with ten empty slots and an owned-only header count", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });

  const seeded = await seedPurchaseLinkedShoe();
  const client = admin();

  try {
    await page.setViewportSize({ width: 1512, height: 982 });
    await signInAndOpenWardrobe(page);

    // 1. Exactly eight rails, contract order.
    await expect(page.locator("[data-wardrobe-rail]")).toHaveCount(8);
    const headings = await page
      .getByRole("heading", { level: 3 })
      .allTextContents();
    expect(headings).toEqual(RAILS_IN_ORDER);

    // 2. Every rail carries exactly ten empty slots — even the empty ones.
    for (const label of RAILS_IN_ORDER) {
      const rail = page.locator("section", {
        has: page.getByRole("heading", { name: label, exact: true }),
      });
      await expect(rail.locator("[data-empty-slot]")).toHaveCount(10);
    }

    // 3. Header count is owned real items only — the seeded purchase-linked
    //    shoe is the one owned item; ten empty slots do not inflate it.
    const shoesRail = page.locator("section", {
      has: page.getByRole("heading", { name: "Shoes", exact: true }),
    });
    await expect(shoesRail.getByText("1 piece", { exact: true })).toBeVisible();

    // 4. Retailer purchase-linked garment only — its foreground image is
    //    edge-to-edge object-contain, never clipped.
    const ownedCard = shoesRail.locator("article", {
      hasText: OWNED_DISPLAY_NAME,
    });
    await expect(ownedCard).toBeVisible();
    await expect(
      ownedCard.getByRole("img", { name: OWNED_DISPLAY_NAME }),
    ).toHaveCSS("object-fit", "contain");

    expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);

    await page.screenshot({
      path: resolve(EVIDENCE_DIR, "desktop-1512x982.png"),
      fullPage: true,
    });

    // Mobile: the eight rails and their ten-slot contract survive.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.locator("[data-wardrobe-rail]")).toHaveCount(8);
    await expect(
      page
        .locator("section", {
          has: page.getByRole("heading", { name: "Suits", exact: true }),
        })
        .locator("[data-empty-slot]"),
    ).toHaveCount(10);
    await page.screenshot({
      path: resolve(EVIDENCE_DIR, "mobile-390x844.png"),
      fullPage: true,
    });

    expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
  } finally {
    await client.from("wardrobe_items").delete().eq("id", seeded.id);
  }
});
