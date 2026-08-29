import { createSupabaseAdminClient } from "@paon/database";
import { seedDemoData } from "@paon/database/demo-seed";
import { expect, test } from "@playwright/test";

import { writeBrowserProofRun } from "./write-browser-proof-run";

/**
 * Stage 21.6 — storefront -> dashboard boundary performance budget.
 *
 * This is the prefetch-warmed *document* navigation from the raw storefront
 * into the React dashboard shell. It is deliberately NOT held to the 200ms
 * customer-shell warm-nav budget (CUSTOMER_ENVIRONMENT_REBUILD_V3.md §13 /
 * PHASE 20.2) — it is a full page load, smoothed by the Stage 21.2 seam
 * (<link rel=prefetch as=document> + bfcache). The assertion here is a
 * regression ceiling, not an aspirational target; p50/p95 are recorded.
 */
const SAMPLES = 8;
const P95_CEILING_MS = 2000;
const PHASE_ITEM_ID = "21.6";
const BROWSER_PROOF_SPEC =
  "apps/customer/e2e/storefront-dashboard-boundary-perf.spec.ts";
let proofPassed = false;

test.afterAll(async () => {
  await writeBrowserProofRun({
    phaseItemId: PHASE_ITEM_ID,
    spec: BROWSER_PROOF_SPEC,
    status: proofPassed ? "passed" : "failed",
  });
});

test("storefront -> dashboard boundary hop stays within budget", async ({
  page,
}, testInfo) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const anonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error("Boundary perf test requires local Supabase variables.");
  }

  await seedDemoData({ supabaseUrl, anonKey, serviceRoleKey });
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
  const { data: link, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: "contact+isabelle@nebelspiegel.com",
  });
  if (error || !link.properties) throw error ?? new Error("magic link missing");
  await page.goto(
    `/auth/confirm?token_hash=${link.properties.hashed_token}&type=magiclink`,
  );
  await expect(page).toHaveURL(/\/dashboard$/);

  const measurements: number[] = [];
  for (let i = 0; i < SAMPLES; i += 1) {
    // Land on the storefront; its <head> emits <link rel=prefetch as=document
    // href="/dashboard">. Give the browser an idle beat to honour it.
    await page.goto("/r/atelier-demo?category=Suits", {
      waitUntil: "networkidle",
    });
    // The storefront <head> emits <link rel=prefetch as=document
    // href="/dashboard">; give the browser an idle beat to honour it before
    // the boundary hop.
    await page.waitForTimeout(500);

    const startedAt = Date.now();
    await page.goto("/dashboard", { waitUntil: "commit" });
    await page.locator("[data-customer-shell]").waitFor({ state: "visible" });
    measurements.push(Date.now() - startedAt);
  }

  const sorted = [...measurements].sort((a, b) => a - b);
  const p50 = sorted[Math.ceil(sorted.length * 0.5) - 1]!;
  const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1]!;

  await testInfo.attach("storefront-dashboard-boundary.json", {
    body: Buffer.from(
      JSON.stringify(
        {
          direction: "storefront->dashboard",
          prefetch: "link rel=prefetch as=document",
          samples: measurements,
          p50,
          p95,
          ceilingMs: P95_CEILING_MS,
          browser: "Chromium (Playwright devices['Desktop Chrome'])",
          viewport: "1280x720",
          network: "local loopback, Next.js production build (pnpm start)",
        },
        null,
        2,
      ),
    ),
    contentType: "application/json",
  });

  expect(p95).toBeLessThanOrEqual(P95_CEILING_MS);
  proofPassed = true;
});
