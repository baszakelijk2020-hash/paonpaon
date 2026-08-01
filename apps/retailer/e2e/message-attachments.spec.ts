import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import { TEST_OWNER_EMAIL, TEST_OWNER_PASSWORD } from "./fixtures";

test("owner attaches an image to a client message and sees it rendered inline", async ({
  page,
}) => {
  const unique = Date.now();
  // Unique per run. A fixed body collides with the conversation previews left
  // by earlier runs of this same test, and the assertion then fails in strict
  // mode on its own history rather than on anything the product did.
  const body = `Here's the fabric swatch we discussed (${unique}).`;

  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // Create a customer to message, same fixture pattern as workspace.spec.ts.
  await page.goto("/customers/new");
  await page.getByLabel("Full name").fill("Attachment Test Customer");
  await page.getByLabel("Email").fill(`attach-${unique}@paon.test`);
  await page.getByRole("button", { name: "Add client" }).click();
  await expect(page).toHaveURL(/\/customers\/[0-9a-f-]+$/);

  await page.getByRole("button", { name: "Message client" }).click();
  // The inbox selects a conversation with a query param now
  // (/messages?c=<id>), not a path segment. Accept either so this
  // assertion tracks "a conversation is open", which is what it means.
  await expect(page).toHaveURL(/\/messages(\/[0-9a-f-]+|\?c=[0-9a-f-]+)$/);

  // Attaching before sending shows the picked filename, not a silent no-op.
  const fixtureImage = path.join(__dirname, "fixtures", "swatch.png");
  await page.getByLabel("Attach an image").setInputFiles(fixtureImage);
  await expect(page.getByText("swatch.png")).toBeVisible();

  await page.getByLabel("Message").fill(body);
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText(body).first()).toBeVisible();
  // The inline bubble image renders from a signed URL, which proves the
  // whole attach → storage → record_message_attachment → signed-read round
  // trip works rather than merely that the form submitted.
  //
  // There is deliberately no assertion on a separate "Shared images" gallery
  // strip: no such surface exists in the inbox. Asserting one made this spec
  // fail for a feature that was never built.
  const inlineImage = page.getByAltText("swatch.png").first();
  await expect(inlineImage).toBeVisible();
  const src = await inlineImage.getAttribute("src");
  // A signed read, not a public URL: the bucket is private.
  expect(src).toContain("token=");
});
