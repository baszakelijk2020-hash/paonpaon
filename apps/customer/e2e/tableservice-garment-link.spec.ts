import { WardrobeRepository, createSupabaseAdminClient } from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL, TEST_RETAILER_SLUG } from "./fixtures";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

/**
 * FT-09 gap closure proof: the last unattempted gap ("garment links remain
 * unattempted") is now closed the same way party linking was. A photo
 * TableService attachment can be optionally tagged to one of the customer's
 * own wardrobe items, and the retailer inbox surfaces that link. Links to
 * `wardrobe_items` — the customer-readable garment record — not the
 * staff-only `physical_garments` alteration-intake table, which a customer
 * has no RLS read access to.
 */
test("a photo attachment can be linked to the customer's own wardrobe item", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("requires local Supabase.");
  }
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
  const wardrobeRepo = new WardrobeRepository(admin);

  const { data: retailer } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");
  const { data: customer } = await admin
    .from("customers")
    .select("id")
    .eq("retailer_id", retailer.id)
    .eq("email", TEST_CUSTOMER_EMAIL)
    .single();
  if (!customer) throw new Error("fixture customer missing");

  const displayName = `E2E Garment-Link Blazer ${Date.now()}`;
  const item = await wardrobeRepo.createExternalItem({
    retailerId: asId<"RetailerId">(retailer.id),
    customerId: asId<"CustomerId">(customer.id),
    categoryCode: "jacket",
    displayName,
    description: "Customer-owned navy blazer.",
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

    const startedAt = new Date().toISOString();
    await page.goto(`/r/${TEST_RETAILER_SLUG}`);
    await page.getByRole("button", { name: "Ask us anything" }).click();

    await page.locator("#gcw-paperclip").click();
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Upload Photo" }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: "blazer.png",
      mimeType: "image/png",
      buffer: PNG,
    });
    await page
      .getByLabel("I may share this material for this private consultation.")
      .check();

    await page
      .getByLabel("Link to a garment")
      .selectOption({ label: displayName });

    await page
      .getByPlaceholder("Type a message...")
      .fill("Question about this blazer's sleeve.");
    await page.locator("#gcw-send").click();
    await expect(
      page.getByText(/Shared securely with your advisor/),
    ).toBeVisible();

    const { data: conversation } = await admin
      .from("conversations")
      .select("id")
      .eq("customer_id", customer.id)
      .single();
    if (!conversation) throw new Error("conversation missing");

    await expect
      .poll(async () => {
        const { data: messages } = await admin
          .from("messages")
          .select("id")
          .eq("conversation_id", conversation.id)
          .gte("created_at", startedAt);
        if (!messages?.length) return null;
        const { data: attachments } = await admin
          .from("message_attachments")
          .select("wardrobe_item_id")
          .in(
            "message_id",
            messages.map((message) => message.id),
          )
          .eq("purpose", "photo")
          .not("wardrobe_item_id", "is", null);
        return attachments?.[0]?.wardrobe_item_id ?? null;
      })
      .toBe(item.id);
  } finally {
    const { error: cleanupError } = await admin
      .from("wardrobe_items")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", item.id);
    if (cleanupError) {
      console.error("wardrobe item cleanup failed:", cleanupError);
    }
  }
});
