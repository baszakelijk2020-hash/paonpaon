import { createSupabaseAdminClient } from "@paon/database";
import { seedDemoData } from "@paon/database/demo-seed";
import { expect, test } from "@playwright/test";

import { writeBrowserProofRun } from "./write-browser-proof-run";

const CUSTOMER_ROUTES = [
  ["/dashboard", "Overview"],
  ["/wardrobe", "Wardrobe"],
  ["/appointments", "My Appointments"],
  ["/orders", "Orders"],
  ["/digital-fitting-room", "Digital Fitting Room"],
  ["/loyalty", "Rewards & Referrals"],
  ["/account", "My Profile"],
] as const;

const PHASE_ITEM_ID = "20.2";
const BROWSER_PROOF_SPEC =
  "apps/customer/e2e/customer-navigation-performance.spec.ts";
let proofPassed = false;

test.afterAll(async () => {
  await writeBrowserProofRun({
    phaseItemId: PHASE_ITEM_ID,
    spec: BROWSER_PROOF_SPEC,
    status: proofPassed ? "passed" : "failed",
  });
});

test("customer top-menu warm navigation stays under 200ms p95", async ({
  page,
}, testInfo) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const anonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error(
      "Customer navigation test requires local Supabase variables.",
    );
  }

  await seedDemoData({ supabaseUrl, anonKey, serviceRoleKey });
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: "contact+isabelle@nebelspiegel.com",
  });
  if (error || !data.properties) {
    throw error ?? new Error("Customer magic link is missing");
  }
  await page.goto(
    `/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`,
  );
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator("[data-customer-shell]")).toBeVisible();

  const consoleErrors: string[] = [];
  const failedResponses: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      failedResponses.push(`${response.status()} ${response.url()}`);
    }
  });

  for (const [href, label] of CUSTOMER_ROUTES) {
    await expect(
      page.locator(`[data-customer-top-menu][href="${href}"]`),
    ).toHaveText(label);
  }

  // Mounted full-prefetch menu Links warm every RSC route immediately after
  // login. Measure only after that post-login warm-up has had time to settle.
  await page.waitForTimeout(8_000);
  await page.evaluate(() => {
    const shell = document.querySelector("[data-customer-shell]");
    if (!shell) throw new Error("customer shell is missing");
    (window as Window & { __paonCustomerShell?: Element }).__paonCustomerShell =
      shell;
  });

  let documentRequests = 0;
  page.on("request", (request) => {
    if (
      request.isNavigationRequest() &&
      request.resourceType() === "document"
    ) {
      documentRequests += 1;
    }
  });

  const measurements: Array<{ href: string; milliseconds: number }> = [];
  for (let index = 0; index < 21; index += 1) {
    const [href] = CUSTOMER_ROUTES[(index + 1) % CUSTOMER_ROUTES.length]!;
    await page.evaluate((destination) => {
      const startedAt = performance.now();
      (
        window as Window & { __paonNavigationTiming?: Promise<number> }
      ).__paonNavigationTiming = new Promise<number>((resolve) => {
        const onVisible = (event: Event) => {
          const pathname = (event as CustomEvent<{ pathname?: string }>).detail
            ?.pathname;
          if (pathname !== destination) return;
          window.removeEventListener("paon:customer-route-visible", onVisible);
          resolve(performance.now() - startedAt);
        };
        window.addEventListener("paon:customer-route-visible", onVisible);
      });
    }, href);
    await page.locator(`[data-customer-top-menu][href="${href}"]`).click();
    const milliseconds = await page.evaluate(
      async () =>
        await (window as Window & { __paonNavigationTiming?: Promise<number> })
          .__paonNavigationTiming,
    );
    if (milliseconds === undefined) {
      throw new Error(
        `customer navigation timing is missing for ${href}; browser errors: ${JSON.stringify(consoleErrors)}; failed responses: ${JSON.stringify(failedResponses)}`,
      );
    }
    measurements.push({ href, milliseconds });

    await expect(page).toHaveURL(new RegExp(`${href.replace("/", "\\/")}$`));
    await expect(
      page.locator("[data-customer-navigation-ready]"),
    ).toHaveAttribute("data-customer-navigation-ready", href);
    expect(
      await page.evaluate(
        () =>
          document.querySelector("[data-customer-shell]") ===
          (window as Window & { __paonCustomerShell?: Element })
            .__paonCustomerShell,
      ),
    ).toBe(true);
  }

  const sorted = measurements
    .map(({ milliseconds }) => milliseconds)
    .sort((a, b) => a - b);
  const p50 = sorted[Math.ceil(sorted.length * 0.5) - 1]!;
  const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1]!;
  await testInfo.attach("customer-warm-menu-measurements.json", {
    body: Buffer.from(JSON.stringify({ measurements, p50, p95 }, null, 2)),
    contentType: "application/json",
  });

  expect(documentRequests).toBe(0);
  expect(consoleErrors).toEqual([]);
  expect(failedResponses).toEqual([]);
  expect(p95).toBeLessThanOrEqual(200);
  proofPassed = true;
});
