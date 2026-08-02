import {
  WeddingPartyRepository,
  createSupabaseAdminClient,
} from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL, TEST_RETAILER_SLUG } from "./fixtures";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

/**
 * FT-09 gap closure proof: a wedding_fabric TableService attachment can be
 * optionally tagged to the customer's own wedding party, and the retailer
 * inbox surfaces that link rather than recording it silently.
 */
test("a wedding-fabric attachment can be linked to the customer's own wedding party", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("requires local Supabase.");
  }
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
  const partyRepo = new WeddingPartyRepository(admin);

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

  const party = await partyRepo.create({
    retailerId: asId<"RetailerId">(retailer.id),
    organizerCustomerId: asId<"CustomerId">(customer.id),
    venueName: `E2E Fabric-Link Venue ${Date.now()}`,
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
    await page
      .getByRole("button", { name: "Upload Wedding Dress fabric" })
      .click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: "dress-fabric.png",
      mimeType: "image/png",
      buffer: PNG,
    });
    await page
      .getByLabel("I may share this material for this private consultation.")
      .check();

    await page
      .getByLabel("Link to wedding party")
      .selectOption({ label: party.venueName ?? "" });

    await page.getByPlaceholder("Type a message...").fill("Fabric for us.");
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
          .select("wedding_party_id")
          .in(
            "message_id",
            messages.map((message) => message.id),
          )
          .eq("purpose", "wedding_fabric");
        return attachments?.[0]?.wedding_party_id ?? null;
      })
      .toBe(party.id);
  } finally {
    const { error: cleanupError } = await admin
      .from("wedding_parties")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", party.id);
    if (cleanupError) {
      console.error("wedding party cleanup failed:", cleanupError);
    }
  }
});
