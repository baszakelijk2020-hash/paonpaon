import { createSupabaseAdminClient } from "@paon/database";
import { expect, test } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL, TEST_RETAILER_SLUG } from "./fixtures";
import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "15.2";
const BROWSER_PROOF_SPEC = "apps/customer/e2e/concierge.spec.ts";

let proofPassed = false;

test.afterAll(async () => {
  await writeBrowserProofRun({
    phaseItemId: PHASE_ITEM_ID,
    spec: BROWSER_PROOF_SPEC,
    status: proofPassed ? "passed" : "failed",
  });
});

/**
 * Proves PHASE 15.2's own named gap: the concierge request surface, which
 * deliberately works with no money design at all (checkConciergeRequest
 * refuses only a request that would move money) so it is not blocked on
 * ADR-062 the way the reward half of this item is.
 */
test("a customer sends a concierge request, and a too-short one is refused", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  const { data: retailer } = await admin
    .from("retailers")
    .select("id, display_name")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");

  const { data: customerRow } = await admin
    .from("customers")
    .select("id")
    .eq("retailer_id", retailer.id)
    .eq("email", TEST_CUSTOMER_EMAIL)
    .maybeSingle();
  if (!customerRow) throw new Error("fixture customer missing");

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

  let sentMessageId: string | undefined;
  try {
    await page.goto("/concierge");

    // ---- a too-short request is refused with a readable reason ---------
    // The textarea's own minlength=10 blocks a short submission natively
    // in the browser before it ever reaches the server -- same convention
    // as ObservationForm elsewhere in this codebase. Padding with
    // leading/trailing whitespace clears that raw-length gate (11 chars)
    // while still failing checkConciergeRequest's trim()-based check
    // server-side (1 real character), so this proves the SERVER refusal
    // rather than merely re-proving the browser's own HTML5 validation.
    await page.getByLabel("What would you like arranged?").fill("          x");
    await page.getByRole("button", { name: "Send request" }).click();
    await expect(
      page.getByText("Say a little more about what you'd like arranged."),
    ).toBeVisible();

    // ---- a real request sends a real message ----------------------------
    const detailText = `Collect my order and hold it at the front desk ${Date.now()}.`;
    await page.getByLabel("What would you like arranged?").fill(detailText);
    await page.getByRole("button", { name: "Send request" }).click();

    await expect(page.getByText("Your request has been sent.")).toBeVisible();
    const href = await page
      .getByRole("link", { name: "View the conversation →" })
      .getAttribute("href");
    expect(href).toBeTruthy();
    const conversationId = href!.split("=").pop()!;

    const { data: conversation } = await admin
      .from("conversations")
      .select("id, customer_id, retailer_id")
      .eq("id", conversationId)
      .single();
    expect(conversation?.customer_id).toBe(customerRow.id);
    expect(conversation?.retailer_id).toBe(retailer.id);

    const { data: messages } = await admin
      .from("messages")
      .select("id, body, sender_type")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(1);
    sentMessageId = messages?.[0]?.id;
    expect(messages?.[0]?.sender_type).toBe("customer");
    expect(messages?.[0]?.body).toBe(`Concierge request: ${detailText}`);

    proofPassed = true;
  } finally {
    if (sentMessageId) {
      await admin.from("messages").delete().eq("id", sentMessageId);
    }
  }
});
