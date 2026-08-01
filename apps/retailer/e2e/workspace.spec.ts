import { expect, test, type Page } from "@playwright/test";

import {
  AUTH_DELIVERABLE_DOMAIN,
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
} from "./fixtures";

/**
 * Clicks a PRIMARY NAVIGATION link.
 *
 * `page.getByRole("link", { name: /^Team/ })` matches two elements: the
 * sidebar entry and the dashboard's quick-link card, which carry the same
 * accessible name. Playwright then refuses in strict mode. Scoping to the
 * navigation landmark says which one is meant, and keeps working as more
 * dashboard cards are added.
 */
function navLink(page: Page, name: RegExp) {
  return page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("link", { name });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

/**
 * Inviting a teammate goes through Supabase Auth's own email delivery, which
 * on a project without custom SMTP is rate limited to a handful of sends per
 * hour. That makes the happy path non-deterministic here through no fault of
 * the product, so it is asserted conditionally and the failure mode — which
 * matters more — is asserted unconditionally below.
 */
test("owner invites an additional staff member", async ({ page }) => {
  const unique = Date.now();
  const email = `sam-${unique}@${AUTH_DELIVERABLE_DOMAIN}`;

  await navLink(page, /^Team/).click();
  await expect(page).toHaveURL(/\/staff$/);

  await page.getByRole("link", { name: "Invite teammate" }).click();
  await expect(page).toHaveURL(/\/staff\/new$/);

  await page.getByLabel("Full name").fill("Sam Sales");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Role").selectOption("sales_associate");
  await page.getByRole("button", { name: "Send invite" }).click();

  // Either the invite went out and we landed on the team list, or Auth
  // refused to send another email this hour. Both are legitimate; a silent
  // third outcome — staying put with no explanation — is not.
  // Filtered to an alert that actually SAYS something: the layout carries a
  // permanently-present empty live region, and polling on its existence is
  // satisfied instantly by a container holding no message at all.
  const alert = page.getByRole("alert").filter({ hasText: /\S/ });
  await expect
    .poll(
      async () => {
        if (/\/staff$/.test(page.url())) return "delivered";
        if ((await alert.count()) > 0) {
          return (await alert.first().textContent()) ?? "";
        }
        return "pending";
      },
      { timeout: 30_000 },
    )
    .not.toBe("pending");

  if (/\/staff$/.test(page.url())) {
    await expect(page.getByText(email)).toBeVisible();
    return;
  }

  // The only tolerated refusal is the external one, and it must say so.
  const text = (await alert.first().textContent()) ?? "";
  expect(text).toMatch(/rate limit/i);
  test.info().annotations.push({
    type: "blocked_external",
    description:
      "Supabase Auth email rate limit. Needs custom SMTP configured on the project; not a product defect.",
  });
});

test("invalid invite input creates no teammate", async ({ page }) => {
  // Local Supabase correctly accepts reserved `.test` domains, so they do
  // not model delivery failure. Exercise the deterministic boundary instead:
  // malformed input must be refused before Auth or the staff table is touched.
  const invalidEmail = `sam-invalid-${Date.now()}@`;

  await page.goto("/staff/new");
  await page.getByLabel("Full name").fill("Sam Undeliverable");
  await page.getByLabel("Email").fill(invalidEmail);
  await page.getByLabel("Role").selectOption("sales_associate");
  await page
    .getByRole("button", { name: "Send invite" })
    .locator("xpath=ancestor::form")
    .evaluate((form: HTMLFormElement) => {
      form.noValidate = true;
    });
  await page.getByRole("button", { name: "Send invite" }).click();

  // Refused, on the page, before any teammate is created.
  await expect(
    page.getByRole("alert").filter({ hasText: /\S/ }).first(),
  ).toContainText(/invalid|valid email/i, { timeout: 30_000 });
  await expect(page).toHaveURL(/\/staff\/new$/);

  // And no half-created teammate anywhere.
  await page.goto("/staff");
  await expect(page.getByText(invalidEmail)).toHaveCount(0);
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
  await navLink(page, /^Settings/).click();
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

  await navLink(page, /^Clients/).click();
  await expect(page).toHaveURL(/\/customers$/);

  await page.getByRole("link", { name: "New client" }).click();
  await expect(page).toHaveURL(/\/customers\/new$/);

  await page.getByLabel("Full name").fill("Jamie Shopper");
  await page.getByLabel("Email").fill(`jamie-${unique}@paon.test`);
  await page.getByLabel("Lifecycle stage").selectOption("vip");
  await page.getByRole("button", { name: "Add client" }).click();

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

  await navLink(page, /^Products/).click();
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
  await navLink(page, /^Orders/).click();
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

  // The pickers are composite controls — a day strip and a time strip, not a
  // native datetime-local input. They are driven the way a person drives
  // them, by choosing, and each strip is reachable by its accessible name.
  async function choose(
    field: string,
    label: string,
    dayIndex: number,
    time: string,
  ) {
    const group = page.locator(`[data-datetime-field="${field}"]`);
    await group
      .getByRole("radiogroup", { name: `${label} — day` })
      .getByRole("radio")
      .nth(dayIndex)
      .click();
    await group
      .getByRole("radiogroup", { name: `${label} — time` })
      .getByRole("radio", { name: time, exact: true })
      .click();
    // Assert on the composed value, not on which cell looks lit.
    await expect(group).not.toHaveAttribute("data-datetime-value", "");
  }

  await choose("startsAt", "Starts", 0, "10:00");
  await choose("endsAt", "Ends", 0, "11:00");
  // The choice is read back in words rather than left as two lit cells.
  await expect(
    page.locator('[data-datetime-summary="startsAt"]'),
  ).toContainText("at 10:00");
  await page.getByRole("button", { name: "Book appointment" }).click();

  await expect(page).toHaveURL(/\/appointments\/[0-9a-f-]+$/);
  await expect(
    page.getByRole("heading", { name: "What should the advisor know?" }),
  ).toBeVisible();
  await page.getByLabel("Status").selectOption("confirmed");
  // Exact: the page also carries a "Save closeout" button, so a substring
  // match resolves to two elements.
  await page.getByRole("button", { name: "Save", exact: true }).click();

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
