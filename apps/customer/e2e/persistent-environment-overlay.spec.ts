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
    waitUntil: "networkidle",
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
      document.querySelector<HTMLElement>("[data-paon-customer-blur-veil]"),
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
    const initial = getComputedStyle(layer).transform;
    const startedAt = performance.now();
    button.click();
    while (getComputedStyle(layer).transform === initial) {
      if (performance.now() - startedAt > 100) return 101;
      await new Promise(requestAnimationFrame);
    }
    return performance.now() - startedAt;
  });
  expect(showStartMs).toBeLessThan(100);
  await expect(customerLayer).toHaveAttribute("aria-hidden", "false");
  await expect
    .poll(() =>
      customerLayer.evaluate((element) => getComputedStyle(element).transform),
    )
    .toMatch(/matrix(3d)?\(/);

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
      willChange: getComputedStyle(layer).willChange,
      veilWillChange: getComputedStyle(
        document.querySelector<HTMLElement>("[data-paon-customer-blur-veil]")!,
      ).willChange,
    };
  });
  expect(geometry.customerLeft).toBe(geometry.sidebarRight);
  expect(geometry.willChange).toContain("transform");
  expect(geometry.willChange).toContain("opacity");
  expect(geometry.veilWillChange).toContain("opacity");

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
    mutations: ["opacity", "transform"],
  });
});
