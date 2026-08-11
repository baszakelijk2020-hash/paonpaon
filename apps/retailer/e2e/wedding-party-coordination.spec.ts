import { expect, test } from "@playwright/test";

import { TEST_OWNER_EMAIL, TEST_OWNER_PASSWORD } from "./fixtures";
import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "16.5";
const BROWSER_PROOF_SPEC =
  "apps/retailer/e2e/wedding-party-coordination.spec.ts";

let baseFlowPassed = false;
let aftercarePassed = false;
let groupFittingPassed = false;
let groupCapacityPassed = false;
let guestVoucherPassed = false;

function dateOffset(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

test.afterAll(async () => {
  await writeBrowserProofRun({
    phaseItemId: PHASE_ITEM_ID,
    spec: BROWSER_PROOF_SPEC,
    status:
      baseFlowPassed &&
      aftercarePassed &&
      groupFittingPassed &&
      groupCapacityPassed &&
      guestVoucherPassed
        ? "passed"
        : "failed",
  });
});

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("owner starts a wedding party, adds a groomsman, and messages the party", async ({
  page,
}) => {
  const unique = Date.now();

  await page.goto("/customers/new");
  await page.getByLabel("Full name").fill("Groom To Be");
  await page.getByLabel("Email").fill(`groom-${unique}@paon.test`);
  await page.getByRole("button", { name: "Add client" }).click();
  await expect(page).toHaveURL(/\/customers\/[0-9a-f-]+$/);
  const customerId = page.url().split("/").pop();

  await page.goto(`/wedding-parties/new?customerId=${customerId}`);
  await page.getByLabel("Venue").fill("The Grand Hall");
  await page.getByRole("button", { name: "Create wedding party" }).click();
  await expect(page).toHaveURL(/\/wedding-parties\/[0-9a-f-]+$/);

  await expect(
    page.getByRole("heading", { name: "Groom To Be" }),
  ).toBeVisible();

  await page.getByLabel("Name").fill("Best Man");
  await page.getByLabel("Email").fill(`bestman-${unique}@paon.test`);
  await page.getByLabel("Role").selectOption("best_man");
  await page.getByRole("button", { name: "Add member" }).click();

  await expect(
    page.locator("p.font-medium", { hasText: "Best Man" }),
  ).toBeVisible();
  await expect(
    page.locator("span").filter({ hasText: "invited" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Message the party" }).click();
  // The inbox selects a conversation with a query param now
  // (/messages?c=<id>), not a path segment. Accept either so this
  // assertion tracks "a conversation is open", which is what it means.
  await expect(page).toHaveURL(/\/messages(\/[0-9a-f-]+|\?c=[0-9a-f-]+)$/);
  baseFlowPassed = true;
});

test("owner adds a delivery & pickup readiness instruction for the whole party", async ({
  page,
}) => {
  const unique = Date.now();

  await page.goto("/customers/new");
  await page.getByLabel("Full name").fill("Aftercare Groom");
  await page.getByLabel("Email").fill(`aftercare-groom-${unique}@paon.test`);
  await page.getByRole("button", { name: "Add client" }).click();
  await expect(page).toHaveURL(/\/customers\/[0-9a-f-]+$/);
  const customerId = page.url().split("/").pop();

  await page.goto(`/wedding-parties/new?customerId=${customerId}`);
  await page.getByLabel("Venue").fill("The Grand Hall");
  await page.getByRole("button", { name: "Create wedding party" }).click();
  await expect(page).toHaveURL(/\/wedding-parties\/[0-9a-f-]+$/);

  const instruction = `Return rentals within 3 days ${unique}`;
  await page.getByLabel("Instruction").fill(instruction);
  await page.getByRole("button", { name: "Add instruction" }).click();

  const planItem = page.locator("li", { hasText: instruction });
  await expect(planItem).toBeVisible();
  await expect(planItem.getByText("Whole party")).toBeVisible();
  await expect(planItem.getByText("Pending", { exact: true })).toBeVisible();
  aftercarePassed = true;
});

test("owner schedules a group fitting for the wedding party", async ({
  page,
}) => {
  const unique = Date.now();

  await page.goto("/customers/new");
  await page.getByLabel("Full name").fill("Group Fitting Groom");
  await page
    .getByLabel("Email")
    .fill(`group-fitting-groom-${unique}@paon.test`);
  await page.getByRole("button", { name: "Add client" }).click();
  await expect(page).toHaveURL(/\/customers\/[0-9a-f-]+$/);
  const customerId = page.url().split("/").pop();

  await page.goto(`/wedding-parties/new?customerId=${customerId}`);
  await page.getByLabel("Venue").fill("The Grand Hall");
  await page.getByRole("button", { name: "Create wedding party" }).click();
  await expect(page).toHaveURL(/\/wedding-parties\/[0-9a-f-]+$/);

  await page.getByLabel("Date and time").fill("2027-03-15T14:30");
  await page.getByLabel("Capacity").fill("8");
  await page.getByRole("button", { name: "Schedule group fitting" }).click();

  const fittingItem = page.locator("li", { hasText: "Capacity 8" });
  await expect(fittingItem).toBeVisible();
  await expect(fittingItem).toContainText("Mar 15, 2027");
  groupFittingPassed = true;
});

test("owner sees group fitting capacity exceptions and adequate capacity", async ({
  page,
}) => {
  const unique = Date.now();

  await page.goto("/customers/new");
  await page.getByLabel("Full name").fill("Capacity Exception Groom");
  await page
    .getByLabel("Email")
    .fill(`capacity-exception-groom-${unique}@paon.test`);
  await page.getByRole("button", { name: "Add client" }).click();
  await expect(page).toHaveURL(/\/customers\/[0-9a-f-]+$/);
  const exceptionCustomerId = page.url().split("/").pop();

  await page.goto(`/wedding-parties/new?customerId=${exceptionCustomerId}`);
  await page.getByLabel("Event date").fill(dateOffset(3));
  await page.getByRole("button", { name: "Create wedding party" }).click();
  await expect(page).toHaveURL(/\/wedding-parties\/[0-9a-f-]+$/);
  await page.getByLabel("Name").fill("Exception Best Man");
  await page.getByLabel("Email").fill(`exception-best-man-${unique}@paon.test`);
  await page.getByRole("button", { name: "Add member" }).click();
  await expect(
    page.locator("p.font-medium", { hasText: "Exception Best Man" }),
  ).toBeVisible();
  await page.getByLabel("Name").fill("Exception Groomsman");
  await page
    .getByLabel("Email")
    .fill(`exception-groomsman-${unique}@paon.test`);
  await page.getByRole("button", { name: "Add member" }).click();
  await expect(
    page.locator("p.font-medium", { hasText: "Exception Groomsman" }),
  ).toBeVisible();
  await page.getByLabel("Date and time").fill(`${dateOffset(0)}T10:00`);
  await page.getByLabel("Capacity").fill("1");
  await page.getByRole("button", { name: "Schedule group fitting" }).click();

  const exceptionCapacity = page.getByTestId("group-fitting-capacity-summary");
  await expect(
    exceptionCapacity.getByText("Fitting capacity exception"),
  ).toBeVisible();
  await expect(exceptionCapacity.getByText("Action needed")).toBeVisible();
  await expect(exceptionCapacity).toContainText("2 members need fitting");
  await expect(exceptionCapacity).toContainText("Exception Best Man");
  await expect(exceptionCapacity).toContainText("Exception Groomsman");
  await expect(exceptionCapacity).not.toContainText(/height|weight|cm|kg/i);

  await page.goto("/customers/new");
  await page.getByLabel("Full name").fill("Capacity Adequate Groom");
  await page
    .getByLabel("Email")
    .fill(`capacity-adequate-groom-${unique}@paon.test`);
  await page.getByRole("button", { name: "Add client" }).click();
  await expect(page).toHaveURL(/\/customers\/[0-9a-f-]+$/);
  const adequateCustomerId = page.url().split("/").pop();

  await page.goto(`/wedding-parties/new?customerId=${adequateCustomerId}`);
  await page.getByLabel("Event date").fill(dateOffset(3));
  await page.getByRole("button", { name: "Create wedding party" }).click();
  await expect(page).toHaveURL(/\/wedding-parties\/[0-9a-f-]+$/);
  await page.getByLabel("Name").fill("Adequate Best Man");
  await page.getByLabel("Email").fill(`adequate-best-man-${unique}@paon.test`);
  await page.getByRole("button", { name: "Add member" }).click();
  await expect(
    page.locator("p.font-medium", { hasText: "Adequate Best Man" }),
  ).toBeVisible();
  await page.getByLabel("Name").fill("Adequate Groomsman");
  await page.getByLabel("Email").fill(`adequate-groomsman-${unique}@paon.test`);
  await page.getByRole("button", { name: "Add member" }).click();
  await expect(
    page.locator("p.font-medium", { hasText: "Adequate Groomsman" }),
  ).toBeVisible();
  await page.getByLabel("Date and time").fill(`${dateOffset(0)}T10:00`);
  await page.getByLabel("Capacity").fill("2");
  await page.getByRole("button", { name: "Schedule group fitting" }).click();

  const adequateCapacity = page.getByTestId("group-fitting-capacity-summary");
  await expect(
    adequateCapacity.getByText("Fitting capacity is adequate"),
  ).toBeVisible();
  await expect(
    adequateCapacity.getByText("Adequate", { exact: true }),
  ).toBeVisible();
  await expect(adequateCapacity).toContainText(
    "2 members needing fitting have 2 scheduled places",
  );
  groupCapacityPassed = true;
});

test("owner issues a guest voucher and marks it redeemed", async ({ page }) => {
  const unique = Date.now();

  await page.goto("/customers/new");
  await page.getByLabel("Full name").fill("Guest Voucher Groom");
  await page
    .getByLabel("Email")
    .fill(`guest-voucher-groom-${unique}@paon.test`);
  await page.getByRole("button", { name: "Add client" }).click();
  await expect(page).toHaveURL(/\/customers\/[0-9a-f-]+$/);
  const customerId = page.url().split("/").pop();

  await page.goto(`/wedding-parties/new?customerId=${customerId}`);
  await page.getByLabel("Venue").fill("The Grand Hall");
  await page.getByRole("button", { name: "Create wedding party" }).click();
  await expect(page).toHaveURL(/\/wedding-parties\/[0-9a-f-]+$/);

  const guestLabel = `Uncle Robert ${unique}`;
  await page.getByLabel("Voucher recipient").fill(guestLabel);
  await page.getByLabel("Funding source").fill("Couple's gift fund");
  await page.getByLabel("Value").fill("150");
  await page.getByLabel("Expires").fill("2027-12-31");
  await page.getByRole("button", { name: "Issue voucher" }).click();

  const voucherItem = page.locator("li", { hasText: guestLabel });
  await expect(voucherItem).toBeVisible();
  await expect(voucherItem).toContainText("€150.00");
  await expect(voucherItem).toContainText("Couple's gift fund");
  await expect(
    voucherItem.getByRole("button", { name: "Mark redeemed" }),
  ).toBeVisible();

  await voucherItem.getByRole("button", { name: "Mark redeemed" }).click();
  await expect(voucherItem.getByText("Redeemed")).toBeVisible();
  await expect(
    voucherItem.getByRole("button", { name: "Mark redeemed" }),
  ).toHaveCount(0);
  guestVoucherPassed = true;
});
