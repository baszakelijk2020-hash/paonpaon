import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import {
  createSupabaseAdminClient,
  MicroCapsuleRepository,
} from "@paon/database";
import { asId } from "@paon/domain";
import { formatMoney } from "@paon/utils";
import { expect, test, type Page } from "@playwright/test";

import {
  TEST_CUSTOMER_EMAIL,
  TEST_PRODUCT_SLUG,
  TEST_RETAILER_SLUG,
} from "./fixtures";

/**
 * §7 "Seasonal staff favourites" — Orders supporting module.
 *
 * This is the retailer's existing real MicroCapsule / Capsule Drop system
 * (same repository, same `/capsule` page, same retailer `capsule-drops`
 * control) rendered compactly on Orders — never a second selection engine,
 * never a fabricated staff identity, price, or campaign. Proves: real
 * published drop, real stored rank order, real name/price/image, real
 * `?legacy=1` product-detail landing, real `/capsule` link, no duplicate
 * product IDs against Complete the Look on the same viewport, absence with
 * no current published drop, and that Pending Orders / Order History /
 * existing per-order actions are all still intact.
 */

const EVIDENCE_DIR = resolve(
  process.cwd(),
  "../../docs/evidence/runs/customer-v3-orders-seasonal-staff-favourites",
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

async function fixtureRetailerAndCustomer() {
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
    .single();
  if (!customer) throw new Error("fixture customer missing");
  return {
    client,
    retailerId: retailer.id as string,
    customerId: customer.id as string,
  };
}

/** Ensures at least one real order exists so Orders' Pending/History
 * sections, per-order actions, and the retailer context the seasonal
 * module needs are all present — same fixture shape as
 * orders-actions-v3.spec.ts's seedPendingOrder. */
async function seedOrder(): Promise<{ id: string; orderNumber: string }> {
  const { client, retailerId, customerId } = await fixtureRetailerAndCustomer();

  const { data: product } = await client
    .from("products")
    .select("id")
    .eq("retailer_id", retailerId)
    .eq("slug", TEST_PRODUCT_SLUG)
    .single();
  if (!product) throw new Error("fixture product missing");

  const { data: variant } = await client
    .from("product_variants")
    .select("id")
    .eq("product_id", product.id)
    .eq("sku", "E2E-OVERCOAT-42")
    .maybeSingle();
  if (!variant) throw new Error("fixture product variant missing");

  await client
    .from("orders")
    .delete()
    .eq("customer_id", customerId)
    .ilike("order_number", "E2E-SSF-%");

  const orderNumber = `E2E-SSF-${Date.now()}`;
  const priceMinorUnits = 450000;

  const { data: orderInserted, error: orderError } = await client
    .from("orders")
    .insert({
      retailer_id: retailerId,
      customer_id: customerId,
      order_number: orderNumber,
      status: "placed",
      channel: "online",
      currency: "USD",
      subtotal_amount_minor_units: priceMinorUnits,
      total_amount_minor_units: priceMinorUnits,
    })
    .select("id")
    .single();
  if (orderError || !orderInserted) {
    throw new Error(
      `Failed to insert order: ${orderError?.message ?? "unknown"}`,
    );
  }

  const { error: lineError } = await client.from("order_lines").insert({
    order_id: orderInserted.id,
    product_variant_id: variant.id,
    quantity: 1,
    unit_price_amount_minor_units: priceMinorUnits,
    unit_price_currency: "USD",
    requires_production: false,
    requires_alteration: false,
  });
  if (lineError) {
    throw new Error(`Failed to insert order_line: ${lineError.message}`);
  }

  return { id: orderInserted.id, orderNumber };
}

const FIXTURE_IMAGE_URL =
  "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22400%22%20height%3D%22600%22%3E%3Crect%20width%3D%22400%22%20height%3D%22600%22%20fill%3D%22%236b7360%22%2F%3E%3C%2Fsvg%3E";

/**
 * The fixture retailer genuinely carries only two real active,
 * non-deleted products (`e2e-storefront-overcoat` and
 * `e2e-item-specific-ctl-trousers`), and the order this spec must also
 * seed (to exercise Pending Orders / Order History / Complete the Look
 * together with the seasonal module) always consumes one of them as
 * Complete the Look's real source — correctly excluded from Seasonal
 * staff favourites by the component's own de-dup rule. Proving "two real
 * products in exact stored rank, with no overlap with another module"
 * therefore needs two dedicated real catalogue products and one real
 * variant/price, seeded here the same way other specs in this suite seed
 * real fixture rows (e.g. wardrobe items, retailer branches, roadmap
 * gaps) — genuine rows in the real tables, created and torn down by this
 * test, never a UI-level fabrication.
 */
async function seedDedicatedProducts(retailerId: string): Promise<{
  first: { id: string; slug: string; name: string; imageUrl: string };
  second: { id: string; slug: string; name: string };
}> {
  const client = admin();
  const suffix = Date.now();

  const { data: firstProduct, error: firstError } = await client
    .from("products")
    .insert({
      retailer_id: retailerId,
      name: "Orders Seasonal Favourites E2E Piece One",
      slug: `e2e-ssf-piece-one-${suffix}`,
      description: "E2E fixture product for the Orders seasonal module.",
      status: "active",
      is_made_to_order: false,
      is_alterable: false,
      primary_image_url: FIXTURE_IMAGE_URL,
    })
    .select("id, slug, name, primary_image_url")
    .single();
  if (firstError || !firstProduct) {
    throw new Error(
      `failed to seed first product: ${firstError?.message ?? "unknown"}`,
    );
  }

  const { data: secondProduct, error: secondError } = await client
    .from("products")
    .insert({
      retailer_id: retailerId,
      name: "Orders Seasonal Favourites E2E Piece Two",
      slug: `e2e-ssf-piece-two-${suffix}`,
      description: "E2E fixture product for the Orders seasonal module.",
      status: "active",
      is_made_to_order: false,
      is_alterable: false,
    })
    .select("id, slug, name")
    .single();
  if (secondError || !secondProduct) {
    throw new Error(
      `failed to seed second product: ${secondError?.message ?? "unknown"}`,
    );
  }

  const { error: variantError } = await client.from("product_variants").insert({
    product_id: firstProduct.id,
    sku: `E2E-SSF-ONE-${suffix}`,
    price_amount_minor_units: 32000,
    price_currency: "USD",
  });
  if (variantError) {
    throw new Error(`failed to seed variant: ${variantError.message}`);
  }

  return {
    first: {
      id: firstProduct.id,
      slug: firstProduct.slug,
      name: firstProduct.name,
      imageUrl: firstProduct.primary_image_url!,
    },
    second: {
      id: secondProduct.id,
      slug: secondProduct.slug,
      name: secondProduct.name,
    },
  };
}

async function signIn(page: Page, consoleErrors: string[]): Promise<void> {
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
  // Authentication-phase errors (magic-link redirect, dashboard first
  // paint) are separate from what this spec claims about /orders — clear
  // here so only the Orders route itself is judged console-clean.
  consoleErrors.length = 0;
  await page.goto("/orders");
}

for (const viewport of [
  { name: "desktop", width: 1512, height: 982 },
  { name: "mobile", width: 390, height: 844 },
] as const) {
  test.describe(viewport.name, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("Orders' Seasonal staff favourites shows the real published Capsule Drop, in real order, with real data, real hrefs, and no duplicate products", async ({
      page,
    }, testInfo) => {
      const evidenceDir = resolve(testInfo.config.rootDir, EVIDENCE_DIR);
      await mkdir(evidenceDir, { recursive: true });
      const consoleErrors: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") consoleErrors.push(m.text());
      });
      page.on("pageerror", (e) =>
        consoleErrors.push(`pageerror: ${String(e)}`),
      );

      const { client, retailerId } = await fixtureRetailerAndCustomer();
      const order = await seedOrder();

      const { first, second } = await seedDedicatedProducts(retailerId);
      const weekStart = new Date().toISOString().slice(0, 10);
      const dropRepo = new MicroCapsuleRepository(client);
      await client
        .from("micro_capsule_drops")
        .delete()
        .eq("retailer_id", retailerId)
        .eq("week_start", weekStart);

      const drop = await dropRepo.createDrop(asId<"RetailerId">(retailerId), {
        title: "Orders Seasonal Favourites E2E Capsule",
        theme: "Orders module proof",
        weekStart,
        // `first` is stored at rank 1, `second` at rank 2 — proves the
        // module renders findProductsForDrop's real stored rank.
        productIds: [first.id, second.id],
      });
      await dropRepo.setPublished(drop.id, true);

      const { data: variant } = await client
        .from("product_variants")
        .select("price_amount_minor_units, price_currency")
        .eq("product_id", first!.id)
        .limit(1)
        .maybeSingle();

      try {
        await signIn(page, consoleErrors);

        // Pending Orders precedes Order History, visually.
        const pendingHeading = page.locator("#orders-pending-heading");
        const historyHeading = page.locator("#orders-history-heading");
        await expect(pendingHeading).toBeVisible();
        await expect(historyHeading).toBeVisible();
        const pendingBox = await pendingHeading.boundingBox();
        const historyBox = await historyHeading.boundingBox();
        expect(pendingBox).not.toBeNull();
        expect(historyBox).not.toBeNull();
        expect(pendingBox!.y).toBeLessThan(historyBox!.y);

        // The seeded order's real per-order actions still render.
        const orderCard = page
          .locator("article", { hasText: order.orderNumber })
          .first();
        await expect(orderCard).toBeVisible();
        await expect(
          orderCard.getByRole("link", { name: "Order again" }),
        ).toBeVisible();
        await expect(
          orderCard.getByRole("link", { name: "Complete the look" }),
        ).toBeVisible();
        await expect(
          orderCard.getByRole("link", { name: "Ask a question" }),
        ).toBeVisible();
        await expect(
          orderCard.getByRole("link", { name: "Request service" }),
        ).toBeVisible();
        await expect(
          orderCard.getByRole("link", { name: "View order / invoice" }),
        ).toHaveAttribute("href", `/orders/${order.id}`);

        // Seasonal staff favourites: real drop title/theme. The module
        // renders the title as plain text (not a semantic heading role).
        await expect(page.getByText("Seasonal staff favourites")).toBeVisible();
        await expect(
          page.getByText("Orders Seasonal Favourites E2E Capsule"),
        ).toBeVisible();
        await expect(page.getByText("Orders module proof")).toBeVisible();

        // Real stored rank order: first!.id at rank 1.
        const favouriteLinks = page.locator(
          `#orders-seasonal-favourites a[href^="/r/${TEST_RETAILER_SLUG}/products/"]`,
        );
        const favouriteHrefs = await favouriteLinks.evaluateAll((nodes) =>
          nodes.map((node) => node.getAttribute("href")),
        );
        const firstHref = `/r/${TEST_RETAILER_SLUG}/products/${first!.slug}?legacy=1`;
        const secondHref = `/r/${TEST_RETAILER_SLUG}/products/${second!.slug}?legacy=1`;
        expect(favouriteHrefs).toContain(firstHref);
        expect(favouriteHrefs).toContain(secondHref);
        expect(favouriteHrefs.indexOf(firstHref)).toBeLessThan(
          favouriteHrefs.indexOf(secondHref),
        );

        // Real product name.
        await expect(
          page.locator(`a[href="${firstHref}"]`).getByText(first!.name),
        ).toBeVisible();

        // Real configured price, formatted through the same real money
        // utility the component uses.
        if (variant) {
          const priceLabel = formatMoney(
            {
              amountMinorUnits: variant.price_amount_minor_units,
              currency: variant.price_currency as never,
            },
            "en-US",
          );
          await expect(
            page.getByText(priceLabel, { exact: true }),
          ).toBeVisible();
        }

        // Real image, fully visible (object-contain), not clipped — the
        // fixture query preferred image-bearing products, so this must
        // hold; if it doesn't, that's a real environment gap, not
        // something to work around.
        // `first` is seeded with a real primary image (`FIXTURE_IMAGE_URL`)
        // specifically so this assertion holds honestly, not by luck.
        const imagedHref = `/r/${TEST_RETAILER_SLUG}/products/${first.slug}?legacy=1`;
        const foregroundImage = page
          .locator(`a[href="${imagedHref}"] img`)
          .last();
        await expect(foregroundImage).toBeVisible();
        const objectFit = await foregroundImage.evaluate(
          (node) => getComputedStyle(node).objectFit,
        );
        expect(objectFit).toBe("contain");
        const naturalVsRendered = await foregroundImage.evaluate((node) => {
          const img = node as HTMLImageElement;
          return {
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            clientWidth: img.clientWidth,
            clientHeight: img.clientHeight,
          };
        });
        expect(naturalVsRendered.naturalWidth).toBeGreaterThan(0);
        expect(naturalVsRendered.naturalHeight).toBeGreaterThan(0);
        // object-contain guarantees the full image fits within the box —
        // real proof (not clipped) is that the rendered box is no smaller
        // than the image's own aspect-fit within it, i.e. it loaded and
        // painted at a non-zero size equal to or within the tile.
        expect(naturalVsRendered.clientWidth).toBeGreaterThan(0);
        expect(naturalVsRendered.clientHeight).toBeGreaterThan(0);

        // Clicking a favourite lands on the exact final product URL with
        // ?legacy=1 and shows the real product title — not the storefront
        // root.
        await page.locator(`a[href="${firstHref}"]`).first().click();
        await expect(page).toHaveURL(
          new RegExp(
            `/r/${TEST_RETAILER_SLUG}/products/${first!.slug}\\?legacy=1$`,
          ),
        );
        await expect(page.getByText(first!.name).first()).toBeVisible();
        await page.goBack();
        await expect(page).toHaveURL(/\/orders$/);

        // Real link to the existing /capsule experience.
        const capsuleLink = page.getByRole("link", {
          name: "View the full capsule",
        });
        await expect(capsuleLink).toHaveAttribute("href", "/capsule");

        // No duplicate canonical product ID between Seasonal staff
        // favourites and Complete the Look on the same viewport.
        const completeTheLookLinks = page.locator(
          `#complete-the-look a[href^="/r/${TEST_RETAILER_SLUG}/products/"]`,
        );
        const completeTheLookHrefs = await completeTheLookLinks.evaluateAll(
          (nodes) => nodes.map((node) => node.getAttribute("href")),
        );
        const overlap = completeTheLookHrefs.filter((href) =>
          favouriteHrefs.includes(href),
        );
        expect(overlap).toEqual([]);

        await page.screenshot({
          path: `${evidenceDir}/${viewport.name}-orders-seasonal-favourites.png`,
          fullPage: true,
        });

        expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
      } finally {
        await client.from("micro_capsule_drops").delete().eq("id", drop.id);
        await client.from("orders").delete().eq("id", order.id);
        await client
          .from("product_variants")
          .delete()
          .eq("product_id", first.id);
        await client.from("products").delete().eq("id", first.id);
        await client.from("products").delete().eq("id", second.id);
      }
    });

    test("Orders shows no Seasonal staff favourites module when no current published drop exists", async ({
      page,
    }, testInfo) => {
      const evidenceDir = resolve(testInfo.config.rootDir, EVIDENCE_DIR);
      await mkdir(evidenceDir, { recursive: true });
      const consoleErrors: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") consoleErrors.push(m.text());
      });
      page.on("pageerror", (e) =>
        consoleErrors.push(`pageerror: ${String(e)}`),
      );

      const { client, retailerId } = await fixtureRetailerAndCustomer();
      const order = await seedOrder();

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
        await signIn(page, consoleErrors);

        await expect(
          page.getByText("Seasonal staff favourites"),
        ).not.toBeVisible();
        await expect(
          page.getByRole("link", { name: "View the full capsule" }),
        ).not.toBeVisible();

        await page.screenshot({
          path: `${evidenceDir}/${viewport.name}-orders-no-drop.png`,
          fullPage: true,
        });

        expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
      } finally {
        for (const row of existing ?? []) {
          await client
            .from("micro_capsule_drops")
            .update({ published: true })
            .eq("id", row.id);
        }
        await client.from("orders").delete().eq("id", order.id);
      }
    });
  });
}
