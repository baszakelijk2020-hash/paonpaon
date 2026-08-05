import {
  createSupabaseAdminClient,
  createSupabaseDirectClient,
  SilhouetteAnalysisRepository,
} from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import {
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
  TEST_RETAILER_SLUG,
} from "./fixtures";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

/**
 * FT-02 Silhouette analysis (docs/FOUNDER_TOOL_BLUEPRINTS.md) — the
 * advisor's own half: reviewing a real candidate a customer submitted
 * and approving it. Fixture setup (the "customer already submitted a
 * photo" state) goes through the real customer-facing RPCs via a
 * directly authenticated shopper client — same precedent as
 * suit-configuration-intents.spec.ts — not a raw table insert, so the
 * capture this test reviews is exactly what the real upload flow
 * produces. The decision itself (`decide_silhouette_analysis_candidate`,
 * with its own `is_alterations_advisor()` authorization check) is
 * proven for real through the browser, not simulated.
 */
test("an advisor approves a client's submitted silhouette photo", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  const anonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    throw new Error("requires local Supabase.");
  }

  const unique = Date.now();
  const shopperEmail = `silhouette-shopper-${unique}@paon.test`;
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  const { data: retailer } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");

  const { error: createUserError } = await admin.auth.admin.createUser({
    email: shopperEmail,
    email_confirm: true,
  });
  if (createUserError) throw createUserError;
  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email: shopperEmail,
    });
  if (linkError || !linkData.properties) {
    throw new Error(
      `Failed to generate magic link: ${linkError?.message ?? "unknown error"}`,
    );
  }
  const shopperClient = createSupabaseDirectClient(supabaseUrl, anonKey);
  const { error: verifyError } = await shopperClient.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "magiclink",
  });
  if (verifyError) throw verifyError;

  const shopperRepo = new SilhouetteAnalysisRepository(shopperClient);
  const sessionId = await shopperRepo.startSession(
    asId<"RetailerId">(retailer.id),
  );
  await shopperRepo.beginCapture(sessionId);
  await shopperRepo.uploadCapture(sessionId, {
    retailerId: asId<"RetailerId">(retailer.id),
    fileName: "silhouette.png",
    mimeType: "image/png",
    sizeBytes: PNG.byteLength,
    content: PNG.buffer.slice(
      PNG.byteOffset,
      PNG.byteOffset + PNG.byteLength,
    ) as ArrayBuffer,
  });

  const { data: customerRow } = await admin
    .from("customers")
    .select("id")
    .eq("retailer_id", retailer.id)
    .eq("email", shopperEmail)
    .single();
  if (!customerRow) throw new Error("self-created customer not found");

  try {
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
    await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
    await page.getByRole("button", { name: "Enter the atelier" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto(`/customers/${customerRow.id}`);
    await expect(page.getByText("Awaiting your review")).toBeVisible();
    await expect(
      page.getByRole("img", { name: "Client submission" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Approve" }).click();
    // This page's writes don't visibly reflect via the Server Action's
    // own automatic revalidation without a reload — same established
    // pattern as advisor-capture.spec.ts on this exact page (which
    // polls the database rather than the DOM right after its own
    // clicks, then reloads before checking rendered text).
    await page.reload();
    await expect(
      page.getByText("Approved — awaiting client confirmation"),
    ).toBeVisible();

    const { data: sessionAfter } = await admin
      .from("silhouette_analysis_sessions")
      .select("status, advisor_decision")
      .eq("id", sessionId)
      .single();
    expect(sessionAfter?.status).toBe("advisor_reviewed");
    expect(sessionAfter?.advisor_decision).toBe("approved");
  } finally {
    await admin
      .from("silhouette_analysis_captures")
      .delete()
      .eq("session_id", sessionId);
    await admin
      .from("silhouette_analysis_sessions")
      .delete()
      .eq("id", sessionId);
    const { data: objects } = await admin.storage
      .from("silhouette-evidence")
      .list(`${retailer.id}/${sessionId}`);
    if (objects && objects.length > 0) {
      await admin.storage
        .from("silhouette-evidence")
        .remove(
          objects.map((object) => `${retailer.id}/${sessionId}/${object.name}`),
        );
    }
  }
});
