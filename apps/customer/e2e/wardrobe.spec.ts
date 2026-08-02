import { WardrobeRepository, createSupabaseAdminClient } from "@paon/database";
import { expect, test } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL, TEST_RETAILER_SLUG } from "./fixtures";

test("the wardrobe rails open, close, keyboard-navigate, and still let a customer add and retire a garment", async ({
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

  const { data: retailer } = await admin
    .from("retailers")
    .select("id, display_name")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");
  const { data: customerRow } = await admin
    .from("customers")
    .select("id")
    .eq("retailer_id", retailer.id)
    .eq("email", TEST_CUSTOMER_EMAIL)
    .maybeSingle();
  if (!customerRow) throw new Error("fixture customer missing");

  // Isolate this run's rail assertions from any item another spec left
  // behind under the same customer/retailer.
  await admin
    .from("wardrobe_items")
    .delete()
    .eq("customer_id", customerRow.id)
    .eq("retailer_id", retailer.id)
    .eq("display_name", "E2E Rail Jacket");

  const wardrobeRepo = new WardrobeRepository(admin);
  await wardrobeRepo.createExternalItem({
    retailerId: retailer.id,
    customerId: customerRow.id,
    categoryCode: "jacket",
    displayName: "E2E Rail Jacket",
    condition: "good",
    careState: "current",
    fitPerception: "true_to_size",
  });

  try {
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

    await page.goto("/wardrobe");
    // Ids are retailer-scoped since this customer may have wardrobe panels
    // for more than one house on the same page.
    const jacketsHeader = page.locator(`#wardrobe-rail-${retailer.id}-jackets`);
    const suitsHeader = page.locator(`#wardrobe-rail-${retailer.id}-suits`);
    const jacketsPanel = page.locator(
      `#wardrobe-rail-panel-${retailer.id}-jackets`,
    );

    // Open/closed is a CSS grid-track collapse (0fr/1fr) so the panel
    // animates smoothly instead of unmounting — the descendant item text
    // stays technically present in the DOM while clipped, so Playwright's
    // shallow toBeVisible() (which does not walk ancestors for clipping)
    // cannot tell open from closed. Assert the collapse itself instead.
    async function railHeight(): Promise<number> {
      return (await jacketsPanel.boundingBox())?.height ?? -1;
    }

    // The seeded jacket's rail opens by default (first non-empty section).
    await expect(jacketsHeader).toHaveAttribute("aria-expanded", "true");
    await expect.poll(railHeight).toBeGreaterThan(0);
    await expect(jacketsPanel.getByText("E2E Rail Jacket")).toBeVisible();

    // Closing collapses the rail to zero height but keeps the rail (and
    // the item) in the DOM.
    await jacketsHeader.click();
    await expect(jacketsHeader).toHaveAttribute("aria-expanded", "false");
    await expect.poll(railHeight).toBe(0);
    await jacketsHeader.click();
    await expect(jacketsHeader).toHaveAttribute("aria-expanded", "true");
    await expect.poll(railHeight).toBeGreaterThan(0);

    // Keyboard roving: arrow-right from Suits moves focus to Jackets.
    await suitsHeader.focus();
    await page.keyboard.press("ArrowRight");
    await expect(jacketsHeader).toBeFocused();

    // The existing add/retire actions still work through the new rail UI —
    // scoped to this house's own form, since a customer can have a
    // wardrobe panel per retailer relationship on the same page.
    const addForm = page.getByLabel(
      `Add external garment for ${retailer.display_name}`,
    );
    await addForm.getByLabel("Name").fill(`E2E Rail Added Shirt ${Date.now()}`);
    await addForm.getByLabel("Category").selectOption("shirt");
    await addForm.getByRole("button", { name: "Add to wardrobe" }).click();
    await expect(
      page.getByText("External garment added to your wardrobe."),
    ).toBeVisible();

    await jacketsPanel
      .locator("article", { hasText: "E2E Rail Jacket" })
      .getByRole("button", { name: "Retire" })
      .click();
    await expect(page.getByText("Garment marked retired.")).toBeVisible();
    await expect(jacketsPanel.getByText("E2E Rail Jacket")).toHaveCount(0);
  } finally {
    await admin
      .from("wardrobe_items")
      .delete()
      .eq("customer_id", customerRow.id)
      .eq("retailer_id", retailer.id)
      .or(
        "display_name.eq.E2E Rail Jacket,display_name.like.E2E Rail Added Shirt%",
      );
  }
});
