import { expect, test } from "@playwright/test";

import { TEST_OWNER_EMAIL, TEST_OWNER_PASSWORD } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("owner invites an additional staff member", async ({ page }) => {
  const unique = Date.now();

  await page.getByRole("link", { name: /^Team/ }).click();
  await expect(page).toHaveURL(/\/staff$/);

  await page.getByRole("link", { name: "Invite staff" }).click();
  await expect(page).toHaveURL(/\/staff\/new$/);

  await page.getByLabel("Full name").fill("Sam Sales");
  await page.getByLabel("Email").fill(`sam-${unique}@paon.test`);
  await page.getByLabel("Role").selectOption("sales_associate");
  await page.getByRole("button", { name: "Send invite" }).click();

  await expect(page).toHaveURL(/\/staff$/);
  await expect(page.getByText(`sam-${unique}@paon.test`)).toBeVisible();
});

test("owner role option is not offered when inviting staff", async ({
  page,
}) => {
  await page.goto("/staff/new");
  const roleOptions = await page
    .getByLabel("Role")
    .locator("option")
    .allTextContents();
  expect(roleOptions.some((label) => label.trim() === "owner")).toBe(false);
});

test("owner edits the retailer's business profile", async ({ page }) => {
  // Restores the fixture retailer's display name afterwards — other
  // specs (login.spec.ts) run in parallel against the same shared
  // fixture and assert on its original value.
  await page.getByRole("link", { name: /^Settings/ }).click();
  await expect(page).toHaveURL(/\/settings$/);

  const originalDisplayName = await page
    .getByLabel("Display name")
    .inputValue();
  const updatedDisplayName = `${originalDisplayName} (edited ${Date.now()})`;

  await page.getByLabel("Display name").fill(updatedDisplayName);
  await page.getByRole("button", { name: "Save settings" }).click();

  await expect(page.getByRole("status")).toContainText("Settings saved");
  await expect(page.getByLabel("Display name")).toHaveValue(updatedDisplayName);

  await page.getByLabel("Display name").fill(originalDisplayName);
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByRole("status")).toContainText("Settings saved");
});

test("owner adds a client to the book", async ({ page }) => {
  const unique = Date.now();

  await page.getByRole("link", { name: /^Clients/ }).click();
  await expect(page).toHaveURL(/\/customers$/);

  await page.getByRole("link", { name: "New customer" }).click();
  await expect(page).toHaveURL(/\/customers\/new$/);

  await page.getByLabel("Full name").fill("Jamie Shopper");
  await page.getByLabel("Email").fill(`jamie-${unique}@paon.test`);
  await page.getByLabel("Lifecycle stage").selectOption("vip");
  await page.getByRole("button", { name: "Add customer" }).click();

  await expect(page).toHaveURL(/\/customers\/[0-9a-f-]+$/);
  await expect(
    page.getByRole("heading", { name: "Jamie Shopper" }),
  ).toBeVisible();
  await expect(page.getByText("Not connected")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Create the next reason to return." }),
  ).toBeVisible();

  // No OPENAI_API_KEY in this environment — the suggestion card must
  // degrade gracefully, not crash the page (docs/DECISIONS.md ADR-033).
  await expect(
    page.getByRole("heading", { name: "Suggested next step" }),
  ).toBeVisible();
  await expect(
    page.getByText("AI personalisation is not configured on this deployment."),
  ).toBeVisible();

  await page.goto("/customers");
  await expect(page.getByText(`jamie-${unique}@paon.test`)).toBeVisible();
});

test("owner adds a product with its first variant", async ({ page }) => {
  const unique = Date.now();

  await page.getByRole("link", { name: /^Products/ }).click();
  await expect(page).toHaveURL(/\/products$/);

  await page.getByRole("link", { name: "New product" }).click();
  await expect(page).toHaveURL(/\/products\/new$/);

  await page.getByLabel("Name").fill("Bespoke Wool Overcoat");
  await page.getByLabel("Slug").fill(`overcoat-${unique}`);
  await page.getByLabel("SKU").fill(`COAT-${unique}`);
  await page.getByLabel(/Price/).fill("450000");
  await page.getByLabel("Currency").selectOption("USD");
  await page.getByRole("button", { name: "Create product" }).click();

  await expect(page).toHaveURL(/\/products\/[0-9a-f-]+$/);
  await expect(
    page.getByRole("heading", { name: "Bespoke Wool Overcoat" }),
  ).toBeVisible();
  await expect(page.getByLabel("SKU")).toHaveValue(`COAT-${unique}`);
  await expect(page.getByLabel(/Price/).first()).toHaveValue("450000");

  await page.goto("/products");
  await expect(
    page.getByRole("list", { name: "Product catalog" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: new RegExp(`overcoat-${unique}`) }),
  ).toBeVisible();
  await expect(page.getByText(`overcoat-${unique}`)).toBeVisible();
});

