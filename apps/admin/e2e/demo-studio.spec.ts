import { createSupabaseAdminClient } from "@paon/database";
import { expect, test } from "@playwright/test";

import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } from "./fixtures";

test("platform staff creates and versions a retailer-specific demo configuration", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Demo Studio e2e requires local Supabase variables.");
  }
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
  const companyName = `E2E Prospect ${Date.now()}`;
  let prospectId: string | undefined;
  let assetPath: string | undefined;

  try {
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_ADMIN_EMAIL);
    await page.getByLabel("Password").fill(TEST_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Enter PAON" }).click();
    await expect(page).toHaveURL(/\/retailers$/);
    await page.getByRole("link", { name: /^Demo Studio/ }).click();
    await page.getByRole("link", { name: "Create prospect" }).click();

    await page.getByLabel("Company name").fill(companyName);
    await page.getByLabel("Website").fill("https://example.com");
    await page.getByLabel("Primary contact").fill("Amelia Retailer");
    await page.getByLabel("Contact email").fill("amelia@example.com");
    await page
      .getByLabel("Next revenue action")
      .fill("Prepare a fitting-to-pickup demonstration");
    await page
      .getByLabel("Observed opportunities")
      .fill("Connect appointment preparation to garment progress");
    await page
      .getByRole("button", {
        name: "Create prospect and open Demo Studio",
      })
      .click();
    await expect(page).toHaveURL(/\/prospects\/[^/]+\/studio$/);
    prospectId = page.url().match(/\/prospects\/([^/]+)\/studio/)?.[1];
    expect(prospectId).toBeTruthy();

    await page.getByLabel("Brand asset file").setInputFiles({
      name: "e2e-mark.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="#1a1a1a"/></svg>',
      ),
    });
    await page.getByRole("button", { name: "Upload brand asset" }).click();
    const uploadedUrl = await page
      .getByLabel("Uploaded brand asset URL")
      .inputValue();
    expect(uploadedUrl).toContain("demo-brand-assets");
    assetPath = decodeURIComponent(
      uploadedUrl.split("/demo-brand-assets/")[1] ?? "",
    );
    await page.getByLabel("Logo URL").fill(uploadedUrl);

    await page
      .getByLabel("Demo headline")
      .fill("A composed fitting journey for a modern retail house");
    await page
      .getByLabel("Personalized introduction")
      .fill(
        "This environment connects the retailer’s appointment, relationship and garment journey around one calm operating picture.",
      );
    await page.getByLabel("Version note").fill("Initial researched narrative");
    await page
      .getByRole("button", { name: "Save Demo Studio version" })
      .click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Demo configuration version 1 saved" }),
    ).toBeVisible();

    const { data: configuration, error } = await admin
      .from("prospect_demo_configurations")
      .select("current_version, marketing_headline")
      .eq("prospect_id", prospectId!)
      .single();
    expect(error).toBeNull();
    expect(configuration).toMatchObject({
      current_version: 1,
      marketing_headline:
        "A composed fitting journey for a modern retail house",
    });
  } finally {
    if (assetPath) {
      await admin.storage.from("demo-brand-assets").remove([assetPath]);
    }
    if (prospectId) {
      await admin.from("commercial_prospects").delete().eq("id", prospectId);
    }
  }
});
