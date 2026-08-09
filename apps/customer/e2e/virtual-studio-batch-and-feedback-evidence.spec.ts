import {
  createSupabaseAdminClient,
  OutfitRepository,
  StylePortraitConsentRepository,
  StylePortraitRepository,
} from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test, type Page } from "@playwright/test";

import {
  TEST_CUSTOMER_EMAIL,
  TEST_PRODUCT_SLUG,
  TEST_RETAILER_SLUG,
} from "./fixtures";
import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "4.10-customer-batch-and-feedback-evidence";
const BROWSER_PROOF_SPEC =
  "apps/customer/e2e/virtual-studio-batch-and-feedback-evidence.spec.ts";

// A genuine minimal 1x1 PNG — same fixture bytes already proven against
// this codebase's own magic-byte validation (silhouette-analysis.spec.ts,
// virtual-studio.spec.ts).
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

let proofPassed = false;

test.afterAll(async () => {
  await writeBrowserProofRun({
    phaseItemId: PHASE_ITEM_ID,
    spec: BROWSER_PROOF_SPEC,
    status: proofPassed ? "passed" : "failed",
  });
});

/**
 * Virtual Wardrobe Studio multi-look queue and personalization loop
 * (VWS-001 / PHASE 4.10 / blueprint §5, §7) — "Create all saved looks"
 * enqueues every one of the customer's own saved (non-roadmap) outfits
 * deterministically, "Cancel all queued" bulk-cancels them, and
 * love_it/not_for_me feedback on a ready look feeds
 * `customer_style_preference_evidence` through the canonical evidence RPC
 * (generation_loved/generation_rejected), exactly like a product favorite
 * or skip does today — no second preference-evidence system. This
 * sandbox has no OPENAI_API_KEY, so batch-enqueued jobs are proven to
 * reach and stay `queued`; the single look reviewed for feedback is
 * fixtured directly as `ready` (bypassing the queue/provider), same
 * posture as `roadmap-look-review.spec.ts` — that spec's job is proving
 * the review UI and evidence wiring, not re-proving generation.
 */
