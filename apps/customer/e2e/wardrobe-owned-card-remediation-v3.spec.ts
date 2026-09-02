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
 * Customer V3 live-visual-audit remediation — F5
 * (docs/evidence/reviews/customer-v3-live-visual-audit/README.md).
 *
 * F5: the owned wardrobe card must show the COMPLETE garment image
 *     (object-contain, uncropped) with a progressive blurred lower overlay
 *     behind the product information — and the letterbox band must read as a
 *     deliberate darkened blur of the same image, never plain white, even for
 *     a studio shot on a white background.
 *
 * Contract: CUSTOMER_ENVIRONMENT_REBUILD_V3 §5.3.
 */

// A LANDSCAPE image on a white studio background: contained inside the
// portrait card it leaves large top/bottom letterbox bands, which must read
// as a deliberate darkened blur of the piece — never plain white.
const PHOTO_URL =
  "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22600%22%20height%3D%22300%22%3E%3Crect%20width%3D%22600%22%20height%3D%22300%22%20fill%3D%22%23ffffff%22%2F%3E%3Crect%20x%3D%22210%22%20y%3D%2260%22%20width%3D%22180%22%20height%3D%22180%22%20fill%3D%22%231b2a4a%22%2F%3E%3C%2Fsvg%3E";
const OWNED_DISPLAY_NAME = "F5 Proof Wardrobe Piece";
const ACQUIRED_AT = "2025-01-06T00:00:00.000Z";
const CARD_HEIGHT_PX = 320; // CARD_CLASS h-80

const EVIDENCE_SUBPATH =
  "../../../docs/evidence/runs/customer-v3-dashboard-wardrobe-remediation";

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

async function seedOwnedShoe(): Promise<{ id: string }> {
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

  // Keep today's MorningRoutine empty so the owned item is not also surfaced
  // as a derived recommendation card in the same rail.
  const todayDate = new Date().toISOString().slice(0, 10);
  await client
    .from("morning_routine_selections")
    .delete()
    .eq("customer_id", customerRow.id)
    .eq("for_date", todayDate);

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

test("owned card keeps the complete image and gains a non-white blurred lower overlay", async ({
  page,
}, testInfo) => {
  const evidenceDir = resolve(testInfo.config.rootDir, EVIDENCE_SUBPATH);
  await mkdir(evidenceDir, { recursive: true });

  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${String(e)}`));

  const seeded = await seedOwnedShoe();
  const client = admin();

  try {
    for (const [viewport, label] of [
      [{ width: 1512, height: 982 }, "desktop-1512x982"],
      [{ width: 390, height: 844 }, "mobile-390x844"],
    ] as const) {
      await page.setViewportSize(viewport);
      if (label.startsWith("desktop")) {
        await signInAndOpenWardrobe(page);
      } else {
        await page.goto("/wardrobe");
      }

      const shoesRail = page.locator("section", {
        has: page.getByRole("heading", { name: "Shoes", exact: true }),
      });
      const card = shoesRail
        .locator("article", { hasText: OWNED_DISPLAY_NAME })
        .first();
      await expect(card).toBeVisible();

      // Complete image preserved: the foreground is uncropped object-contain.
      const foreground = card.getByRole("img", { name: OWNED_DISPLAY_NAME });
      await expect(foreground).toBeVisible();
      await expect(foreground).toHaveCSS("object-fit", "contain");
      const fgBox = await foreground.boundingBox();
      expect(fgBox).not.toBeNull();
      expect(fgBox!.width).toBeGreaterThan(0);
      expect(fgBox!.height).toBeGreaterThan(0);

      // A blurred full-bleed background layer of the same image exists.
      const imgs = card.locator("img");
      expect(await imgs.count()).toBeGreaterThanOrEqual(2);
      const bg = imgs.first();
      const bgFilter = await bg.evaluate((el) => getComputedStyle(el).filter);
      expect(bgFilter).toContain("blur(");
      expect(await bg.evaluate((el) => getComputedStyle(el).objectFit)).toBe(
        "cover",
      );
      // The blurred layer is more present than the pre-remediation 0.4.
      expect(await bg.evaluate((el) => getComputedStyle(el).opacity)).toBe(
        "0.6",
      );

      // The letterbox never reads as plain white: a dark scrim sits over the
      // blurred layer, below the foreground image.
      const scrim = card.locator('div[class~="bg-black/40"]');
      await expect(scrim).toHaveCount(1);
      const scrimOpaque = await scrim.evaluate((el) => {
        const s = getComputedStyle(el);
        return s.backgroundColor !== "rgba(0, 0, 0, 0)" && s.opacity !== "0";
      });
      expect(scrimOpaque).toBe(true);

      // Progressive blurred lower overlay still carries the product info.
      await expect(card.getByText(OWNED_DISPLAY_NAME).first()).toBeVisible();
      await expect(
        card.getByText(
          /Purchased on 6 Jan 2025 · \d+ days in your wardrobe|Purchase date unavailable/,
        ),
      ).toBeVisible();
      await expect(
        card.getByRole("button", { name: "Actions +" }),
      ).toBeVisible();

      // The card height is unchanged by the overlay work.
      const cardBox = await card.boundingBox();
      expect(cardBox).not.toBeNull();
      expect(Math.round(cardBox!.height)).toBe(CARD_HEIGHT_PX);

      await page.screenshot({
        path: resolve(evidenceDir, `wardrobe-${label}.png`),
        fullPage: true,
      });
    }

    expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
  } finally {
    await client.from("wardrobe_items").delete().eq("id", seeded.id);
  }
});
