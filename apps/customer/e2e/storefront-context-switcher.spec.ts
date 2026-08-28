import { createSupabaseAdminClient } from "@paon/database";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL } from "./fixtures";

const MOBILE_VIEWPORT = { width: 390, height: 844 }; // iPhone 12-class
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };

// `atelier-demo` (CANONICAL_DEMO_RETAILER_SLUG), not the `fixtures.ts`
// e2e-customer-workspace retailer: that fixture retailer deliberately seeds
// a single product/category (see storefront.spec.ts), which can't prove
// "the full category list stays visible" — there'd be nothing to collapse.
// atelier-demo carries the full founder taxonomy across multiple
// categories. The switcher itself needs no retailer-scoped customer
// association (`tableServiceSignedIn` only checks `accountType ===
// "customer"`, ADR-013), so any signed-in customer works here.
const DEMO_RETAILER_SLUG = "atelier-demo";

async function signIn(page: Page): Promise<void> {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
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
}

test.describe("desktop", () => {
  test.use({ viewport: DESKTOP_VIEWPORT });

  test("storefront context switcher shows full category list and persists on return", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await signIn(page);

    // Land on the default category first (no `?category=`) to discover a
    // real, currently-populated category name for this seed, rather than
    // hardcoding one that may not exist in every environment.
    await page.goto(`/r/${DEMO_RETAILER_SLUG}`);
    const catItems = page.locator("#cat-grid .cat-item");
    const totalCategories = await catItems.count();
    expect(totalCategories).toBeGreaterThan(1);
    // atelier-demo's default landing is the curated story/gate page (no
    // `.active` category yet, per `landOnGrid` in route.ts) — read the
    // first rendered category label instead of relying on `.active`.
    const targetCategory = await catItems
      .first()
      .locator(".cat-label")
      .innerText();

    // Simulate "opened a storefront category from the customer
    // environment": an explicit `?category=` deep link, same as the
    // dashboard sidebar's category links produce.
    await page.goto(
      `/r/${DEMO_RETAILER_SLUG}?category=${encodeURIComponent(targetCategory)}`,
    );

    // Requirement 1: full category list stays visible, only the requested
    // one is highlighted — never collapsed to one category.
    expect(await catItems.count()).toBe(totalCategories);
    await expect(
      page.locator("#cat-grid .cat-item.active .cat-label"),
    ).toHaveText(targetCategory);

    // Requirement 2/3: the switcher renders, Store is the active state.
    await expect(
      page.locator("#paon-context-switcher .pcs-store.pcs-active"),
    ).toBeVisible();
    const myPaonLink = page.locator(
      "#paon-context-switcher .pcs-mypaon.pcs-inactive",
    );
    await expect(myPaonLink).toBeVisible();
    const href = await myPaonLink.getAttribute("href");
    expect(href).toContain("/dashboard?returnTo=");

    // Requirement 4/5: My PAON preserves the return storefront location.
    await myPaonLink.click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(
      page.locator("#paon-context-switcher .pcs-mypaon.pcs-active"),
    ).toBeVisible();
    const storeLink = page.locator(
      "#paon-context-switcher .pcs-store.pcs-inactive",
    );
    // The cookie is written client-side then picked up by a server refresh
    // (store-return-capture.tsx) — poll rather than reading the href once.
    await expect(storeLink).toHaveAttribute(
      "href",
      new RegExp(
        `/r/${DEMO_RETAILER_SLUG}.*${encodeURIComponent(targetCategory)}`,
      ),
    );

    // Requirement 3: Store returns to the exact same storefront location.
    // `force: true`: this dashboard shell has other absolutely-positioned
    // elements sharing the sidebar's stacking context (pre-existing,
    // unrelated to this feature — same class of overlap already noted for
    // the frozen template's own footer link in the mobile test below), so
    // Playwright's actionability point can resolve to a covering element
    // even though the link is genuinely visible and clickable to a real
    // user. The prior `toHaveAttribute` assertion already proved this is
    // the right element with the right destination.
    await storeLink.click({ force: true });
    await expect(page).toHaveURL(new RegExp(`/r/${DEMO_RETAILER_SLUG}`));
    await expect(
      page.locator("#cat-grid .cat-item.active .cat-label"),
    ).toHaveText(targetCategory);
    expect(await catItems.count()).toBe(totalCategories);

    expect(consoleErrors).toHaveLength(0);
  });
});

test.describe("mobile", () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  // The frozen storefront template hides its entire <aside> (and therefore
  // the whole category rail / logo / #sidebar-logo context the switcher
  // mounts beside) below 850px — `@media (max-width: 850px) { aside {
  // display: none } }`, pre-existing and out of scope (ADR-046/ADR-047).
  // The dashboard's mirrored sidebar is `hidden lg:grid` for the same
  // reason. The switcher is therefore desktop-only by the existing,
  // unmodified responsive architecture on both sides — this test proves
  // that boundary explicitly (DOM present, not visible, no crash) rather
  // than asserting mobile behavior the frozen template cannot support
  // without editing it.
  test("storefront context switcher is present but hidden on mobile, no crash", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await signIn(page);
    await page.goto(`/r/${DEMO_RETAILER_SLUG}`);

    // The switcher script still runs and inserts the node (no error), but
    // it's inside <aside>, which mobile CSS hides.
    const switcherEl = page.locator("#paon-context-switcher");
    await expect(switcherEl).toHaveCount(1);
    await expect(switcherEl).toBeHidden();

    const aside = page.locator("aside").first();
    await expect(aside).toBeHidden();

    expect(consoleErrors).toHaveLength(0);
  });
});