test("batch-enqueues saved looks deterministically, bulk-cancels them, and feeds StyleProfile evidence from look feedback", async ({
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
  const retailerId = asId<"RetailerId">(retailer.id);

  const { data: customerRow } = await admin
    .from("customers")
    .select("id")
    .eq("retailer_id", retailerId)
    .eq("email", TEST_CUSTOMER_EMAIL)
    .single();
  if (!customerRow) throw new Error("fixture customer missing");
  const customerId = asId<"CustomerId">(customerRow.id);

  const { data: product } = await admin
    .from("products")
    .select("id")
    .eq("retailer_id", retailerId)
    .eq("slug", TEST_PRODUCT_SLUG)
    .single();
  if (!product) throw new Error("fixture product missing");
  const consent = await new StylePortraitConsentRepository(admin).grant(
    retailerId,
    customerId,
  );
  expect(consent.status).toBe("granted");
  expect(consent.disclosuresAcknowledged).toBe(true);

  // A reviewed, accepted style concept on the fixture product — the exact
  // accepted-taxonomy shape `findAcceptedConceptIdsForProduct` reads,
  // same fixture pattern as swipe-deck.spec.ts.
  const conceptSlug = "e2e-vws-feedback-tailored-shoulder";
  let { data: concept } = await admin
    .from("metadata_concepts")
    .select("id")
    .eq("retailer_id", retailerId)
    .eq("kind", "style")
    .eq("slug", conceptSlug)
    .maybeSingle();
  if (!concept) {
    const { data: created, error: conceptError } = await admin
      .from("metadata_concepts")
      .insert({
        retailer_id: retailerId,
        kind: "style",
        slug: conceptSlug,
        canonical_name: "Tailored shoulder",
        attributes: {},
        active: true,
      })
      .select("id")
      .single();
    if (conceptError) throw conceptError;
    concept = created;
  } else {
    const { error: activateError } = await admin
      .from("metadata_concepts")
      .update({ active: true, deleted_at: null })
      .eq("id", concept.id);
    if (activateError) throw activateError;
  }
  const { data: reviewer } = await admin
    .from("retailer_staff_members")
    .select("id")
    .eq("retailer_id", retailerId)
    .limit(1)
    .single();
  if (!reviewer) throw new Error("fixture metadata reviewer missing");
  await admin
    .from("entity_metadata_assignments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("retailer_id", retailerId)
    .eq("concept_id", concept.id)
    .eq("target_id", product.id)
    .is("deleted_at", null);
  const { error: assignmentError } = await admin
    .from("entity_metadata_assignments")
    .insert({
      retailer_id: retailerId,
      target_type: "product",
      target_id: product.id,
      concept_id: concept.id,
      source: "paon",
      confidence: 1,
      review_status: "accepted",
      evidence: { summary: "E2E reviewed VWS feedback-evidence fixture" },
      reviewed_by_staff_id: reviewer.id,
      reviewed_at: new Date().toISOString(),
    });
  if (assignmentError) throw assignmentError;

  await admin
    .from("customer_style_preference_evidence")
    .delete()
    .eq("customer_id", customerId)
    .eq("concept_id", concept.id);
  const { error: consentError } = await admin
    .from("customer_preferences")
    .upsert(
      {
        customer_id: customerId,
        personalization_opt_in: true,
        personalization_withdrawn_at: null,
      },
      { onConflict: "customer_id" },
    );
  if (consentError) throw consentError;

  // Approved Style Portrait so batch enqueue reaches the queue rather than
  // the "no approved Style Portrait" error path — same fixture pattern as
  // visual-roadmap.spec.ts.
  const stylePortraitRepo = new StylePortraitRepository(admin);
  const unique = Date.now();
  const facePath = `${retailerId}/${customerId}/references/e2e-face-${unique}.png`;
  const fullBodyPath = `${retailerId}/${customerId}/references/e2e-body-${unique}.png`;
  const { error: faceUploadError } = await admin.storage
    .from("wardrobe-studio")
    .upload(facePath, PNG, { contentType: "image/png" });
  if (faceUploadError) throw faceUploadError;
  const { error: bodyUploadError } = await admin.storage
    .from("wardrobe-studio")
    .upload(fullBodyPath, PNG, { contentType: "image/png" });
  if (bodyUploadError) throw bodyUploadError;
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

  const outfitRepo = new OutfitRepository(admin);
  const outfitOne = await outfitRepo.createByCustomer(
    {
      retailerId,
      customerId,
      title: `E2E Batch Look One ${unique}`,
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
      title: `E2E Batch Look Two ${unique}`,
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
  const outfitIds: string[] = [outfitOne.id, outfitTwo.id];

  let readyJobId: string | null = null;

  try {
    await signIn(page, admin);
    await page.goto("/wardrobe");
    await expect(page.getByText(outfitOne.title)).toBeVisible();
    await expect(page.getByText(outfitTwo.title)).toBeVisible();

    // --- Batch enqueue: "Create all saved looks" ---
    await page.getByRole("button", { name: "Create all saved looks" }).click();
    await expect(page.getByText("2 looks enqueued.")).toBeVisible();

    const { data: queuedJobs } = await admin
      .from("wardrobe_visualization_jobs")
      .select("id, status, outfit_id, created_at")
      .in("outfit_id", outfitIds)
      .order("created_at", { ascending: true });
    if (!queuedJobs || queuedJobs.length !== 2) {
      throw new Error("batch enqueue did not create exactly two jobs");
    }
    expect(queuedJobs.every((job) => job.status === "queued")).toBe(true);
    expect(new Set(queuedJobs.map((job) => job.outfit_id))).toEqual(
      new Set(outfitIds),
    );

    // --- Determinism: the queue claims in (created_at, id) order, not
    // just created_at — proven directly against the RPC rather than via
    // the UI, since this sandbox has no provider to actually drain jobs. ---
    const { data: claimed, error: claimError } = await admin.rpc(
      "claim_pending_wardrobe_visualization_jobs",
      { p_limit: 10 },
    );
    if (claimError) throw claimError;
    const claimedForFixture = (claimed ?? []).filter(
      (job) => job.outfit_id !== null && outfitIds.includes(job.outfit_id),
    );
    expect(claimedForFixture.map((job) => job.id)).toEqual(
      queuedJobs.map((job) => job.id),
    );
    expect(claimedForFixture.every((job) => job.status === "generating")).toBe(
      true,
    );
    // Return both jobs to `queued` so "Cancel all queued" below has
    // something real to cancel — this spec proves the customer-facing
    // cancel path, not the runner's own completion path.
    const { error: revertError } = await admin
      .from("wardrobe_visualization_jobs")
      .update({ status: "queued" })
      .in(
        "id",
        claimedForFixture.map((job) => job.id),
      );
    if (revertError) throw revertError;

    // --- Bulk cancel: "Cancel all queued" ---
    await page.reload();
    await page.getByRole("button", { name: "Cancel all queued" }).click();
    await expect(page.getByText("2 queued looks cancelled.")).toBeVisible();

    const { data: cancelledJobs } = await admin
      .from("wardrobe_visualization_jobs")
      .select("status")
      .in("outfit_id", outfitIds);
    expect(
      (cancelledJobs ?? []).every((job) => job.status === "cancelled"),
    ).toBe(true);

    // --- Feedback -> StyleProfile evidence wiring ---
    // Fixture the first look's generation as ready directly, bypassing
    // the queue/provider — this section's job is proving the
    // feedback-to-evidence wire, not re-proving generation.
    const generatedPath = `${retailerId}/${customerId}/generations/e2e-${unique}.png`;
    const { error: uploadGenError } = await admin.storage
      .from("wardrobe-studio")
      .upload(generatedPath, PNG, { contentType: "image/png" });
    if (uploadGenError) throw uploadGenError;
    const { data: presetRow } = await admin
      .from("retailer_visual_presets")
      .select("id")
      .eq("retailer_id", retailerId)
      .eq("is_default", true)
      .single();
    if (!presetRow) throw new Error("fixture retailer has no default preset");
    const { data: readyJobRow, error: readyJobError } = await admin
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
        input_hash: `fixture-feedback-${unique}`,
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
    const lookOneCard = page.locator("li", { hasText: outfitOne.title });
    await expect(lookOneCard).toBeVisible();
    await lookOneCard.getByRole("button", { name: "Love it" }).click();

    await expect
      .poll(async () => {
        const { data } = await admin
          .from("customer_style_preference_evidence")
          .select("source, polarity, confidence")
          .eq("customer_id", customerId)
          .eq("concept_id", concept.id)
          .is("suppressed_at", null);
        return data;
      })
      .toEqual([
        expect.objectContaining({
          source: "generation_loved",
          polarity: "positive",
        }),
      ]);

    await expect
      .poll(async () => {
        const { data: profile } = await admin
          .from("customer_style_profiles")
          .select("inferred_preferences")
          .eq("customer_id", customerId)
          .single();
        const inferred = Array.isArray(profile?.inferred_preferences)
          ? profile.inferred_preferences
          : [];
        return inferred.some(
          (entry) =>
            typeof entry === "object" &&
            entry !== null &&
            "conceptId" in entry &&
            entry.conceptId === concept.id &&
            "polarity" in entry &&
            entry.polarity === "positive",
        );
      })
      .toBe(true);

    // "Not for me" on the same ready look flips the evidence to a second,
    // distinct row rather than mutating the first — real evidence history,
    // not an overwrite.
    await lookOneCard.getByRole("button", { name: "Not for me" }).click();
    await expect
      .poll(async () => {
        const { data } = await admin
          .from("customer_style_preference_evidence")
          .select("source, polarity")
          .eq("customer_id", customerId)
          .eq("concept_id", concept.id)
          .is("suppressed_at", null)
          .order("created_at", { ascending: true });
        return data;
      })
      .toEqual([
        expect.objectContaining({
          source: "generation_loved",
          polarity: "positive",
        }),
        expect.objectContaining({
          source: "generation_rejected",
          polarity: "negative",
        }),
      ]);

    proofPassed = true;
  } finally {
    if (readyJobId) {
      await admin
        .from("wardrobe_visualization_feedback")
        .delete()
        .eq("job_id", readyJobId);
      await admin
        .from("wardrobe_visualization_jobs")
        .delete()
        .eq("id", readyJobId);
      await admin.storage
        .from("wardrobe-studio")
        .remove([`${retailerId}/${customerId}/generations/e2e-${unique}.png`]);
    }
    await admin
      .from("wardrobe_visualization_jobs")
      .delete()
      .in("outfit_id", outfitIds);
    await admin.from("outfit_slots").delete().in("outfit_id", outfitIds);
    await admin.from("outfits").delete().in("id", outfitIds);
    await admin
      .from("customer_style_preference_evidence")
      .delete()
      .eq("customer_id", customerId)
      .eq("concept_id", concept.id);
    await admin
      .from("style_portrait_references")
      .delete()
      .eq("style_portrait_id", portrait.id);
    await admin
      .from("style_portrait_consents")
      .delete()
      .eq("customer_id", customerId);
    await admin.storage
      .from("wardrobe-studio")
      .remove([facePath, fullBodyPath]);
    await admin.from("style_portraits").delete().eq("id", portrait.id);
  }
});
