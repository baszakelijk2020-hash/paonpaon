import { expect, test } from "@playwright/test";

const CUSTOMER_EMAIL = "contact+isabelle@nebelspiegel.com";

function demoLoginUrl(redirectTo: string): string {
  return `/login?demo=1&email=${encodeURIComponent(CUSTOMER_EMAIL)}&redirectTo=${encodeURIComponent(redirectTo)}`;
}

declare global {
  interface Window {
    __paonSyntheticLifecycle?: string[];
  }
}

/**
 * The storefront is injected straight into <body>, and its scripts expect the
 * page lifecycle a raw document gives them — so the host re-fires
 * `DOMContentLoaded` for them.
 *
 * Next.js closes its RSC stream writer on that event
 * (next/dist/client/app-index.js), so firing it while the App Router payload
 * was still arriving cut the stream off mid-flight: every remaining
 * `self.__next_f.push` chunk threw "Unexpected server data: missing bootstrap
 * script", and the rest of the page — the shared sidebar and the customer
 * environment among it — never rendered.
 */
test("the storefront's synthetic lifecycle never runs while the document is parsing", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1512, height: 982 });

  await page.addInitScript(() => {
    window.__paonSyntheticLifecycle = [];
    const dispatch = Document.prototype.dispatchEvent;
    // Only script-dispatched events come through here; the browser's own
    // DOMContentLoaded does not. So everything recorded is synthetic.
    Document.prototype.dispatchEvent = function (event: Event): boolean {
      if (event.type === "DOMContentLoaded") {
        window.__paonSyntheticLifecycle?.push(document.readyState);
      }
      return dispatch.call(this, event);
    };
  });

  /*
   * Answer the storefront's payload instantly, so its build lands in the
   * middle of the document still being parsed. That is the race the fix is
   * about; against a warm server the real payload is usually just slow enough
   * to hide it. The body is a stub because nothing here is about the template
   * itself — only about when the host is allowed to touch the document.
   */
  await page.route("**/template-payload*", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        bodyHtml: '<div id="paon-stub-storefront"></div>',
        externalScripts: [],
        inlineScripts: [],
      }),
    }),
  );
  await page.route("**/template-styles*", (route) =>
    route.fulfill({ contentType: "text/css", body: "" }),
  );

  const streamErrors: string[] = [];
  page.on("pageerror", (error) => {
    if (
      /missing bootstrap script|unexpectedly closed|Connection closed/i.test(
        error.message,
      )
    ) {
      streamErrors.push(error.message);
    }
  });

  await page.goto(demoLoginUrl("/dashboard"));
  await page.getByRole("button", { name: /Customer — / }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  // A real document load, not the client-side hop the sign-in above made:
  // there is no RSC bootstrap stream to break unless the page is streamed.
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-paon-storefront-root]")).toHaveCount(1);

  // The host re-fires the lifecycle once the storefront's scripts are in, and
  // it must never do so before the document itself has finished parsing.
  await expect
    .poll(() => page.evaluate(() => window.__paonSyntheticLifecycle ?? []))
    .not.toEqual([]);
  const states = await page.evaluate(
    () => window.__paonSyntheticLifecycle ?? [],
  );
  expect(states).not.toContain("loading");

  // Everything the shell streams after that content must still have arrived.
  await expect(page.locator("[data-paon-shell-sidebar]")).toHaveCount(1);
  await expect(page.locator("[data-paon-customer-layer]")).toHaveCount(1);
  await expect(page.locator("#paon-context-switcher")).toBeVisible();
  expect(streamErrors).toEqual([]);
});

/**
 * Building the storefront is claimed once per document and must not be
 * abortable. Signing in reaches the shell by client-side navigation rather
 * than a document load, and the effect teardown that comes with it used to
 * cancel the build *after* the claim had been taken — leaving the session with
 * no store at all behind the customer environment, and no way to build one.
 */
test("signing in straight into the store still builds the storefront", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1512, height: 982 });

  await page.goto(demoLoginUrl("/r/atelier-demo"));
  await page.getByRole("button", { name: /Customer — / }).click();
  await expect(page).toHaveURL(/\/r\/atelier-demo$/);

  await expect(page.locator("[data-paon-storefront-root]")).toHaveCount(1, {
    timeout: 15_000,
  });
  await expect(
    page.locator("#product-grid, #view-home").first(),
  ).toBeAttached();
  await expect(page.locator("[data-paon-shell-sidebar]")).toHaveCount(1);
  await expect(page.locator("[data-paon-customer-layer]")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
});

/**
 * Every transition in the founder's storefront is a class on <body> read by a
 * rule written as `body.<state> …`. The template's stylesheet is scoped to the
 * template root now so it cannot restyle the customer environment, and that
 * scoping rewrites those selectors — while the scripts kept writing to <body>.
 * Opening a product set `--paon-entry-x` and `--paon-entry-opacity` on every
 * frame with nothing reading them: the detail view appeared with no blur, no
 * fade and no motion.
 */
test("opening a product still plays the storefront's own entry", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto("/r/atelier-demo?category=Suits", {
    waitUntil: "domcontentloaded",
  });

  const root = page.locator("[data-paon-storefront-root]");
  await expect(root).toHaveCount(1);
  await expect(page.locator("#product-grid .grid-card").first()).toBeAttached();

  const entry = await page.evaluate(async () => {
    const template = document.querySelector<HTMLElement>(
      "[data-paon-storefront-root]",
    )!;
    const detailMain = template.querySelector<HTMLElement>("#detail-main")!;
    const seen: { opacity: number; x: string }[] = [];
    let stop = false;
    const sample = () => {
      const style = getComputedStyle(detailMain);
      seen.push({ opacity: Number(style.opacity), x: style.transform });
      if (!stop) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
    template.querySelector<HTMLElement>("#product-grid .grid-card")!.click();
    await new Promise((resolve) => setTimeout(resolve, 900));
    stop = true;
    return {
      // The state class has to reach the root, or none of the scoped rules fire.
      rootCarriesState: template.classList.contains("product-detail-open"),
      startedTransparent: seen.some((frame) => frame.opacity < 0.2),
      startedOffset: seen.some(
        (frame) => frame.x !== "none" && !frame.x.endsWith("0, 0)"),
      ),
      endedOpaque: seen[seen.length - 1]?.opacity === 1,
    };
  });

  expect(entry).toEqual({
    rootCarriesState: true,
    startedTransparent: true,
    startedOffset: true,
    endedOpaque: true,
  });
});
