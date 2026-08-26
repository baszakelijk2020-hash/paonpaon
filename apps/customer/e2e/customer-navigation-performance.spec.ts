import { DEMO_PASSWORD, seedDemoData } from "@paon/database/demo-seed";
import { expect, test } from "@playwright/test";

const CUSTOMER_ROUTES = [
  ["/dashboard", "Overview"],
  ["/wardrobe", "Wardrobe"],
  ["/appointments", "My Appointments"],
  ["/orders", "Orders"],
  ["/digital-fitting-room", "Digital Fitting Room"],
  ["/loyalty", "Rewards & Referrals"],
  ["/account", "My Profile"],
] as const;

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
  await page.goto("/login?demo=1");
  await page.getByLabel("Demo email").fill("contact+isabelle@nebelspiegel.com");
  await page.getByLabel("Demo password").fill(DEMO_PASSWORD);
  await page
    .getByRole("button", { name: "Enter the private client demo" })
    .click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator("[data-customer-shell]")).toBeVisible();

  for (const [href, label] of CUSTOMER_ROUTES) {
    await expect(
      page.locator(`[data-customer-top-menu][href="${href}"]`),
    ).toHaveText(label);
  }

  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const shell = document.querySelector("[data-customer-shell]");
    if (!shell) throw new Error("customer shell is missing");
    (window as Window & { __paonCustomerShell?: Element }).__paonCustomerShell =
      shell;
  });

  let documentNavigations = 0;
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) documentNavigations += 1;
  });

  const measurements: Array<{ href: string; milliseconds: number }> = [];
  for (let index = 0; index < 21; index += 1) {
    const [href] = CUSTOMER_ROUTES[(index + 1) % CUSTOMER_ROUTES.length]!;
    const milliseconds = await page.evaluate(async (destination) => {
      const link = document.querySelector<HTMLAnchorElement>(
        `[data-customer-top-menu][href="${destination}"]`,
      );
      if (!link) throw new Error(`missing top-menu link for ${destination}`);

      return new Promise<number>((resolve) => {
        const startedAt = performance.now();
        const onVisible = (event: Event) => {
          const pathname = (event as CustomEvent<{ pathname?: string }>).detail
            ?.pathname;
          if (pathname !== destination) return;
          window.removeEventListener("paon:customer-route-visible", onVisible);
          resolve(performance.now() - startedAt);
        };
        window.addEventListener("paon:customer-route-visible", onVisible);
        link.click();
      });
    }, href);
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

  expect(documentNavigations).toBe(0);
  expect(p95).toBeLessThanOrEqual(200);
});
