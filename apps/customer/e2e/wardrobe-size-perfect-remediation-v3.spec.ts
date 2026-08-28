import { mkdir } from "node:fs/promises";
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
 * DeepSeek remediation Card 3 — Wardrobe "The size is perfect".
 *
 * Previously: `href={`/products/${item.productId}`}` — a route that does
 * not exist in this app (the real product-detail route is
 * `/r/{retailerSlug}/products/{productSlug}`), so the control was a dead
 * link.
 *
 * Fixed: the owned card's Order-Again screen now uses a server-resolved
 * `card.productDetailHref` built from the item's real linked product and
 * the real retailer slug. When no product link exists — or resolves to
 * nothing — only the real "Ask your advisor to reorder" fallback renders;
 * no fabricated route, product, variant, or order is ever shown.
 */

const PHOTO_URL =
  "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22400%22%20height%3D%22600%22%3E%3Crect%20width%3D%22400%22%20height%3D%22600%22%20fill%3D%22%23b7ab97%22%2F%3E%3C%2Fsvg%3E";
const LINKED_DISPLAY_NAME = "Size-Perfect Proof Linked Shoe";
const UNLINKED_DISPLAY_NAME = "Size-Perfect Proof Unlinked Jacket";

const EVIDENCE_SUBPATH =
  "../../../docs/evidence/runs/customer-v3-wardrobe-size-perfect-remediation";

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

async function signInAndOpenWardrobe(page: Page): Promise<void> {
  const { data, error } = await admin().auth.admin.generateLink({
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

async function seedFixtures(): Promise<{
  linkedId: string;
  unlinkedId: string;
}> {
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
    .in("display_name", [LINKED_DISPLAY_NAME, UNLINKED_DISPLAY_NAME]);

  const { data: product } = await client
    .from("products")
    .select("id")
    .eq("retailer_id", retailer.id)
    .eq("slug", TEST_PRODUCT_SLUG)
    .single();
  if (!product) throw new Error("fixture product missing");

  const wardrobeRepo = new WardrobeRepository(client);
  const staffId = asId<"StaffId">(staffRow.id);

  // Real, still-existing product link — "The size is perfect" must land on
  // the real product-detail route.
  const linked = await wardrobeRepo.createCatalogueItem(
    {
      retailerId: retailer.id,
      customerId: customerRow.id,
      categoryCode: "shoes",
      displayName: LINKED_DISPLAY_NAME,
      brand: "PAON Atelier",
      condition: "good",
      careState: "current",
      fitPerception: "true_to_size",
      productId: product.id,
      identifyingPhotoUrl: PHOTO_URL,
      acquiredAt: "2025-01-06T00:00:00.000Z",
    },
    staffId,
  );

  // No product link at all — "Ask your advisor to reorder" is the only
  // real option; no route may be fabricated for it. This repository call is
  // a test fixture, not the removed customer-facing external-garment UI.
  const unlinked = await wardrobeRepo.createExternalItem({
    retailerId: retailer.id,
    customerId: customerRow.id,
    categoryCode: "jacket",
    displayName: UNLINKED_DISPLAY_NAME,
    brand: "Another Tailor",
    condition: "good",
    careState: "current",
    fitPerception: "true_to_size",
    identifyingPhotoUrl: PHOTO_URL,
    acquiredAt: "2025-01-06T00:00:00.000Z",
  });

  return { linkedId: linked.id, unlinkedId: unlinked.id };
}

async function openOrderAgain(page: Page, displayName: string) {
  const card = page
    .locator("article", { hasText: displayName })
    .first();
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Actions +" }).click();
  await card.getByText("Order again", { exact: true }).click();
  return card;
}

test("owned-card Order Again offers the real product route or the real advisor fallback, never a broken link", async ({
  page,
}, testInfo) => {
  const evidenceDir = resolve(testInfo.config.rootDir, EVIDENCE_SUBPATH);
  await mkdir(evidenceDir, { recursive: true });

  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${String(e)}`));

  const { linkedId, unlinkedId } = await seedFixtures();
  const client = admin();

  try {
    await signInAndOpenWardrobe(page);

    // --- Case A: item has a real, still-existing linked product. ---
    const linkedCard = await openOrderAgain(page, LINKED_DISPLAY_NAME);
    const sizePerfect = linkedCard.getByRole("link", {
      name: "The size is perfect",
    });
    await expect(sizePerfect).toBeVisible();
    const href = await sizePerfect.getAttribute("href");
    expect(href).not.toBeNull();
    // Never the old broken destination.
    expect(href).not.toMatch(/^\/products\//);
    // The real retailer product-detail route, with the real slugs.
    expect(href).toBe(`/r/${TEST_RETAILER_SLUG}/products/${TEST_PRODUCT_SLUG}`);

    // Following it must actually resolve — not 404, not an error page.
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith(href!)),
      sizePerfect.click(),
    ]);
    expect(response.status()).toBe(200);
    await expect(page.getByText(/page not found|404/i)).toHaveCount(0);

    await page.screenshot({
      path: resolve(evidenceDir, "size-perfect-linked-product-desktop.png"),
      fullPage: true,
    });

    // --- Case B: item has no product link at all. ---
    await page.goto("/wardrobe");
    const unlinkedCard = await openOrderAgain(page, UNLINKED_DISPLAY_NAME);
    await expect(
      unlinkedCard.getByRole("link", { name: "The size is perfect" }),
    ).toHaveCount(0);
    await expect(
      unlinkedCard.getByRole("button", {
        name: "Ask your advisor to reorder",
      }),
    ).toBeVisible();

    await page.screenshot({
      path: resolve(evidenceDir, "size-perfect-unlinked-fallback-desktop.png"),
      fullPage: true,
    });

    // --- Mobile: the linked case still resolves to the real route. ---
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/wardrobe");
    const linkedCardMobile = await openOrderAgain(page, LINKED_DISPLAY_NAME);
    const mobileHref = await linkedCardMobile
      .getByRole("link", { name: "The size is perfect" })
      .getAttribute("href");
    expect(mobileHref).toBe(
      `/r/${TEST_RETAILER_SLUG}/products/${TEST_PRODUCT_SLUG}`,
    );

    await page.screenshot({
      path: resolve(evidenceDir, "size-perfect-linked-product-mobile.png"),
      fullPage: true,
    });

    expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
  } finally {
    await client
      .from("wardrobe_items")
      .delete()
      .in("id", [linkedId, unlinkedId]);
  }
});
