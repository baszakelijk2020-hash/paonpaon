/**
 * Proves the shared sidebar is one persistent instance across the
 * customer environment <-> storefront boundary.
 *
 * Method: stamp the live <aside> DOM node with an expando that only exists on
 * that exact node, navigate by clicking the real in-page link (not page.goto,
 * which is always a full document load), then read the expando back. A React
 * remount, or any full page load, replaces the node and loses the stamp.
 *
 * Usage: node scripts/shell-persistence-check.mjs [--port 3117] [--slug atelier-demo]
 */
import { chromium } from "playwright";

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
const PORT = argValue("port", "3117");
const SLUG = argValue("slug", "atelier-demo");
const BASE = `http://localhost:${PORT}`;

const SHELL_ASIDE = "[data-paon-shell-sidebar] aside";

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });

/** Marks the shell sidebar node, and records that a full load would clear. */
async function stamp(token) {
  return page.evaluate(
    ([sel, tok]) => {
      const el = document.querySelector(sel);
      if (!el) return `NO SIDEBAR (${sel})`;
      el.__paonPersistToken = tok;
      window.__paonLoadToken = tok;
      return "stamped";
    },
    [SHELL_ASIDE, token],
  );
}

async function readStamp(token) {
  return page.evaluate(
    ([sel, tok]) => {
      const el = document.querySelector(sel);
      if (!el) return { node: "MISSING", doc: false };
      return {
        node: el.__paonPersistToken === tok ? "SAME NODE" : "REMOUNTED",
        doc: window.__paonLoadToken === tok,
      };
    },
    [SHELL_ASIDE, token],
  );
}

/** Clicks a link and waits for the URL to actually change. */
async function clickTo(selector, expectFragment) {
  const before = page.url();
  await page.click(selector);
  await page
    .waitForFunction(
      ([b, f]) => location.href !== b && location.href.includes(f),
      [before, expectFragment],
      { timeout: 20000 },
    )
    .catch(() => {});
  await page.waitForTimeout(2500);
  return page.url();
}

const results = [];

// Customer environment -> storefront.
await page.goto(`${BASE}/dashboard`, { waitUntil: "load", timeout: 120000 });
await page.waitForTimeout(3000);
console.log("start:", page.url(), "-", await stamp("A"));

const storeLink = `${SHELL_ASIDE} a[href^="/r/${SLUG}"]`;
const hasStoreLink = await page.locator(storeLink).first().count();
if (!hasStoreLink) {
  console.log(`no store link matching ${storeLink}`);
} else {
  const url = await clickTo(`${storeLink} >> nth=0`, `/r/${SLUG}`);
  const r = await readStamp("A");
  results.push(["dashboard -> storefront", url, r]);
  console.log(
    `dashboard -> storefront  ${url}\n  sidebar node: ${r.node}   document preserved: ${r.doc}`,
  );
}

// Storefront -> customer environment, continuing with the same stamp.
// Must be :visible — the storefront template keeps its own "My PAON" anchor
// in the markup inside the hidden <aside> it still renders for layout, and
// that one now comes first in document order.
const backLink = `a[href^="/dashboard"]:visible`;
const hasBack = await page.locator(backLink).first().count();
if (!hasBack) {
  console.log(`no /dashboard link found on the storefront`);
} else {
  const url = await clickTo(`${backLink} >> nth=0`, "/dashboard");
  const r = await readStamp("A");
  results.push(["storefront -> dashboard", url, r]);
  console.log(
    `storefront -> dashboard  ${url}\n  sidebar node: ${r.node}   document preserved: ${r.doc}`,
  );
}

await browser.close();

const allSame =
  results.length > 0 && results.every(([, , r]) => r.node === "SAME NODE");
console.log(`\n${allSame ? "PASS" : "FAIL"} — sidebar persistence`);
process.exit(allSame ? 0 : 1);
