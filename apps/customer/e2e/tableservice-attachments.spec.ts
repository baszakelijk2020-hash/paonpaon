import { createSupabaseAdminClient } from "@paon/database";
import { expect, test, type Page } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL, TEST_RETAILER_SLUG } from "./fixtures";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF");

async function attachFile(
  page: Page,
  menuLabel: string,
  file: { name: string; mimeType: string; buffer: Buffer },
) {
  await page.locator("#gcw-paperclip").click();
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: menuLabel }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(file);
  await page
    .getByLabel("I may share this material for this private consultation.")
    .check();
}

async function sendWidgetMessage(page: Page, body: string) {
  await page.getByPlaceholder("Type a message...").fill(body);
  await page.locator("#gcw-send").click();
  await expect(page.getByText(body, { exact: true })).toBeVisible();
}

async function signIn(
  page: Page,
  admin: ReturnType<typeof createSupabaseAdminClient>,
): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: TEST_CUSTOMER_EMAIL,
    });
    if (error || !data.properties) {
      throw error ?? new Error("magic link missing");
    }
    await page.goto(
      `/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`,
    );
    const hasAuthCookie = (await page.context().cookies()).some(
      (cookie) =>
        cookie.name.startsWith("sb-") &&
        cookie.name.includes("auth-token") &&
        !cookie.name.includes("code-verifier"),
    );
    const isCustomerDashboard = await page
      .getByRole("button", { name: "Sign out" })
      .isVisible();
    if (
      /\/dashboard$/.test(page.url()) &&
      hasAuthCookie &&
      isCustomerDashboard
    ) {
      return;
    }
  }
  throw new Error(`local magic-link sign-in did not complete: ${page.url()}`);
}

test("TableService sends each founder attachment type into the private advisor conversation", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("TableService attachment proof requires local Supabase.");
  }
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
  const { data: retailer } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");
  const { data: customer } = await admin
    .from("customers")
    .select("id")
    .eq("retailer_id", retailer.id)
    .eq("email", TEST_CUSTOMER_EMAIL)
    .single();
  if (!customer) throw new Error("fixture customer missing");

  await signIn(page, admin);

  const startedAt = new Date().toISOString();
  await page.goto(`/r/${TEST_RETAILER_SLUG}`);
  await page.getByRole("button", { name: "Ask us anything" }).click();

  await attachFile(page, "Upload Photo", {
    name: "look.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await sendWidgetMessage(page, "This is the silhouette I like.");
  await expect(page.getByText(/queued for a safety scan/)).toBeVisible();

  await attachFile(page, "Attach Pdf", {
    name: "brief.pdf",
    mimeType: "application/pdf",
    buffer: PDF,
  });
  await sendWidgetMessage(page, "Here is the event brief.");

  await page.locator("#gcw-paperclip").click();
  await page.getByRole("button", { name: "Paste Pinterest Link" }).click();
  await page
    .getByPlaceholder("https://www.pinterest.com/pin/...")
    .fill("https://www.pinterest.com/pin/123#detail");
  await page.getByRole("button", { name: "Use link" }).click();
  await page
    .getByLabel("I may share this material for this private consultation.")
    .check();
  await sendWidgetMessage(page, "This board captures the mood.");

  await attachFile(page, "Upload Wedding Dress fabric", {
    name: "dress-fabric.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await sendWidgetMessage(page, "Please coordinate this fabric.");

  const { data: conversation } = await admin
    .from("conversations")
    .select("id")
    .eq("customer_id", customer.id)
    .single();
  if (!conversation) throw new Error("conversation missing");
  await expect
    .poll(async () => {
      const { data: messages } = await admin
        .from("messages")
        .select("id")
        .eq("conversation_id", conversation.id)
        .gte("created_at", startedAt);
      if (!messages?.length) return [];
      const { data: attachments } = await admin
        .from("message_attachments")
        .select("purpose, source_kind, source_url, rights_basis, scan_status")
        .in(
          "message_id",
          messages.map((message) => message.id),
        )
        .order("created_at");
      return attachments;
    })
    .toEqual([
      expect.objectContaining({
        purpose: "photo",
        source_kind: "upload",
        rights_basis: "customer_consultation",
        scan_status: "pending_scan",
      }),
      expect.objectContaining({
        purpose: "document",
        source_kind: "upload",
        scan_status: "pending_scan",
      }),
      expect.objectContaining({
        purpose: "pinterest_link",
        source_kind: "link",
        source_url: "https://www.pinterest.com/pin/123",
        scan_status: "cleared",
      }),
      expect.objectContaining({
        purpose: "wedding_fabric",
        source_kind: "upload",
        scan_status: "pending_scan",
      }),
    ]);

  await page.goto(`/messages/${conversation.id}`);
  await expect(
    page.getByText(/look.png — queued for safety scan/),
  ).toBeVisible();
  await expect(
    page.getByText(/brief.pdf — queued for safety scan/),
  ).toBeVisible();
  await expect(
    page.getByText("Pinterest reference", { exact: true }).last(),
  ).toBeVisible();
  await expect(
    page.getByText(/dress-fabric.png — queued for safety scan/),
  ).toBeVisible();

  const { data: uploadRows } = await admin
    .from("message_attachments")
    .select("id, file_name")
    .in(
      "message_id",
      (
        await admin
          .from("messages")
          .select("id")
          .eq("conversation_id", conversation.id)
      ).data?.map((message) => message.id) ?? [],
    );
  const photo = uploadRows?.find((row) => row.file_name === "look.png");
  if (!photo) throw new Error("queued photo attachment missing");
  const { data: jobs } = await admin.rpc(
    "claim_pending_message_attachment_scan_jobs",
    { p_limit: 10 },
  );
  const job = jobs?.find((row) => row.attachment_id === photo.id);
  if (!job) throw new Error("queued attachment scan job missing");
  await admin.rpc("complete_message_attachment_scan_job", {
    p_job_id: job.id,
    p_status: "failed",
    p_error_message: "Scanner temporarily unavailable",
  });
  await page.reload();
  await expect(page.getByText(/safety scan failed/)).toBeVisible();
  await page.getByRole("button", { name: "Retry scan" }).click();
  await expect
    .poll(async () => {
      const { data } = await admin
        .from("message_attachments")
        .select("scan_status")
        .eq("id", photo.id)
        .single();
      return data?.scan_status;
    })
    .toBe("pending_scan");
});

test("TableService retains an unsafe draft and writes no attachment", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
  await signIn(page, admin);
  await page.goto(`/r/${TEST_RETAILER_SLUG}`);
  await page.getByRole("button", { name: "Ask us anything" }).click();

  const before = await admin
    .from("message_attachments")
    .select("*", { count: "exact", head: true });
  await attachFile(page, "Upload Photo", {
    name: "spoofed.jpg",
    mimeType: "image/jpeg",
    buffer: PDF,
  });
  await page.getByPlaceholder("Type a message...").fill("Unsafe file test");
  await page.locator("#gcw-send").click();
  await expect(
    page.getByText("File contents do not match the declared type."),
  ).toBeVisible();
  await expect(page.getByText("spoofed.jpg", { exact: true })).toBeVisible();
  const after = await admin
    .from("message_attachments")
    .select("*", { count: "exact", head: true });
  expect(after.count).toBe(before.count);
});
