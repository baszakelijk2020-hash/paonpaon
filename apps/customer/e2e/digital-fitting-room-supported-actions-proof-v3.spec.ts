import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import {
  OutfitRepository,
  StylePortraitConsentRepository,
  StylePortraitRepository,
  createSupabaseAdminClient,
} from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test, type Page } from "@playwright/test";

import {
  TEST_CUSTOMER_EMAIL,
  TEST_PRODUCT_SLUG,
  TEST_RETAILER_SLUG,
} from "./fixtures";

/**
 * Digital Fitting Room — currently-rendered supported-actions proof.
 *
 * Covers only DFR actions that are actually rendered today, each backed by
 * a real existing Server Action (apps/customer/app/(dashboard)/
 * digital-fitting-room/virtual-studio-actions.ts) — no invented behaviour:
 *
 *  - "Create all saved looks" (generateAllSavedLooks) really enqueues one
 *    real `wardrobe_visualization_jobs` row per saved outfit;
 *  - "Cancel all queued" (cancelAllQueuedLooks) really cancels them;
 *  - "Love it" (recordLookFeedback) on a real `ready` job really writes a
 *    real feedback row.
 *
 * This sandbox has no OPENAI_API_KEY, so the enqueue/cancel proof stays at
 * `queued`/`cancelled` (the customer-facing path, not the provider's own
 * completion path — same posture as virtual-studio-batch-and-feedback-
 * evidence.spec.ts / roadmap-look-review.spec.ts); the "ready" state
 * exercised for feedback is fixtured directly, bypassing generation.
 */

const EVIDENCE_SUBPATH =
  "../../../docs/evidence/runs/customer-v3-dfr-supported-actions-proof";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

function admin() {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
}

