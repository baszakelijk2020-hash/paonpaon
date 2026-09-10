import { createSupabaseAdminClient } from "@paon/database";
import { expect, test, type Page } from "@playwright/test";

const CUSTOMER_EMAIL = "contact+isabelle@nebelspiegel.com";

async function signIn(page: Page): Promise<void> {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Persistent overlay proof requires local Supabase variables.",
    );
  }
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: CUSTOMER_EMAIL,
  });
  if (error || !data.properties) {
    throw error ?? new Error("Customer magic link is missing");
  }
  await page.goto(
    `/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`,
  );
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("customer layer toggles without navigation or storefront state loss", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await signIn(page);
  await page.goto("/r/atelier-demo?category=Pants", {
    waitUntil: "domcontentloaded",
  });

  const storefront = page.locator("[data-paon-storefront-root]");
  const customerLayer = page.locator("[data-paon-customer-layer]");
  const customerShell = page.locator("[data-customer-shell]");
  await expect(storefront).toHaveCount(1);
  await expect(customerLayer).toHaveAttribute("aria-hidden", "true");
  await expect(customerShell).toHaveCount(1);
  await expect(page.locator("#product-grid .grid-card").first()).toBeAttached();

  await page.evaluate(() => {
    const main = document.querySelector<HTMLElement>(
      ".paon-template-root main",
    );
    if (main)
      main.scrollTop = Math.min(240, main.scrollHeight - main.clientHeight);
    const w = window as Window & {
      __persistentOverlayPins?: Record<string, unknown>;
      __persistentOverlayMutations?: string[];
    };
    w.__persistentOverlayPins = {
      document,
      storefront: document.querySelector("[data-paon-storefront-root]"),
      main,
      product: document.querySelector("#product-grid .grid-card"),
      customerLayer: document.querySelector("[data-paon-customer-layer]"),
      customerShell: document.querySelector("[data-customer-shell]"),
      activeCategory: document.querySelector("#cat-grid .cat-item.active")
        ?.textContent,
      scrollTop: main?.scrollTop ?? 0,
      filters: Array.from(
        document.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
          ".filters-bar input, .filters-bar select",
        ),
      ).map((control) => control.value),
    };
    w.__persistentOverlayMutations = [];
    for (const element of [
      document.querySelector<HTMLElement>("[data-paon-customer-layer]"),
    ]) {
      if (!element) continue;
      let previous = new Map(
        Array.from(element.style).map((property) => [
          property,
          element.style.getPropertyValue(property),
        ]),
      );
      new MutationObserver(() => {
        const next = new Map(
          Array.from(element.style).map((property) => [
            property,
            element.style.getPropertyValue(property),
          ]),
        );
        for (const property of new Set([...previous.keys(), ...next.keys()])) {
          if (previous.get(property) !== next.get(property)) {
            w.__persistentOverlayMutations?.push(property);
          }
        }
        previous = next;
      }).observe(element, { attributes: true, attributeFilter: ["style"] });
    }
  });

  // The always-mounted customer child eagerly warms its tab routes. Finish
  // that deliberate background work before measuring the environment toggle.
  await page.waitForTimeout(8_000);

  let navigationRequests = 0;
  let rscRequests = 0;
  page.on("request", (request) => {
    if (request.isNavigationRequest()) navigationRequests += 1;
    if (request.url().includes("_rsc=")) rscRequests += 1;
  });

  const showStartMs = await page.evaluate(async () => {
    const layer = document.querySelector<HTMLElement>(
      "[data-paon-customer-layer]",
    );
    const button = document.querySelector<HTMLButtonElement>(
      "#paon-context-switcher .pcs-mypaon",
    );
    if (!layer || !button) throw new Error("overlay controls are missing");
    const initialOpacity = getComputedStyle(layer).opacity;
    const startedAt = performance.now();
    button.click();
    while (getComputedStyle(layer).opacity === initialOpacity) {
      if (performance.now() - startedAt > 100) return 101;
      await new Promise(requestAnimationFrame);
    }
    return performance.now() - startedAt;
  });
  expect(showStartMs).toBeLessThan(100);
  await expect(customerLayer).toHaveAttribute("aria-hidden", "false");
  await expect
    .poll(async () => {
      const [customerLeft, sidebarRight] = await Promise.all([
        customerLayer.evaluate(
          (element) => element.getBoundingClientRect().left,
        ),
        page
          .locator("[data-paon-shell-sidebar]")
          .evaluate((element) => element.getBoundingClientRect().right),
      ]);
      return Math.abs(customerLeft - sidebarRight);
    })
    .toBeLessThan(0.01);

  const geometry = await page.evaluate(() => {
    const layer = document.querySelector<HTMLElement>(
      "[data-paon-customer-layer]",
    );
    const sidebar = document.querySelector<HTMLElement>(
      "[data-paon-shell-sidebar]",
    );
    if (!layer || !sidebar) throw new Error("overlay geometry is missing");
    return {
      customerLeft: layer.getBoundingClientRect().left,
      sidebarRight: sidebar.getBoundingClientRect().right,
      opacity: getComputedStyle(layer).opacity,
      filter: getComputedStyle(layer).filter,
    };
  });
  expect(Math.abs(geometry.customerLeft - geometry.sidebarRight)).toBeLessThan(
    0.01,
  );
  // Settled at the near end: fully opaque and sharp, whatever the entry did.
  expect(geometry.opacity).toBe("1");
  expect(geometry.filter).toBe("blur(0px)");

  await page.locator("#paon-context-switcher .pcs-store").click();
  await expect(customerLayer).toHaveAttribute("aria-hidden", "true");
  await page.waitForTimeout(420);

  const preserved = await page.evaluate(() => {
    const w = window as Window & {
      __persistentOverlayPins?: Record<string, unknown>;
      __persistentOverlayMutations?: string[];
    };
    const pins = w.__persistentOverlayPins;
    const main = document.querySelector<HTMLElement>(
      ".paon-template-root main",
    );
    return {
      sameDocument: pins?.["document"] === document,
      sameStorefront:
        pins?.["storefront"] ===
        document.querySelector("[data-paon-storefront-root]"),
      sameMain: pins?.["main"] === main,
      sameProduct:
        pins?.["product"] ===
        document.querySelector("#product-grid .grid-card"),
      sameCustomerLayer:
        pins?.["customerLayer"] ===
        document.querySelector("[data-paon-customer-layer]"),
      sameCustomerShell:
        pins?.["customerShell"] ===
        document.querySelector("[data-customer-shell]"),
      activeCategory:
        pins?.["activeCategory"] ===
        document.querySelector("#cat-grid .cat-item.active")?.textContent,
      scrollTop: pins?.["scrollTop"] === (main?.scrollTop ?? 0),
      filters:
        JSON.stringify(pins?.["filters"]) ===
        JSON.stringify(
          Array.from(
            document.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
              ".filters-bar input, .filters-bar select",
            ),
          ).map((control) => control.value),
        ),
      mutations: [...new Set(w.__persistentOverlayMutations ?? [])].sort(),
    };
  });

  expect(page.url()).toMatch(/\/r\/atelier-demo\?category=Pants$/);
  expect(navigationRequests).toBe(0);
  expect(rscRequests).toBe(0);
  /*
   * The panel travels horizontally from zero to full opacity while staying
   * level. The switch stays on the compositor: not one property it writes may
   * reach layout.
   */
  const LAYOUT_PROPERTIES = [
    "width",
    "height",
    "left",
    "right",
    "top",
    "bottom",
    "margin",
    "padding",
    "inset",
    "display",
  ];
  for (const property of preserved.mutations) {
    expect(
      LAYOUT_PROPERTIES.some((layout) => property.startsWith(layout)),
      `the switch wrote the layout property "${property}"`,
    ).toBe(false);
  }

  expect(preserved).toMatchObject({
    sameDocument: true,
    sameStorefront: true,
    sameMain: true,
    sameProduct: true,
    sameCustomerLayer: true,
    sameCustomerShell: true,
    activeCategory: true,
    scrollTop: true,
    filters: true,
  });

  await page.evaluate(() => {
    const showHome = (window as Window & { showHome?: () => void }).showHome;
    if (!showHome) throw new Error("storefront home control is missing");
    showHome();
  });
  await expect(page.locator("#view-home")).toHaveClass(/visible/);
  await expect
    .poll(() =>
      page
        .locator("#view-home")
        .evaluate((element) => getComputedStyle(element).paddingLeft),
    )
    .toBe("0px");
});

