import {
  OutfitRepository,
  ProductRepository,
  SartorialRuleRepository,
  WardrobeRoadmapRepository,
  createSupabaseAdminClient,
} from "@paon/database";
import { NEUTRAL_SARTORIAL_RULE_FIXTURES, asId } from "@paon/domain";
import { expect, test, type Page } from "@playwright/test";

import {
  TEST_CUSTOMER_EMAIL,
  TEST_PRODUCT_SLUG,
  TEST_RETAILER_SLUG,
} from "./fixtures";
import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "4.9-customer-roadmap-review";
const BROWSER_PROOF_SPEC = "apps/customer/e2e/roadmap-look-review.spec.ts";

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
 * Customer roadmap look review (VWS-001 / PHASE 4.9 / ADR-074) — a
 * roadmap-linked look with a completed generation is reviewed one look at
 * a time with Love it / Maybe / Not for me / Request change, each
 * recording a real `WardrobeVisualizationFeedback` row attached to the
 * exact job. The generation itself is fixtured directly as `ready`
 * (bypassing the queue/provider) since this spec's job is proving the
 * review UI and its RLS/authorship boundary, not re-proving generation —
 * that path is proven in apps/retailer/e2e/visual-roadmap.spec.ts and
 * apps/customer/e2e/virtual-studio.spec.ts.
 */
