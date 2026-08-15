import { CustomerRepository, createSupabaseAdminClient } from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import {
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
  TEST_RETAILER_SLUG,
} from "./fixtures";
import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "17.9";
const BROWSER_PROOF_SPEC = "apps/retailer/e2e/channel-contact.spec.ts";

// Serial on purpose. Both tests below set a module-level flag, and the single
// afterAll writes the proof artifact only when BOTH are true. Under parallel
// execution Playwright may run them in separate worker processes, each with
// its own module instance — so each worker sees exactly one flag set and
// writes status="failed" even though both tests passed. That is precisely how
// 17.9 came to record a failure while the run reported 3 passed.
test.describe.configure({ mode: "serial" });

let customerCardProofPassed = false;
let sharedThreadProofPassed = false;

test.afterAll(async () => {
  await writeBrowserProofRun({
    phaseItemId: PHASE_ITEM_ID,
    spec: BROWSER_PROOF_SPEC,
    status:
      customerCardProofPassed && sharedThreadProofPassed ? "passed" : "failed",
  });
});

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

/**
 * Proves the omnichannel communication hub's provider-neutral core
 * (PHASE 17.9 / ADV-109) end to end: a customer with a real phone and
 * email gets real SMS/WhatsApp/Email deep links into the advisor's own
 * device (never a PAON-sent message — no provider call, no credentials
 * needed), and a customer with only an email correctly shows SMS/
 * WhatsApp as unavailable rather than a broken or fabricated link.
 */
test("a customer's real contact details produce real channel deep links, and a missing detail shows that channel as unavailable", async ({
  page,
}) => {
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
  const customerRepo = new CustomerRepository(admin);

  const fullContact = await customerRepo.create({
    retailerId,
    fullName: `E2E Channel Full Contact ${unique}`,
    email: `channel-full-${unique}@paon.test`,
    phone: "+1 (555) 234-5678",
    lifecycleStage: "prospect",
  });
  const emailOnly = await customerRepo.create({
    retailerId,
    fullName: `E2E Channel Email Only ${unique}`,
    email: `channel-email-only-${unique}@paon.test`,
    lifecycleStage: "prospect",
  });

  try {
    // Real deep links, built from real contact details.
    await page.goto(`/customers/${fullContact.id}`);
    const buttons = page.locator("[data-channel-contact-buttons]").first();
    await expect(buttons.locator('a[data-channel="sms"]')).toHaveAttribute(
      "href",
      "sms:+15552345678",
    );
    await expect(buttons.locator('a[data-channel="whatsapp"]')).toHaveAttribute(
      "href",
      "https://wa.me/15552345678",
    );
    await expect(buttons.locator('a[data-channel="email"]')).toHaveAttribute(
      "href",
      `mailto:${fullContact.email}`,
    );

    // No phone on file: SMS/WhatsApp render as unavailable spans, never
    // a broken or fabricated link.
    await page.goto(`/customers/${emailOnly.id}`);
    const emailOnlyButtons = page
      .locator("[data-channel-contact-buttons]")
      .first();
    await expect(emailOnlyButtons.locator('a[data-channel="sms"]')).toHaveCount(
      0,
    );
    await expect(
      emailOnlyButtons.locator('span[data-channel="sms"]'),
    ).toBeVisible();
    await expect(
      emailOnlyButtons.locator('a[data-channel="whatsapp"]'),
    ).toHaveCount(0);
    await expect(
      emailOnlyButtons.locator('a[data-channel="email"]'),
    ).toHaveAttribute("href", `mailto:${emailOnly.email}`);

    customerCardProofPassed = true;
  } finally {
    await admin.from("customers").delete().eq("id", fullContact.id);
    await admin.from("customers").delete().eq("id", emailOnly.id);
  }
});

/**
 * Proves the selected thread surface in `messages/page.tsx` reuses the
 * same shared channel links as the customer card: a real retailer-opened
 * conversation for a customer with both phone and email shows all three
 * native contact actions on the active thread.
 */
test("a selected conversation thread exposes the same native channel links", async ({
  page,
}) => {
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
  const customerRepo = new CustomerRepository(admin);
  const customer = await customerRepo.create({
    retailerId,
    fullName: `E2E Channel Thread ${unique}`,
    email: `channel-thread-${unique}@paon.test`,
    phone: "+1 (555) 987-6543",
    lifecycleStage: "prospect",
  });

  let conversationId: string | null = null;
  try {
    await page.goto(`/customers/${customer.id}`);
    await page.getByRole("button", { name: "Message client" }).click();
    await expect(page).toHaveURL(/\/messages\?c=[0-9a-f-]+$/);
    conversationId = new URL(page.url()).searchParams.get("c");
    if (!conversationId) {
      throw new Error("conversation id missing from thread url");
    }

    const buttons = page.locator("[data-channel-contact-buttons]").first();
    await expect(buttons.locator('a[data-channel="sms"]')).toHaveAttribute(
      "href",
      "sms:+15559876543",
    );
    await expect(buttons.locator('a[data-channel="whatsapp"]')).toHaveAttribute(
      "href",
      "https://wa.me/15559876543",
    );
    await expect(buttons.locator('a[data-channel="email"]')).toHaveAttribute(
      "href",
      `mailto:${customer.email}`,
    );

    sharedThreadProofPassed = true;
  } finally {
    if (conversationId) {
      await admin
        .from("messages")
        .delete()
        .eq("conversation_id", conversationId);
      await admin.from("conversations").delete().eq("id", conversationId);
    }
    await admin.from("customers").delete().eq("id", customer.id);
  }
});
