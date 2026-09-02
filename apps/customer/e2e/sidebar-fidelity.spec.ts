import { expect, test } from "@playwright/test";

const DESKTOP_VIEWPORT = { width: 1280, height: 720 };

test.describe("customer dashboard sidebar fidelity", () => {
  test.use({ viewport: DESKTOP_VIEWPORT });

  test("keeps storefront logo and Home links stable while scrolling", async ({
    page,
  }) => {
    await page.goto("/dashboard?from=%2Fr%2Fatelier-demo");

    const sidebar = page.locator("aside").first();
    const logo = sidebar.locator(":scope > a").first();
    const home = sidebar.getByRole("link", { name: "Home", exact: true });

    await expect(logo).toHaveAttribute("href", "/r/atelier-demo");
    await expect(home).toHaveAttribute("href", "/r/atelier-demo");
    await expect(sidebar).toHaveCSS("position", "sticky");
    await expect(sidebar).toHaveCSS("transform", "none");

    const before = await logo.boundingBox();
    await page.evaluate(() => window.scrollTo(0, 500));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(500);
    const after = await logo.boundingBox();

    expect(before?.y).toBe(0);
    expect(after?.y).toBe(0);
    await expect(sidebar).toHaveCSS("transform", "none");
  });
});