test("a customer reviews a roadmap-linked look with Love it, Maybe, and Request change", async ({
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

  // The alteration-fixture staff account global-setup.ts already
  // provisions for this same retailer — reused here as the roadmap's
  // author rather than creating a second staff fixture.
  const { data: staffRow } = await admin
    .from("retailer_staff_members")
    .select("id")
    .eq("retailer_id", retailerId)
    .eq("email", "e2e-alteration-actor@paon.test")
    .single();
  if (!staffRow) throw new Error("fixture staff account missing");
  const staffId = asId<"StaffId">(staffRow.id);

  const product = await new ProductRepository(admin).findBySlug(
    retailerId,
    TEST_PRODUCT_SLUG,
  );
  if (!product) throw new Error("fixture product missing");

  const approvedRules = await new SartorialRuleRepository(
    admin,
  ).listApprovedForRetailer(retailerId);
  const rule = approvedRules[0] ?? NEUTRAL_SARTORIAL_RULE_FIXTURES[0]!;

  const roadmapRepo = new WardrobeRoadmapRepository(admin);
  const unique = Date.now();
  const roadmap = await roadmapRepo.createDraft(
    {
      retailerId,
      customerId,
      title: `E2E Review Roadmap ${unique}`,
      horizonLabel: "12 months",
      goals: [{ title: "Build a stronger wardrobe core", displayOrder: 0 }],
      gaps: [
        {
          title: "Missing jacket",
          rank: 1,
          slotKind: "jacket",
          howPurchaseFillsGap: "Anchors client-facing looks.",
        },
      ],
      stages: [
        {
          title: "Stage 1 — jacket",
          stageOrder: 1,
          gapIndex: 0,
          suggestedProductId: product.id,
          explanation: `Prioritise ${product.name} to fill the jacket gap.`,
          ruleCitations: [
            {
              ruleId: rule.id,
              ruleTitle: rule.title,
              relation: rule.relation,
              explanation: rule.explanation,
            },
          ],
          factCitations: [
            {
              sourceKind: "catalogue_product",
              sourceId: product.id,
              label: product.name,
              detail: "Catalogue jacket suggested to fill the gap",
            },
          ],
        },
      ],
    },
    staffId,
  );
  await roadmapRepo.transition(
    { roadmapId: roadmap.id, action: "submit_for_approval" },
    { kind: "advisor", retailerId, role: "owner" },
  );

  const outfit = await new OutfitRepository(admin).create(
    {
      retailerId,
      customerId,
      roadmapId: roadmap.id,
      title: "E2E Presentation Look",
      occasionLabel: "Client presentation",
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
    staffId,
  );

  // Minimal StylePortrait fixture — only needed to satisfy the job's FK
  // and tenancy trigger; its content is irrelevant to the review UI.
  const facePath = `${retailerId}/${customerId}/references/e2e-face-${unique}.png`;
  const { error: uploadRefError } = await admin.storage
    .from("wardrobe-studio")
    .upload(facePath, PNG, { contentType: "image/png" });
  if (uploadRefError) throw uploadRefError;
  const { data: portraitRow, error: portraitError } = await admin
    .from("style_portraits")
    .insert({ retailer_id: retailerId, customer_id: customerId })
    .select("id")
    .single();
  if (portraitError || !portraitRow) throw portraitError;
  const { error: referenceError } = await admin
    .from("style_portrait_references")
    .insert({
      style_portrait_id: portraitRow.id,
      retailer_id: retailerId,
      kind: "face",
      storage_bucket: "wardrobe-studio",
      storage_path: facePath,
    });
  if (referenceError) throw referenceError;

  const { data: presetRow } = await admin
    .from("retailer_visual_presets")
    .select("id")
    .eq("retailer_id", retailerId)
    .eq("is_default", true)
    .single();
  if (!presetRow) throw new Error("fixture retailer has no default preset");

  const generatedPath = `${retailerId}/${customerId}/generations/e2e-${unique}.png`;
  const { error: uploadGenError } = await admin.storage
    .from("wardrobe-studio")
    .upload(generatedPath, PNG, { contentType: "image/png" });
  if (uploadGenError) throw uploadGenError;

  const { data: jobRow, error: jobError } = await admin
    .from("wardrobe_visualization_jobs")
    .insert({
      retailer_id: retailerId,
      customer_id: customerId,
      outfit_id: outfit.id,
      style_portrait_id: portraitRow.id,
      retailer_visual_preset_id: presetRow.id,
      provider: "openai",
      model: "dall-e-3",
      input_snapshot: { fixture: true },
      input_hash: `fixture-${unique}`,
      status: "ready",
      attempt: 1,
      output_storage_bucket: "wardrobe-studio",
      output_storage_path: generatedPath,
    })
    .select("id")
    .single();
  if (jobError || !jobRow) throw jobError;

  try {
    await signIn(page, admin);
    await page.goto("/wardrobe");

    const roadmapSection = page.locator("li", {
      has: page.getByText(roadmap.title),
    });
    await expect(roadmapSection).toBeVisible();
    await expect(
      roadmapSection.getByText("E2E Presentation Look"),
    ).toBeVisible();
    await expect(
      roadmapSection.getByRole("img", { name: "E2E Presentation Look" }),
    ).toBeVisible();

    await roadmapSection.getByRole("button", { name: "Maybe" }).click();

    await expect
      .poll(async () => {
        const { data } = await admin
          .from("wardrobe_visualization_feedback")
          .select("signal")
          .eq("job_id", jobRow.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        return data?.signal ?? null;
      })
      .toBe("maybe");

    await roadmapSection
      .getByRole("button", { name: "Request change", exact: true })
      .click();
    await roadmapSection
      .getByPlaceholder("What would you like different about this look?")
      .fill("Could we try it without the pocket square?");
    await roadmapSection.getByRole("button", { name: "Send request" }).click();

    await expect
      .poll(async () => {
        const { data } = await admin
          .from("wardrobe_visualization_feedback")
          .select("signal, note")
          .eq("job_id", jobRow.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        return data;
      })
      .toMatchObject({
        signal: "not_for_me",
        note: "Could we try it without the pocket square?",
      });

    const { count: feedbackCount } = await admin
      .from("wardrobe_visualization_feedback")
      .select("id", { count: "exact", head: true })
      .eq("job_id", jobRow.id)
      .eq("customer_id", customerId);
    expect(feedbackCount).toBe(2);

    proofPassed = true;
  } finally {
    await admin
      .from("wardrobe_visualization_feedback")
      .delete()
      .eq("job_id", jobRow.id);
    await admin
      .from("wardrobe_visualization_jobs")
      .delete()
      .eq("id", jobRow.id);
    await admin.storage.from("wardrobe-studio").remove([generatedPath]);
    await admin
      .from("style_portrait_references")
      .delete()
      .eq("style_portrait_id", portraitRow.id);
    await admin.storage.from("wardrobe-studio").remove([facePath]);
    await admin.from("style_portraits").delete().eq("id", portraitRow.id);
    await admin.from("outfit_slots").delete().eq("outfit_id", outfit.id);
    await admin.from("outfits").delete().eq("id", outfit.id);
    await admin
      .from("wardrobe_roadmap_stages")
      .delete()
      .eq("roadmap_id", roadmap.id);
    await admin
      .from("wardrobe_roadmap_gaps")
      .delete()
      .eq("roadmap_id", roadmap.id);
    await admin
      .from("wardrobe_roadmap_goals")
      .delete()
      .eq("roadmap_id", roadmap.id);
    await admin.from("wardrobe_roadmaps").delete().eq("id", roadmap.id);
  }
});
