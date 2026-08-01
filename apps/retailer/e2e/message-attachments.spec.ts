import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import { TEST_OWNER_EMAIL, TEST_OWNER_PASSWORD } from "./fixtures";

test("owner attaches an image to a client message and sees it rendered inline", async ({
  page,
}) => {
  const unique = Date.now();

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

  await page
    .getByLabel("Message")
    .fill("Here's the fabric swatch we discussed.");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(
    page.getByText("Here's the fabric swatch we discussed."),
  ).toBeVisible();
  // The gallery strip ("Shared images") and the inline bubble image both
  // render from the same signed URL — proves the attach → storage →
  // record_message_attachment → signed-read round trip actually works,
  // not just that the form submitted.
  await expect(page.getByText("Shared images")).toBeVisible();
  await expect(page.getByAltText("swatch.png").first()).toBeVisible();
});