test("owner uploads and removes a product image", async ({ page }) => {
  const unique = Date.now();

  await page.goto("/products/new");
  await page.getByLabel("Name").fill("Silk Pocket Square");
  await page.getByLabel("Slug").fill(`pocket-square-${unique}`);
  await page.getByLabel("SKU").fill(`SQUARE-${unique}`);
  await page.getByLabel(/Price/).fill("9500");
  await page.getByLabel("Currency").selectOption("USD");
  await page.getByRole("button", { name: "Create product" }).click();
  await expect(page).toHaveURL(/\/products\/[0-9a-f-]+$/);

  await expect(page.getByText("No image uploaded yet.")).toBeVisible();

  const pngBuffer = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
  await page.getByLabel("Product image file").setInputFiles({
    name: "square.png",
    mimeType: "image/png",
    buffer: pngBuffer,
  });
  await page.getByRole("button", { name: "Upload" }).click();

  await expect(page.getByText("No image uploaded yet.")).toHaveCount(0);
  await expect(page.locator('img[src*="product-images"]')).toBeVisible();

  await page.getByRole("button", { name: "Remove image" }).click();
  await expect(page.getByText("No image uploaded yet.")).toBeVisible();
});

test("owner adds a collection", async ({ page }) => {
  const unique = Date.now();

  await page.goto("/collections");
  await page.getByLabel("Name").fill(`Autumn ${unique}`);
  await page.getByLabel("Slug").fill(`autumn-${unique}`);
  await page.getByRole("button", { name: "Add collection" }).click();

  await expect(page.getByText(`Autumn ${unique}`)).toBeVisible();
});

test("owner views and updates an order's status", async ({ page }) => {
  await page.getByRole("link", { name: /^Orders/ }).click();
  await expect(page).toHaveURL(/\/orders$/);

  const firstOrderLink = page.getByRole("link", { name: /ORD-/ }).first();
  await expect(firstOrderLink).toBeVisible();
  await firstOrderLink.click();

  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]+$/);
  await page.getByLabel("Status").selectOption("placed");
  await page.getByRole("button", { name: "Update status" }).click();

  await expect(page.getByLabel("Status")).toHaveValue("placed");
});

test("owner books an appointment and updates its status", async ({ page }) => {
  await page.goto("/appointments/new");

  // The global-setup order fixture guarantees at least one customer
  // exists; index 0 is the disabled "Select a customer" placeholder.
  await page.getByLabel("Customer").selectOption({ index: 1 });
  await page.getByLabel("Type").selectOption("styling_consultation");

  const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  await page.getByLabel("Starts").fill(start.toISOString().slice(0, 16));
  await page.getByLabel("Ends").fill(end.toISOString().slice(0, 16));
  await page.getByRole("button", { name: "Book appointment" }).click();

  await expect(page).toHaveURL(/\/appointments\/[0-9a-f-]+$/);
  await expect(
    page.getByRole("heading", { name: "What should the advisor know?" }),
  ).toBeVisible();
  await page.getByLabel("Status").selectOption("confirmed");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByLabel("Status")).toHaveValue("confirmed");
});

test("owner adds their own availability window", async ({ page }) => {
  await page.goto("/appointments/availability");

  await page.getByLabel("Day").selectOption("2");
  await page.getByLabel("Start").fill("09:00");
  await page.getByLabel("End").fill("17:00");
  await page.getByRole("button", { name: "Add window" }).click();

  await expect(page.getByText("Tuesday · 09:00–17:00")).toBeVisible();
});

test("owner creates a garment work order with current and future work", async ({
  page,
}) => {
  await page.goto("/alterations/new");

  await page.getByLabel("Customer").selectOption({ index: 1 });
  await page.getByLabel("Garment type").fill("Navy single-breasted jacket");
  await page
    .getByLabel("Description")
    .fill("Customer-owned navy jacket with horn buttons.");
  await page
    .getByLabel("Intake condition")
    .fill("Good condition; light wear at cuffs documented.");
  await page.getByLabel("Observation area").fill("Right sleeve");
  await page
    .getByLabel("Observation", { exact: true })
    .fill("Right sleeve is 8 mm longer at the wrist.");
  await page.getByLabel("Work-now task").fill("Shorten right sleeve 8 mm");
  await page
    .getByLabel("Future order note")
    .fill("Add 5 mm to the right sleeve on the next GoCreate order.");
  await page.getByRole("button", { name: "Create work order" }).click();

  await expect(page).toHaveURL(/\/alterations\/[0-9a-f-]+$/);
  await expect(
    page
      .getByRole("paragraph")
      .filter({ hasText: "Shorten right sleeve 8 mm" }),
  ).toBeVisible();
  await expect(
    page.getByRole("paragraph").filter({ hasText: "Future order note" }),
  ).toBeVisible();
  await page.getByLabel("Status", { exact: true }).selectOption("quoted");
  await page
    .getByLabel("Note", { exact: true })
    .fill("Scope and original quote prepared.");
  await page.getByRole("button", { name: "Add update" }).click();

  await expect(
    page.getByText("Scope and original quote prepared."),
  ).toBeVisible();
  await expect(page.getByText(/E2E Owner ·/).last()).toBeVisible();
});
