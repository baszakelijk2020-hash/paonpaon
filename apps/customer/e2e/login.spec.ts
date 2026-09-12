import { DEMO_PASSWORD, seedDemoData } from "@paon/database/demo-seed";
import { expect, test } from "@playwright/test";

import { AUTH_DELIVERABLE_DOMAIN, TEST_CUSTOMER_EMAIL } from "./fixtures";

// Its own empty context. /dashboard deliberately offers a private-client
// preview before sign-in; the contract is that no private account data leaks
// and the guest gets an explicit sign-in path.
test.describe("unauthenticated", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("shows the guest client preview without private account data", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(
      page.getByRole("heading", {
        name: "Your wardrobe, beautifully in motion.",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("main").getByRole("link", {
        name: "Sign in",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByText(TEST_CUSTOMER_EMAIL)).toHaveCount(0);
  });
});

test.describe("unauthenticated dashboard shop shell", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("uses a 250px layout column instead of overlaying dashboard content", async ({
    page,
  }) => {
    await page.goto("/dashboard?from=%2Fr%2Fatelier-demo");

    const sidebar = page.locator("aside");
    const main = page.getByRole("main");
    await expect(sidebar).toBeVisible();
    await expect(sidebar).toHaveCSS("position", "sticky");
    await expect(sidebar.locator(":scope > div").last()).toHaveCSS(
      "height",
      "210px",
    );

    const [sidebarBox, mainBox, viewportWidth] = await Promise.all([
      sidebar.boundingBox(),
      main.boundingBox(),
      page.evaluate(() => window.innerWidth),
    ]);
    if (!sidebarBox || !mainBox) {
      throw new Error("expected the desktop sidebar and dashboard main region");
    }
    expect(sidebarBox.width).toBe(250);
    expect(mainBox.x).toBeGreaterThanOrEqual(250);
    expect(mainBox.x + mainBox.width).toBeLessThanOrEqual(viewportWidth);

    await expect(
      sidebar.getByRole("link", { name: "Jackets", exact: true }),
    ).toHaveAttribute("href", "/r/atelier-demo?category=Jackets");
  });

  test.describe("below the desktop sidebar breakpoint", () => {
    test.use({ viewport: { width: 1023, height: 800 } });

    test("does not reserve or overlay a hidden sidebar", async ({ page }) => {
      await page.goto("/dashboard?from=%2Fr%2Fatelier-demo");

      await expect(page.locator("aside")).toBeHidden();
      const mainBox = await page.getByRole("main").boundingBox();
      if (!mainBox) throw new Error("expected dashboard main region");
      expect(mainBox.x).toBe(0);
    });
  });
});

test("an unknown email presents only confirmation-code account creation", async ({
  page,
}) => {
  await page.goto("/login");
  await page
    .getByLabel("Email")
    .fill(`e2e-new-shopper-${Date.now()}@${AUTH_DELIVERABLE_DOMAIN}`);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("status")).toContainText(
    "6-digit confirmation code",
  );
  await expect(page.getByLabel("6-digit confirmation code")).toBeVisible();
  await expect(page.getByLabel("Password")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Send a new code" }),
  ).toBeVisible();
  expect(page.url()).not.toContain("e2e-new-shopper-");
});

test("a known email presents only password sign-in and retains a safe local URL", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const anonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error(
      "Known-email login test requires the local Supabase variables.",
    );
  }
  await seedDemoData({ supabaseUrl, anonKey, serviceRoleKey });

  await page.goto("/login?redirectTo=%2Fdashboard");
  await page.getByLabel("Email").fill("contact+bas@nebelspiegel.com");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("status")).toContainText("Enter your password");
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByLabel("6-digit confirmation code")).toHaveCount(0);
  expect(page.url()).not.toContain("contact%2Bbas");
});

test("email recognition rejects an external redirect before branching", async ({
  page,
}) => {
  await page.goto("/login?redirectTo=%2F%2Fevil.example");
  await page
    .getByLabel("Email")
    .fill(`safe-${Date.now()}@${AUTH_DELIVERABLE_DOMAIN}`);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(
    page.getByText("Enter a valid email address and password."),
  ).toHaveCount(0);
  await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  await expect(page).toHaveURL(/\/login\?redirectTo=%2F%2Fevil\.example$/);
});

test("a seeded private-client persona has deterministic demo access", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const anonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error("Demo login test requires the local Supabase variables.");
  }
  await seedDemoData({ supabaseUrl, anonKey, serviceRoleKey });

  await page.goto("/login?demo=1");
  await page.getByLabel("Demo email").fill("contact+bas@nebelspiegel.com");
  await page.getByLabel("Demo password").fill(DEMO_PASSWORD);
  await page
    .getByRole("button", { name: "Enter the private client demo" })
    .click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByText("Nebel & Spiegel", { exact: true }),
  ).toBeVisible();
  // Nebel & Spiegel has real catalogue products, so the dashboard's
  // MorningRoutine hero replaces the generic "beautifully in motion"
  // banner with today's actual composed-look pick — proving the demo
  // persona reaches a real, data-backed dashboard, not just a static shell.
  await expect(
    page.getByText(/today calls for something special/),
  ).toBeVisible();
});
