import { createSupabaseAdminClient } from "@paon/database";
import { expect, test, type Page } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL, TEST_RETAILER_SLUG } from "./fixtures";

// A genuine minimal 1x1 PNG — same fixture bytes already proven against
// this codebase's own magic-byte validation in tableservice-attachments.spec.ts.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

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

/**
 * FT-02 Silhouette analysis (docs/FOUNDER_TOOL_BLUEPRINTS.md) — the
 * consent/capture session state machine that was, until this slice,
 * entirely unbuilt ("this tool has no camera capture at all"). Proves
 * the customer's own half: explicit consent, real private-bucket
 * upload, the advisor-approved → customer-confirms terminal path, and
 * withdrawal deleting the capture. The advisor's own review UI is
 * proven separately in apps/retailer/e2e/silhouette-analysis-review.spec.ts;
 * here, "advisor approved" is set directly via admin — the real
 * `decide_silhouette_analysis_candidate` RPC and its authorization
 * boundary is what that other spec exists to prove, not this one.
 */
test("a customer consents, uploads a photo, confirms after advisor approval, and can withdraw a separate request", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("requires local Supabase.");
  }
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  const { data: retailer } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");

  const sessionIds: string[] = [];

  try {
    await signIn(page, admin);
    await page.goto("/silhouette-analysis");
    await expect(
      page.getByRole("heading", { name: "Silhouette analysis" }),
    ).toBeVisible();

    // Explicit consent starts the session — no covert camera start.
    await page
      .getByRole("button", { name: "Start silhouette analysis" })
      .click();
    await expect(page.getByLabel("Photo")).toBeVisible();

    const { data: sessionAfterStart } = await admin
      .from("silhouette_analysis_sessions")
      .select("id, status")
      .eq("retailer_id", retailer.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (!sessionAfterStart) throw new Error("session was not created");
    sessionIds.push(sessionAfterStart.id);
    expect(sessionAfterStart.status).toBe("consented");

    // Real upload through the private bucket + record_silhouette_capture.
    await page.getByLabel("Photo").setInputFiles({
      name: "silhouette.png",
      mimeType: "image/png",
      buffer: PNG,
    });
    await page.getByRole("button", { name: "Send to my advisor" }).click();
    await expect(
      page.getByText("Sent to your advisor for review."),
    ).toBeVisible();

    const { data: captureRow } = await admin
      .from("silhouette_analysis_captures")
      .select("id, storage_path")
      .eq("session_id", sessionAfterStart.id)
      .single();
    if (!captureRow) throw new Error("capture row was not created");
    const { data: storedObject } = await admin.storage
      .from("silhouette-evidence")
      .list(`${retailer.id}/${sessionAfterStart.id}`);
    expect(storedObject?.length ?? 0).toBeGreaterThan(0);

    // Advisor decision — set directly (this spec's own fixture setup,
    // not what's under test here; see file docstring).
    const { error: advisorDecisionError } = await admin
      .from("silhouette_analysis_sessions")
      .update({
        status: "advisor_reviewed",
        advisor_decision: "approved",
        advisor_reviewed_at: new Date().toISOString(),
      })
      .eq("id", sessionAfterStart.id);
    if (advisorDecisionError) throw advisorDecisionError;

    await page.reload();
    await expect(
      page.getByText("Your advisor has reviewed your photo."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByText("Confirmed.")).toBeVisible();

    // A second, independent request that the customer withdraws.
    await page
      .getByRole("button", { name: "Start a new silhouette analysis" })
      .click();
    // Wait for the real round trip to land before querying for it — the
    // click only awaits the browser event, not the Server Action's own
    // commit, so querying immediately after risks a real race against
    // the still-existing first (already-terminal) session.
    await expect(page.getByLabel("Photo")).toBeVisible();
    const { data: secondSession } = await admin
      .from("silhouette_analysis_sessions")
      .select("id")
      .eq("retailer_id", retailer.id)
      .neq("id", sessionAfterStart.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (!secondSession) throw new Error("second session was not created");
    sessionIds.push(secondSession.id);

    await page.getByLabel("Photo").setInputFiles({
      name: "silhouette-2.png",
      mimeType: "image/png",
      buffer: PNG,
    });
    await page.getByRole("button", { name: "Send to my advisor" }).click();
    await expect(
      page.getByText("Sent to your advisor for review."),
    ).toBeVisible();

    await page.getByRole("button", { name: "Withdraw" }).click();
    await expect(page.getByText("You withdrew this request.")).toBeVisible();

    const { data: capturesAfterWithdraw } = await admin
      .from("silhouette_analysis_captures")
      .select("id")
      .eq("session_id", secondSession.id);
    expect(capturesAfterWithdraw ?? []).toHaveLength(0);
  } finally {
    if (sessionIds.length > 0) {
      // Checked, not fire-and-forget: a silently failed cleanup delete
      // leaves orphaned fixture rows for the next run to trip over (see
      // docs/PROJECT_STATE.md's 2026-08-05 handoff on this exact class
      // of bug).
      const { error: captureDeleteError } = await admin
        .from("silhouette_analysis_captures")
        .delete()
        .in("session_id", sessionIds);
      if (captureDeleteError) {
        console.error("cleanup: capture delete failed", captureDeleteError);
      }
      const { error: sessionDeleteError } = await admin
        .from("silhouette_analysis_sessions")
        .delete()
        .in("id", sessionIds);
      if (sessionDeleteError) {
        console.error("cleanup: session delete failed", sessionDeleteError);
      }
      for (const id of sessionIds) {
        const { data: objects } = await admin.storage
          .from("silhouette-evidence")
          .list(`${retailer.id}/${id}`);
        if (objects && objects.length > 0) {
          await admin.storage
            .from("silhouette-evidence")
            .remove(
              objects.map((object) => `${retailer.id}/${id}/${object.name}`),
            );
        }
      }
    }
  }
});
