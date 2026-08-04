import { CustomerRepository, createSupabaseAdminClient } from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import {
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
  TEST_RETAILER_SLUG,
} from "./fixtures";
import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "15.1";
const BROWSER_PROOF_SPEC = "apps/retailer/e2e/network.spec.ts";

let proofPassed = false;

test.afterAll(async () => {
  await writeBrowserProofRun({
    phaseItemId: PHASE_ITEM_ID,
    spec: BROWSER_PROOF_SPEC,
    status: proofPassed ? "passed" : "failed",
  });
});

test("owner activates a disclosed partner listing, and an attributed conversion reverses to zero on refund with no raw Self-Portrait ever sent", async ({
  page,
}) => {
  test.setTimeout(180_000);

  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  const { data: retailer } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");
  const retailerId = asId<"RetailerId">(retailer.id);

  const unique = Date.now();
  const customerFullName = `E2E Network Client ${unique}`;
  const customerEmail = `network-${unique}@paon.test`;
  const customer = await new CustomerRepository(admin).create({
    retailerId,
    fullName: customerFullName,
    email: customerEmail,
    lifecycleStage: "prospect",
  });

  const partnerKey = `e2e-partner-${unique}`;
  const listingTitle = `E2E Listing ${unique}`;

  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  try {
    // ---- retailer curates and (by default) activates a disclosed listing --
    await page.goto("/network");
    await page.locator("#partner-display-name").fill(`E2E Partner ${unique}`);
    await page.locator("#partner-key").fill(partnerKey);
    await page
      .locator("#partner-disclosure")
      .fill("Paid placement — PAON receives a commission on purchases.");
    await page
      .locator("#create-partner-form")
      .getByRole("button", { name: "Add partner" })
      .click();

    const partnerRow = page.locator("li", { hasText: `E2E Partner ${unique}` });
    await expect(partnerRow).toBeVisible({ timeout: 15_000 });
    await expect(partnerRow).toContainText(partnerKey);
    await expect(partnerRow).toContainText("Paid placement");

    await page.goto("/network");
    await page
      .locator("#listing-partner")
      .selectOption({ label: `E2E Partner ${unique}` });
    await page.locator("#listing-title").fill(listingTitle);
    await page
      .locator("#listing-destination")
      .fill("https://partner.example.com/offer");
    await page
      .locator("#create-listing-form")
      .getByRole("button", { name: "Create listing" })
      .click();

    const listingCard = page.locator("[data-listing-id]", {
      hasText: listingTitle,
    });
    await expect(listingCard).toBeVisible({ timeout: 15_000 });
    // Active by default — no separate activation step required for the
    // demo panel to appear, matching the schema's own `active default true`.
    await expect(listingCard.getByText("Active")).toBeVisible();
    await expect(listingCard.getByText("Paid placement")).toBeVisible();

    // ---- click: pending, no order yet -------------------------------------
    const demo = listingCard.locator("[data-attribution-demo]");
    await demo
      .locator('select[id^="click-customer-"]')
      .selectOption({ label: customerFullName });
    await demo.getByRole("button", { name: "Record click" }).click();
    await expect(
      demo.locator('[data-attribution-state="pending"]'),
    ).toBeVisible({ timeout: 15_000 });

    // ---- confirm: holding, not yet payable ---------------------------------
    await demo
      .locator('select[id^="confirm-customer-"]')
      .selectOption({ label: customerFullName });
    await demo.locator('input[name="amountEuros"]').fill("120.00");
    await demo.getByRole("button", { name: "Confirm order" }).click();
    await expect(
      demo.locator('[data-attribution-state="holding"]'),
    ).toBeVisible({ timeout: 15_000 });
    await expect(demo.getByText("€120.00")).toBeVisible();

    // ---- refund: reverses to zero regardless of where in the window -------
    await demo
      .locator('select[id^="refund-customer-"]')
      .selectOption({ label: customerFullName });
    await demo.getByRole("button", { name: "Refund order" }).click();
    const reversedSnapshot = demo.locator(
      '[data-attribution-state="reversed"]',
    );
    await expect(reversedSnapshot).toBeVisible({ timeout: 15_000 });
    await expect(reversedSnapshot).toContainText("€0.00");

    // ---- the non-goal: no raw Self-Portrait in what a partner would see ---
    // Scoped to the payload blocks, not the whole page: the retailer's own
    // customer picker legitimately lists every customer's name — that is
    // this staff member's own book, not something sent to a partner. What
    // must never carry a name or email is the payload a partner receives.
    const payloadText = await demo
      .locator("[data-partner-payload]")
      .allInnerTexts();
    for (const payload of payloadText) {
      expect(payload).not.toContain(customerFullName);
      expect(payload).not.toContain(customerEmail);
      expect(payload).not.toContain(customer.id);
    }

    const { data: dbEvents } = await admin
      .from("network_attribution_events")
      .select("id, event, pseudonymous_ref")
      .eq("retailer_id", retailerId)
      .eq("listing_id", (await listingCard.getAttribute("data-listing-id"))!);
    expect(dbEvents?.map((event) => event.event).sort()).toEqual(
      ["click", "order_confirmed", "order_refunded"].sort(),
    );
    // Every event shares one pseudonymous ref, and none of them is the
    // customer's own id — the whole point of the pseudonym map.
    const refs = new Set(dbEvents?.map((event) => event.pseudonymous_ref));
    expect(refs.size).toBe(1);
    expect([...refs][0]).not.toBe(customer.id);

    proofPassed = true;
  } finally {
    // network_attribution_events and network_pseudonym_map are append-only
    // (no UPDATE/DELETE grant for any role, including service_role — see
    // the enforce-append-only migration), but both reference network_partners
    // with ON DELETE CASCADE, so removing the partner alone cascades away
    // every listing, event and pseudonym row this run created.
    await admin
      .from("network_partners")
      .delete()
      .eq("retailer_id", retailerId)
      .eq("partner_key", partnerKey);
    await admin.from("customers").delete().eq("id", customer.id);
  }
});