test("store categories and customer tabs paint immediate feedback", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await signIn(page);

  const wardrobeTab = page.locator(
    '[data-customer-top-menu][data-customer-tab-href="/wardrobe"]',
  );
  await expect(wardrobeTab).toBeVisible();
  const tabFeedback = await wardrobeTab.evaluate((tab) => {
    const startedAt = performance.now();
    tab.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, button: 0 }),
    );
    return {
      elapsedMs: performance.now() - startedAt,
      active: (tab as HTMLElement).dataset["optimisticActive"],
      background: getComputedStyle(tab).backgroundColor,
    };
  });
  expect(tabFeedback.elapsedMs).toBeLessThan(20);
  expect(tabFeedback.active).toBe("true");
  expect(tabFeedback.background).not.toBe("rgba(0, 0, 0, 0)");

  await page.goto("/r/atelier-demo?category=Pants", {
    waitUntil: "domcontentloaded",
  });
  const jacketControl = page.locator(
    '[data-storefront-category-control][href*="category=Jackets"]',
  );
  await expect(jacketControl).toBeVisible();
  await expect(page.locator("#product-grid .grid-card").first()).toBeAttached();

  let navigationRequests = 0;
  let rscRequests = 0;
  page.on("request", (request) => {
    if (request.isNavigationRequest()) navigationRequests += 1;
    if (request.url().includes("_rsc=")) rscRequests += 1;
  });

  const categoryFeedback = await jacketControl.evaluate((control) => {
    const startedAt = performance.now();
    control.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, button: 0 }),
    );
    return {
      elapsedMs: performance.now() - startedAt,
      active: (control as HTMLElement).dataset["active"],
      opacity: getComputedStyle(control).opacity,
    };
  });
  expect(categoryFeedback.elapsedMs).toBeLessThan(20);
  expect(categoryFeedback.active).toBe("true");
  expect(categoryFeedback.opacity).toBe("1");
  await expect(page).toHaveURL(/\/r\/atelier-demo\?category=Jackets$/);
  await page.waitForTimeout(100);
  expect(navigationRequests).toBe(0);
  expect(rscRequests).toBe(0);

  const customerLayer = page.locator("[data-paon-customer-layer]");
  const switcherPill = page.locator("[data-paon-switcher-pill]");
  await expect(switcherPill).toBeVisible();
  // The switch uses the jacket-detail power slide and opacity reveal.
  await page.locator("#paon-context-switcher .pcs-mypaon").click();
  await expect(customerLayer).toHaveCSS("opacity", "1");
  await expect(customerLayer).toHaveCSS("filter", "blur(0px)");
  await page.locator("#paon-context-switcher .pcs-store").click();
  await expect(customerLayer).toHaveCSS("opacity", "0");
  await expect(customerLayer).toHaveAttribute("aria-hidden", "true");
});
