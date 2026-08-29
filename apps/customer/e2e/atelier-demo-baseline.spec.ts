import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { seedDemoData } from "@paon/database/demo-seed";
import { chromium, expect, test } from "@playwright/test";

import { writeBrowserProofRun } from "./write-browser-proof-run";

/**
 * PHASE 20.3 — immutable Atelier Demo storefront baseline.
 *
 * Read-only capture. Never edits storefront source. Produces the versioned
 * desktop + mobile screenshot / timing / URL / DPR / viewport baseline the
 * shared-shell storefront port must match at every parity checkpoint
 * (CUSTOMER_ENVIRONMENT_REBUILD_V3.md §3.2). Re-running overwrites the same
 * files so the baseline stays reproducible from source.
 */

const SLUG = "atelier-demo";
const PHASE_ITEM_ID = "20.3";
const BROWSER_PROOF_SPEC = "apps/customer/e2e/atelier-demo-baseline.spec.ts";
let passedCaptures = 0;
// Playwright runs with cwd = apps/customer
const OUT = path.resolve(
  process.cwd(),
  "../../docs/evidence/atelier-demo-baseline/v1-2026-08-26/screenshots",
);

const DESKTOP = { width: 1440, height: 900, dpr: 2 };
const MOBILE = { width: 390, height: 844, dpr: 3 };

const capture: {
  capturedAt: string;
  baseUrl: string;
  slug: string;
  desktop: typeof DESKTOP;
  mobile: typeof MOBILE;
  shots: Array<{ name: string; url: string; viewport: "desktop" | "mobile" }>;
  timingsMs: Record<string, number>;
} = {
  capturedAt: new Date().toISOString(),
  baseUrl: "http://localhost:3002",
  slug: SLUG,
  desktop: DESKTOP,
  mobile: MOBILE,
  shots: [],
  timingsMs: {},
};

test.beforeAll(async () => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const anonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error("Atelier Demo baseline requires local Supabase variables.");
  }
  await seedDemoData({ supabaseUrl, anonKey, serviceRoleKey });
  mkdirSync(OUT, { recursive: true });
});

test.afterAll(async () => {
  await writeBrowserProofRun({
    phaseItemId: PHASE_ITEM_ID,
    spec: BROWSER_PROOF_SPEC,
    status: passedCaptures === 2 ? "passed" : "failed",
  });
});

test("Atelier Demo desktop baseline", async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: DESKTOP.width, height: DESKTOP.height },
    deviceScaleFactor: DESKTOP.dpr,
  });
  const page = await context.newPage();

  const shot = async (name: string, url: string, fullPage = true) => {
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    await page.screenshot({
      path: path.join(OUT, `${name}--desktop.png`),
      fullPage,
    });
    capture.shots.push({ name, url, viewport: "desktop" });
  };

  await shot("01-home-gate", `/r/${SLUG}`);
  await shot("02-home-grid-suits", `/r/${SLUG}?category=Suits`);
  await shot("03-home-grid-jackets", `/r/${SLUG}?category=Jackets`);
  await shot("04-appointments", `/r/${SLUG}/appointments`);
  await shot("05-locations", `/r/${SLUG}/locations`);
  await shot("06-swipe", `/r/${SLUG}/swipe`);
  await shot("07-configurator", `/r/${SLUG}/configurator`);

  // click-to-visible timing: category switch on the grid page
  await page.goto(`/r/${SLUG}?category=Suits`, { waitUntil: "networkidle" });
  const started = Date.now();
  const link = page.locator('a[href*="category=Pants"]').first();
  if (await link.count()) {
    await link.click();
    await page.waitForLoadState("networkidle");
    capture.timingsMs["category-switch-suits-to-pants"] = Date.now() - started;
  }

  await context.close();
  await browser.close();
  expect(
    capture.shots.filter((s) => s.viewport === "desktop").length,
  ).toBeGreaterThanOrEqual(7);
  passedCaptures += 1;
});

test("Atelier Demo mobile baseline", async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: MOBILE.width, height: MOBILE.height },
    deviceScaleFactor: MOBILE.dpr,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  const shot = async (name: string, url: string) => {
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    await page.screenshot({
      path: path.join(OUT, `${name}--mobile.png`),
      fullPage: true,
    });
    capture.shots.push({ name, url, viewport: "mobile" });
  };

  await shot("01-home-gate", `/r/${SLUG}`);
  await shot("02-home-grid-suits", `/r/${SLUG}?category=Suits`);
  await shot("03-home-grid-jackets", `/r/${SLUG}?category=Jackets`);
  await shot("04-appointments", `/r/${SLUG}/appointments`);
  await shot("05-locations", `/r/${SLUG}/locations`);
  await shot("06-swipe", `/r/${SLUG}/swipe`);
  await shot("07-configurator", `/r/${SLUG}/configurator`);

  await context.close();
  await browser.close();

  writeFileSync(
    path.join(OUT, "..", "capture.json"),
    `${JSON.stringify(capture, null, 2)}\n`,
  );
  expect(
    capture.shots.filter((s) => s.viewport === "mobile").length,
  ).toBeGreaterThanOrEqual(7);
  passedCaptures += 1;
});
