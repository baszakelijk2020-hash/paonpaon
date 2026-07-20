import { createSupabaseAdminClient } from "@paon/database";
import { expect, test } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL } from "./fixtures";

test("a signed-in shopper messages the retailer and it queues a staff notification email", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

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

  await page.goto("/messages");

  const unique = Date.now();
  const messageBody = `E2E message ${unique}`;

  const openLink = page.getByRole("link", { name: "Open" });
  if (await openLink.isVisible().catch(() => false)) {
    await openLink.click();
    await expect(page).toHaveURL(/\/messages\/[0-9a-f-]+$/);
    await page.getByPlaceholder("Write a message").fill(messageBody);
    await page.getByRole("button", { name: "Send" }).click();
  } else {
    await page.getByPlaceholder("How may the team help?").fill(messageBody);
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page).toHaveURL(/\/messages\/[0-9a-f-]+$/);
  }

  await expect(page.getByText(messageBody)).toBeVisible();

  // send_conversation_message notifies accepted sales-eligible staff,
  // which the enqueue_notification_email trigger (docs/DECISIONS.md
  // ADR-032) turns into a queued email — verifying this end to end
  // through the real UI/RPC path, not a direct table insert, is what
  // actually proves the trigger fires on the production code path.
  const { data: outboxRows, error: outboxError } = await admin
    .from("email_outbox")
    .select("recipient_email, subject, html_body")
    .eq("subject", "New customer message")
    .order("created_at", { ascending: false })
    .limit(1);
  if (outboxError) throw outboxError;
  expect(outboxRows).toHaveLength(1);
  expect(outboxRows[0]?.html_body).toContain(messageBody);
});
