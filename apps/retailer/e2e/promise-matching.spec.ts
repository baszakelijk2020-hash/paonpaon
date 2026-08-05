import { CustomerRepository, createSupabaseAdminClient } from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import {
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
  TEST_RETAILER_SLUG,
} from "./fixtures";
import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "17.5";
const BROWSER_PROOF_SPEC = "apps/retailer/e2e/promise-matching.spec.ts";

let proofPassed = false;

test.afterAll(async () => {
  await writeBrowserProofRun({
    phaseItemId: PHASE_ITEM_ID,
    spec: BROWSER_PROOF_SPEC,
    status: proofPassed ? "passed" : "failed",
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
 * Proves promise-matching on inbound stock news (PHASE 17.5 / ADV-105)
 * end to end: a staff-entered stock update surfaces a real open
 * advisor-commitment promise sharing real words with it, names exactly
 * which words overlapped, offers one-tap contact (mailto), and never
 * surfaces a non-overlapping promise or a dismissed one even though its
 * words would otherwise match.
 */
test("a stock update surfaces the matching open promise, with the overlap named, and never a dismissed or unrelated one", async ({
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

  const matchingCustomer = await customerRepo.create({
    retailerId,
    fullName: `E2E Promise Match Client ${unique}`,
    email: `promise-match-${unique}@paon.test`,
    lifecycleStage: "prospect",
  });
  const unrelatedCustomer = await customerRepo.create({
    retailerId,
    fullName: `E2E Promise Unrelated Client ${unique}`,
    email: `promise-unrelated-${unique}@paon.test`,
    lifecycleStage: "prospect",
  });
  const dismissedCustomer = await customerRepo.create({
    retailerId,
    fullName: `E2E Promise Dismissed Client ${unique}`,
    email: `promise-dismissed-${unique}@paon.test`,
    lifecycleStage: "prospect",
  });

  const { data: matchingOpp, error: matchingError } = await admin
    .from("clienteling_opportunities")
    .insert({
      retailer_id: retailerId,
      customer_id: matchingCustomer.id,
      opportunity_type: "advisor_commitment",
      why_now: "Promised to call about linen jackets",
      suggested_action: "Call once the linen jackets arrive",
      channel: "phone",
      status: "accepted",
      projector_version: "clienteling-opportunity-v1",
    })
    .select("id")
    .single();
  if (matchingError) throw matchingError;

  const { data: unrelatedOpp, error: unrelatedError } = await admin
    .from("clienteling_opportunities")
    .insert({
      retailer_id: retailerId,
      customer_id: unrelatedCustomer.id,
      opportunity_type: "advisor_commitment",
      why_now: "Promised to follow up about silk pocket squares",
      suggested_action: "Call about silk pocket squares",
      channel: "phone",
      status: "accepted",
      projector_version: "clienteling-opportunity-v1",
    })
    .select("id")
    .single();
  if (unrelatedError) throw unrelatedError;

  const { data: dismissedOpp, error: dismissedError } = await admin
    .from("clienteling_opportunities")
    .insert({
      retailer_id: retailerId,
      customer_id: dismissedCustomer.id,
      opportunity_type: "advisor_commitment",
      why_now: "Promised to call about linen jackets, now dismissed",
      suggested_action: "Call once the linen jackets arrive, now dismissed",
      channel: "phone",
      status: "dismissed",
      projector_version: "clienteling-opportunity-v1",
    })
    .select("id")
    .single();
  if (dismissedError) throw dismissedError;

  try {
    await page.goto("/promise-matching");
    await page
      .getByLabel("Stock update")
      .fill("New linen jackets arrived, sizes 40-44");
    await page.getByRole("button", { name: "Find matching promises" }).click();

    const matchCard = page.locator("li", {
      hasText: matchingCustomer.fullName,
    });
    await expect(matchCard).toBeVisible();
    await expect(matchCard.getByText("linen", { exact: true })).toBeVisible();
    await expect(matchCard.getByText("jackets", { exact: true })).toBeVisible();
    await expect(
      matchCard.getByRole("link", {
        name: `Email ${matchingCustomer.fullName.split(" ")[0]}`,
      }),
    ).toHaveAttribute("href", `mailto:${matchingCustomer.email}`);

    await expect(page.getByText(unrelatedCustomer.fullName)).toHaveCount(0);
    await expect(page.getByText(dismissedCustomer.fullName)).toHaveCount(0);

    proofPassed = true;
  } finally {
    await admin
      .from("clienteling_opportunities")
      .delete()
      .in("id", [matchingOpp!.id, unrelatedOpp!.id, dismissedOpp!.id]);
    await admin
      .from("customers")
      .delete()
      .in("id", [
        matchingCustomer.id,
        unrelatedCustomer.id,
        dismissedCustomer.id,
      ]);
  }
});
