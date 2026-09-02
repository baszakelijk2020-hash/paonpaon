import { mkdir } from "node:fs/promises";
import path from "node:path";

import { WardrobeRepository, createSupabaseAdminClient } from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test, type Page } from "@playwright/test";

import {
  TEST_CUSTOMER_EMAIL,
  TEST_PRODUCT_SLUG,
  TEST_RETAILER_SLUG,
} from "./fixtures";

/**
 * PHASE 20.9 — Customer Wardrobe V3 presentation.
 *
 * Customer Environment Rebuild V3 §5. Proves the presentation contract the
 * wardrobe rebuild (430a97b, 30474bf, 0b56d26) must satisfy, end to end,
 * against a real authenticated customer session and a real retailer
 * purchase-linked garment:
 *
 *  - exactly eight rails, contract order, each with ten empty slots and an
 *    owned-only header count;
 *  - owned card face: full-bleed `object-contain` product image (never
 *    clipped), a progressive-blur bottom overlay carrying the title and
 *    `Purchased on <date> · <N> days in your wardrobe`, and a footer control
 *    that is exactly `Actions +` — no Garment Details, no provenance,
 *    purchase-location or "house" copy;
 *  - `Actions +` opens a deck that replaces the card face in place without
 *    growing the card or the rail, and never appends a form below the card.
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

const OWNED_DISPLAY_NAME = "V3 Proof Derby Shoe";
const ACQUIRED_AT = "2025-01-06T00:00:00.000Z";
// A self-contained data-URI image so the foreground <img> always resolves
// (no network, no 404) and its computed `object-fit` can be asserted.
const PHOTO_URL =
  "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22400%22%20height%3D%22600%22%3E%3Crect%20width%3D%22400%22%20height%3D%22600%22%20fill%3D%22%23b7ab97%22%2F%3E%3C%2Fsvg%3E";

const EVIDENCE_DIR = path.resolve(
  process.cwd(),
  "../../docs/evidence/runs/20.9-customer-wardrobe",
);

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

async function signInAndOpenWardrobe(page: Page) {
  const client = admin();
  const { data, error } = await client.auth.admin.generateLink({
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
}

async function seedRetailerPurchasedShoe(): Promise<{ id: string }> {
  const client = admin();
  const { data: retailer } = await client
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");
  const { data: customerRow } = await client
    .from("customers")
    .select("id")
    .eq("retailer_id", retailer.id)
    .eq("email", TEST_CUSTOMER_EMAIL)
    .maybeSingle();
  if (!customerRow) throw new Error("fixture customer missing");
  const { data: staffRow } = await client
    .from("retailer_staff_members")
    .select("id")
    .eq("retailer_id", retailer.id)
    .not("accepted_at", "is", null)
    .limit(1)
    .single();
  if (!staffRow) throw new Error("fixture staff member missing");

  await client
    .from("wardrobe_items")
    .delete()
    .eq("customer_id", customerRow.id)
    .eq("retailer_id", retailer.id)
    .eq("display_name", OWNED_DISPLAY_NAME);

  const { data: product } = await client
    .from("products")
    .select("id")
    .eq("retailer_id", retailer.id)
    .eq("slug", TEST_PRODUCT_SLUG)
    .single();
  if (!product) throw new Error("fixture product missing");

  const wardrobeRepo = new WardrobeRepository(client);
  const item = await wardrobeRepo.createCatalogueItem(
    {
      retailerId: retailer.id,
      customerId: customerRow.id,
      categoryCode: "shoes",
      displayName: OWNED_DISPLAY_NAME,
      brand: "PAON Atelier",
      condition: "good",
      careState: "current",
      fitPerception: "true_to_size",
      productId: product.id,
      identifyingPhotoUrl: PHOTO_URL,
      acquiredAt: ACQUIRED_AT,
    },
    asId<"StaffId">(staffRow.id),
  );

  return { id: item.id };
}

test("eight rails, an uncropped owned card face, and an in-place Actions+ deck", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  const seeded = await seedRetailerPurchasedShoe();
  const client = admin();

  try {
    await signInAndOpenWardrobe(page);

    // 1. Exactly eight rails, contract order.
    const headings = await page
      .getByRole("heading", { level: 3 })
      .allTextContents();
    expect(headings).toEqual(RAILS_IN_ORDER);

    // 2. Every rail carries exactly ten empty slots.
    for (const label of RAILS_IN_ORDER) {
      const rail = page.locator("section", {
        has: page.getByRole("heading", { name: label, exact: true }),
      });
      await expect(rail.locator("[data-empty-slot]")).toHaveCount(10);
    }

    const shoesRail = page.locator("section", {
      has: page.getByRole("heading", { name: "Shoes", exact: true }),
    });

    // 3. Header count is owned real items only (not slots, not selections).
    await expect(shoesRail.getByText("1 piece", { exact: true })).toBeVisible();

    const ownedCard = shoesRail.locator("article", {
      hasText: OWNED_DISPLAY_NAME,
    });
    await expect(ownedCard).toBeVisible();

    // 4. Foreground product image is full-bleed object-contain — never
    //    clipped, no crop.
    const foreground = ownedCard.getByRole("img", {
      name: OWNED_DISPLAY_NAME,
    });
    await expect(foreground).toBeVisible();
    await expect(foreground).toHaveCSS("object-fit", "contain");

    // 5. Progressive-blur overlay carries the title and the real
    //    purchased-on / days-owned line.
    await expect(ownedCard.getByText(OWNED_DISPLAY_NAME).first()).toBeVisible();
    await expect(
      ownedCard.getByText(
        /Purchased on 6 Jan 2025 · \d+ days in your wardrobe/,
      ),
    ).toBeVisible();

    // 6. Footer control is exactly `Actions +`; Garment Details is gone.
    await expect(
      ownedCard.getByRole("button", { name: "Actions +" }),
    ).toBeVisible();
    await expect(ownedCard.getByText(/garment details/i)).toHaveCount(0);

    // 7. No provenance / purchase-location / house copy anywhere.
    await expect(page.getByText(/purchased here/i)).toHaveCount(0);
    await expect(page.getByText(/bought elsewhere/i)).toHaveCount(0);
    await expect(page.getByText(/^house$/i)).toHaveCount(0);

    // 8. Actions + replaces the card face in place: the card and the rail
    //    keep their exact height, and no form is appended below the card.
    const cardBefore = await ownedCard.boundingBox();
    const railBefore = await shoesRail.boundingBox();
    await ownedCard.getByRole("button", { name: "Actions +" }).click();

    await expect(
      ownedCard.getByRole("button", { name: "Complete the look" }),
    ).toBeVisible();
    for (const action of [
      "Order again",
      "Book a repair",
      "Book an alteration",
      "Book a cleaning",
      "Do a fit-check in app",
      "Retire",
      "Ask your advisor",
    ]) {
      await expect(ownedCard.getByText(action, { exact: true })).toBeVisible();
    }
    await expect(
      ownedCard.getByRole("link", { name: "Request a fit-check in store" }),
    ).toBeVisible();

    const cardAfter = await ownedCard.boundingBox();
    const railAfter = await shoesRail.boundingBox();
    expect(cardAfter?.height).toBe(cardBefore?.height);
    expect(cardAfter?.width).toBe(cardBefore?.width);
    expect(railAfter?.height).toBe(railBefore?.height);

    expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
  } finally {
    await client.from("wardrobe_items").delete().eq("id", seeded.id);
  }
});

test("authenticated desktop and mobile capture of the wardrobe", async ({
  page,
}) => {
  const seeded = await seedRetailerPurchasedShoe();
  const client = admin();
  await mkdir(EVIDENCE_DIR, { recursive: true });

  try {
    await page.setViewportSize({ width: 1512, height: 982 });
    await signInAndOpenWardrobe(page);
    await expect(
      page.getByRole("heading", { name: "Wardrobe", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Shoes", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, "desktop-1512x982.png"),
      fullPage: true,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/wardrobe");
    await expect(
      page.getByRole("heading", { name: "Wardrobe", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, "mobile-390x844.png"),
      fullPage: true,
    });
  } finally {
    await client.from("wardrobe_items").delete().eq("id", seeded.id);
  }
});
