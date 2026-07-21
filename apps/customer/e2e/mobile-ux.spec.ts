import { createSupabaseAdminClient } from "@paon/database";
import { expect, test, type Page } from "@playwright/test";

import {
  TEST_CUSTOMER_EMAIL,
  TEST_PRODUCT_SLUG,
  TEST_RETAILER_SLUG,
} from "./fixtures";

const MOBILE_VIEWPORT = { width: 390, height: 844 }; // iPhone 12-class
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };
const MIN_TAP_TARGET = 44;

async function signIn(page: Page) {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: TEST_CUSTOMER_EMAIL,
  });
  if (error || !data.properties) {
    throw new Error(
      `Failed to generate magic link: ${error?.message ?? "unknown error"}`,
    );
  }
  await page.goto(
    `/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`,
  );
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe("mobile bottom navigation", () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test("shows a pinned bottom tab bar with 44px+ tap targets, replacing the desktop top nav", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/dashboard");

    const bottomNav = page.getByRole("navigation", {
      name: "Primary (mobile)",
    });
    await expect(bottomNav).toBeVisible();
    const box = await bottomNav.boundingBox();
    expect(box).not.toBeNull();
    // Pinned to the bottom of the viewport.
    expect(box!.y + box!.height).toBeGreaterThanOrEqual(
      MOBILE_VIEWPORT.height - 2,
    );

    for (const label of ["Orders", "Appointments", "Messages", "Account"]) {
      const link = bottomNav.getByRole("link", { name: label, exact: true });
      await expect(link).toBeVisible();
      const linkBox = await link.boundingBox();
      expect(linkBox).not.toBeNull();
      expect(linkBox!.height).toBeGreaterThanOrEqual(MIN_TAP_TARGET);
    }

    // The full desktop top nav is not shown on a phone-width viewport.
    await expect(
      page.getByRole("navigation", { name: "Primary", exact: true }),
    ).toBeHidden();
  });
});

test.describe("mobile navigation hidden on desktop", () => {
  test.use({ viewport: DESKTOP_VIEWPORT });

  test("desktop viewport shows the full top nav, not the bottom tab bar", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/dashboard");

    await expect(
      page.getByRole("navigation", { name: "Primary", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Primary (mobile)" }),
    ).toBeHidden();
  });
});

test.describe("mobile cart", () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test("quantity steppers and remove button meet the 44px tap target minimum and a sticky checkout bar stays reachable", async ({
    page,
  }) => {
    const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
    const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        "requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      );
    }
    const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
    const { data: retailerRow } = await admin
      .from("retailers")
      .select("id")
      .eq("slug", TEST_RETAILER_SLUG)
      .single();
    if (retailerRow) {
      const { data: customerRow } = await admin
        .from("customers")
        .select("id")
        .eq("retailer_id", retailerRow.id)
        .eq("email", TEST_CUSTOMER_EMAIL)
        .maybeSingle();
      if (customerRow) {
        await admin
          .from("orders")
          .delete()
          .eq("customer_id", customerRow.id)
          .eq("status", "draft");
      }
    }

    await signIn(page);
    await page.goto(`/r/${TEST_RETAILER_SLUG}/products/${TEST_PRODUCT_SLUG}`);
    await page.getByLabel("Qty").fill("1");
    await page.getByRole("button", { name: "Add to cart" }).click();
    await expect(page).toHaveURL(new RegExp(`/r/${TEST_RETAILER_SLUG}/cart$`));

    const increaseButton = page.getByRole("button", {
      name: /^Increase quantity of/,
    });
    const decreaseButton = page.getByRole("button", {
      name: /^Decrease quantity of/,
    });
    const removeButton = page.getByRole("button", {
      name: /^Remove .* from cart$/,
    });

    for (const control of [increaseButton, decreaseButton, removeButton]) {
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(MIN_TAP_TARGET);
      expect(box!.width).toBeGreaterThanOrEqual(MIN_TAP_TARGET);
    }

    // The sticky mobile checkout bar is reachable without scrolling past
    // the item list, and its own CTA also meets the tap-target minimum.
    const mobileCheckoutButton = page
      .getByRole("button", { name: /Place order/ })
      .last();
    await expect(mobileCheckoutButton).toBeVisible();
    const checkoutBox = await mobileCheckoutButton.boundingBox();
    expect(checkoutBox).not.toBeNull();
    expect(checkoutBox!.height).toBeGreaterThanOrEqual(MIN_TAP_TARGET);
    expect(checkoutBox!.y).toBeLessThanOrEqual(MOBILE_VIEWPORT.height);
  });
});