async function signIn(page: Page): Promise<void> {
  const { data, error } = await admin().auth.admin.generateLink({
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
}

test("Digital Fitting Room: batch generate, bulk cancel, and look feedback are real and working", async ({
  page,
}, testInfo) => {
  const evidenceDir = resolve(testInfo.config.rootDir, EVIDENCE_SUBPATH);
  await mkdir(evidenceDir, { recursive: true });

  // Real page/script errors fail the test. React hydration error #418 is a
  // pre-existing, out-of-scope condition on this route's `page.reload()`
  // (same documented class already filtered in
  // apps/customer/e2e/customer-cta-squircle-v3.spec.ts) — this test-only
  // task may not touch application code, so it is filtered here rather
  // than silently ignored or used to weaken the real functional
  // assertions below (all of which are DB-verified, not UI-only).
  const IGNORED_CONSOLE = /Minified React error #418/i;
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    if (IGNORED_CONSOLE.test(text)) return;
    consoleErrors.push(text);
  });
  page.on("pageerror", (e) => {
    if (IGNORED_CONSOLE.test(String(e))) return;
    consoleErrors.push(`pageerror: ${String(e)}`);
  });

  const client = admin();
  const { data: retailer } = await client
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");
  const retailerId = asId<"RetailerId">(retailer.id);

  const { data: customerRow } = await client
    .from("customers")
    .select("id")
    .eq("retailer_id", retailerId)
    .eq("email", TEST_CUSTOMER_EMAIL)
    .single();
  if (!customerRow) throw new Error("fixture customer missing");
  const customerId = asId<"CustomerId">(customerRow.id);

  const { data: product } = await client
    .from("products")
    .select("id")
    .eq("retailer_id", retailerId)
    .eq("slug", TEST_PRODUCT_SLUG)
    .single();
  if (!product) throw new Error("fixture product missing");

  await new StylePortraitConsentRepository(client).grant(retailerId, customerId);

  const unique = Date.now();
  const facePath = `${retailerId}/${customerId}/references/e2e-dfr-actions-face-${unique}.png`;
  const fullBodyPath = `${retailerId}/${customerId}/references/e2e-dfr-actions-body-${unique}.png`;
  const { error: faceUploadError } = await client.storage
    .from("wardrobe-studio")
    .upload(facePath, PNG, { contentType: "image/png" });
  if (faceUploadError) throw faceUploadError;
  const { error: bodyUploadError } = await client.storage
    .from("wardrobe-studio")
    .upload(fullBodyPath, PNG, { contentType: "image/png" });
  if (bodyUploadError) throw bodyUploadError;

  const stylePortraitRepo = new StylePortraitRepository(client);
  const portrait = await stylePortraitRepo.create({
    retailerId,
    customerId,
    references: [
      { kind: "face", storageBucket: "wardrobe-studio", storagePath: facePath },
      {
        kind: "full_body",
        storageBucket: "wardrobe-studio",
        storagePath: fullBodyPath,
      },
    ],
  });
  await stylePortraitRepo.approve(portrait.id);

  const outfitRepo = new OutfitRepository(client);
  const outfitOne = await outfitRepo.createByCustomer(
    {
      retailerId,
      customerId,
      title: `E2E DFR Actions Look One ${unique}`,
      isSuggestionGeneration: false,
      slots: [
        {
          slotKind: "jacket",
          label: "jacket",
          available: true,
          displayOrder: 0,
          productId: product.id,
        },
      ],
    },
    customerId,
  );
  const outfitTwo = await outfitRepo.createByCustomer(
    {
      retailerId,
      customerId,
      title: `E2E DFR Actions Look Two ${unique}`,
      isSuggestionGeneration: false,
      slots: [
        {
          slotKind: "trousers",
          label: "trousers",
          available: true,
          displayOrder: 0,
          productId: product.id,
        },
      ],
    },
    customerId,
  );
  const outfitIds = [outfitOne.id, outfitTwo.id];
  let readyJobId: string | null = null;
  const generatedPath = `${retailerId}/${customerId}/generations/e2e-dfr-actions-${unique}.png`;

  try {
    await page.setViewportSize({ width: 1512, height: 982 });
    await signIn(page);

    const response = await page.goto("/digital-fitting-room?step=avatar", {
      waitUntil: "networkidle",
    });
    expect(response?.status()).toBe(200);
    await expect(page.getByText(outfitOne.title).first()).toBeVisible();
    await expect(page.getByText(outfitTwo.title).first()).toBeVisible();

    // --- "Create all saved looks" (generateAllSavedLooks): real enqueue. ---
    await page.getByRole("button", { name: "Create all saved looks" }).click();
    await expect(page.getByText("2 looks enqueued.")).toBeVisible();

    const { data: queuedJobs } = await client
      .from("wardrobe_visualization_jobs")
      .select("id, status, outfit_id")
      .in("outfit_id", outfitIds);
    expect(queuedJobs?.length).toBe(2);
    expect(queuedJobs?.every((job) => job.status === "queued")).toBe(true);

    await page.screenshot({
      path: resolve(evidenceDir, "desktop-batch-enqueued-1512x982.png"),
      fullPage: true,
    });

    // --- "Cancel all queued" (cancelAllQueuedLooks): real cancel. ---
    await page.reload();
    await page.getByRole("button", { name: "Cancel all queued" }).click();
    await expect(page.getByText("2 queued looks cancelled.")).toBeVisible();

    const { data: cancelledJobs } = await client
      .from("wardrobe_visualization_jobs")
      .select("status")
      .in("outfit_id", outfitIds);
    expect(cancelledJobs?.every((job) => job.status === "cancelled")).toBe(
      true,
    );

    // --- "Love it" (recordLookFeedback) on a real ready job. ---
    // Fixture the generation as ready directly, bypassing the provider —
    // this proves the feedback action's own wiring, not generation itself.
    const { error: uploadGenError } = await client.storage
      .from("wardrobe-studio")
      .upload(generatedPath, PNG, { contentType: "image/png" });
    if (uploadGenError) throw uploadGenError;
    const { data: presetRow } = await client
      .from("retailer_visual_presets")
      .select("id")
      .eq("retailer_id", retailerId)
      .eq("is_default", true)
      .single();
    if (!presetRow) throw new Error("fixture retailer has no default preset");
    const { data: readyJobRow, error: readyJobError } = await client
      .from("wardrobe_visualization_jobs")
      .insert({
        retailer_id: retailerId,
        customer_id: customerId,
        outfit_id: outfitOne.id,
        style_portrait_id: portrait.id,
        retailer_visual_preset_id: presetRow.id,
        provider: "openai",
        model: "dall-e-3",
        input_snapshot: { fixture: true },
        input_hash: `fixture-dfr-actions-${unique}`,
        status: "ready",
        attempt: 1,
        output_storage_bucket: "wardrobe-studio",
        output_storage_path: generatedPath,
      })
      .select("id")
      .single();
    if (readyJobError || !readyJobRow) throw readyJobError;
    readyJobId = readyJobRow.id;

    await page.reload();
    // Select outfitOne (the one with the real ready job) so it becomes the
    // active outfit — "Love it" renders only for the active outfit's ready
    // job.
    await page
      .getByRole("button", {
        name: new RegExp(outfitOne.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      })
      .click();
    const loveIt = page.getByRole("button", { name: "Love it" });
    await expect(loveIt).toBeVisible();
    await loveIt.click();

    await expect
      .poll(async () => {
        const { data } = await client
          .from("wardrobe_visualization_feedback")
          .select("id")
          .eq("job_id", readyJobId!);
        return data?.length ?? 0;
      })
      .toBeGreaterThan(0);

    await page.screenshot({
      path: resolve(evidenceDir, "desktop-look-feedback-1512x982.png"),
      fullPage: true,
    });

    // Mobile capture of the same working ready-look feedback surface.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: resolve(evidenceDir, "mobile-look-feedback-390x844.png"),
      fullPage: true,
    });

    expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
  } finally {
    if (readyJobId) {
      await client
        .from("wardrobe_visualization_feedback")
        .delete()
        .eq("job_id", readyJobId);
      await client.storage.from("wardrobe-studio").remove([generatedPath]);
    }
    await client
      .from("wardrobe_visualization_jobs")
      .delete()
      .in("outfit_id", outfitIds);
    await client.from("outfit_slots").delete().in("outfit_id", outfitIds);
    await client.from("outfits").delete().in("id", outfitIds);
    await client
      .from("style_portrait_references")
      .delete()
      .eq("style_portrait_id", portrait.id);
    await client
      .from("style_portrait_consents")
      .delete()
      .eq("customer_id", customerId);
    await client.storage.from("wardrobe-studio").remove([facePath, fullBodyPath]);
    await client.from("style_portraits").delete().eq("id", portrait.id);
  }
});
