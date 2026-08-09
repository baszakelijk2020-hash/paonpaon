import {
  CustomerRepository,
  ProductRepository,
  SartorialRuleRepository,
  StylePortraitConsentRepository,
  StylePortraitRepository,
  WardrobeRoadmapRepository,
  createSupabaseAdminClient,
} from "@paon/database";
import { NEUTRAL_SARTORIAL_RULE_FIXTURES, asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import {
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
  TEST_RETAILER_SLUG,
} from "./fixtures";
import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "4.9-advisor-visual-roadmap";
const BROWSER_PROOF_SPEC = "apps/retailer/e2e/visual-roadmap.spec.ts";

// A genuine minimal 1x1 PNG, same fixture bytes already proven against this
// codebase's own magic-byte validation elsewhere (silhouette-analysis.spec.ts).
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

let proofPassed = false;

test.afterAll(async () => {
  await writeBrowserProofRun({
    phaseItemId: PHASE_ITEM_ID,
    spec: BROWSER_PROOF_SPEC,
    status: proofPassed ? "passed" : "failed",
  });
});

/**
 * Advisor visual roadmap (VWS-001 / PHASE 4.9 / ADR-074) — the advisor adds
 * a look (an Outfit linked to an existing WardrobeRoadmap via roadmapId,
 * authored by staff) from the retailer client profile, then enqueues
 * generation for it. This sandbox has no OPENAI_API_KEY, so the job is
 * proven to reach `queued` and stay there — same documented hard-blocker
 * posture as the customer-side single-look Studio spec
 * (apps/customer/e2e/virtual-studio.spec.ts).
 */
test("an advisor adds a look to a roadmap and enqueues generation", async ({
  page,
}) => {
  test.setTimeout(180_000);

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

  const { data: ownerStaff } = await admin
    .from("retailer_staff_members")
    .select("id")
    .eq("retailer_id", retailerId)
    .eq("email", TEST_OWNER_EMAIL)
    .single();
  if (!ownerStaff) throw new Error("owner staff record missing");
  const staffId = asId<"StaffId">(ownerStaff.id);

  const unique = Date.now();
  const customer = await new CustomerRepository(admin).create({
    retailerId,
    fullName: `E2E Visual Roadmap Client ${unique}`,
    email: `visual-roadmap-${unique}@paon.test`,
    lifecycleStage: "returning",
  });
  const consent = await new StylePortraitConsentRepository(admin).grant(
    retailerId,
    customer.id,
  );
  expect(consent.status).toBe("granted");
  expect(consent.disclosuresAcknowledged).toBe(true);

  const products = await new ProductRepository(admin).findByRetailer(
    retailerId,
  );
  const product = products[0];
  if (!product) throw new Error("fixture retailer has no catalogue product");

  const approvedRules = await new SartorialRuleRepository(
    admin,
  ).listApprovedForRetailer(retailerId);
  const rule = approvedRules[0] ?? NEUTRAL_SARTORIAL_RULE_FIXTURES[0]!;

  const roadmapRepo = new WardrobeRoadmapRepository(admin);
  const roadmap = await roadmapRepo.createDraft(
    {
      retailerId,
      customerId: customer.id,
      title: `E2E Visual Roadmap ${unique}`,
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

  // Real approved Style Portrait so the "Generate" click reaches the queue
  // rather than the "no approved Style Portrait" error path.
  const stylePortraitRepo = new StylePortraitRepository(admin);
  const facePath = `${retailerId}/${customer.id}/references/e2e-face-${unique}.png`;
  const fullBodyPath = `${retailerId}/${customer.id}/references/e2e-body-${unique}.png`;
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
    customerId: customer.id,
    references: [
      {
        kind: "face",
        storageBucket: "wardrobe-studio",
        storagePath: facePath,
      },
      {
        kind: "full_body",
        storageBucket: "wardrobe-studio",
        storagePath: fullBodyPath,
      },
    ],
  });
  await stylePortraitRepo.approve(portrait.id);

  const cleanupIds = { outfitId: "", jobId: "" };

  try {
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
    await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
    await page.getByRole("button", { name: "Enter the atelier" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto(`/customers/${customer.id}`);
    await expect(
      page.getByRole("heading", { name: `Visual roadmap — ${roadmap.title}` }),
    ).toBeVisible();

    await page.getByLabel(`Include ${product.name}`).check();
    const titleInputs = page.getByPlaceholder("Business formal");
    await titleInputs.fill("E2E Client Presentation Look");

    // This exact `/customers/[id]` route has a documented, confirmed
    // Next.js 15.1 quirk where neither a bare redirect nor an explicit
    // `router.refresh()` reliably repaints after a mutation (see
    // `FitProfileCandidateDecision`'s own comment and this same
    // wait-for-response-then-reload proof pattern already established in
    // fit-tools.spec.ts). Wait for the mutating response itself before
    // reloading — click() resolves once the click dispatches, not once
    // the underlying fetch completes.
    const createResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/customers/") &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Add look to roadmap" }).click();
    await createResponse;
    await page.reload();

    await expect(page.getByText("E2E Client Presentation Look")).toBeVisible();

    const { data: outfitRow } = await admin
      .from("outfits")
      .select("id, title, roadmap_id, created_by_staff_id")
      .eq("roadmap_id", roadmap.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (!outfitRow) throw new Error("roadmap look was not created");
    cleanupIds.outfitId = outfitRow.id;
    expect(outfitRow.title).toBe("E2E Client Presentation Look");
    expect(outfitRow.created_by_staff_id).toBe(staffId);

    const generateResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/customers/") &&
        response.request().method() === "POST",
    );
    await page
      .locator("li", { hasText: "E2E Client Presentation Look" })
      .getByRole("button", { name: "Generate" })
      .click();
    await generateResponse;

    const { data: jobRow } = await admin
      .from("wardrobe_visualization_jobs")
      .select("id, status, outfit_id, customer_id")
      .eq("outfit_id", outfitRow.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (!jobRow) throw new Error("visualization job was not created");
    cleanupIds.jobId = jobRow.id;
    expect(jobRow.status).toBe("queued");
    expect(jobRow.customer_id).toBe(customer.id);

    proofPassed = true;
  } finally {
    if (cleanupIds.jobId) {
      await admin
        .from("wardrobe_visualization_jobs")
        .delete()
        .eq("id", cleanupIds.jobId);
    }
    if (cleanupIds.outfitId) {
      await admin
        .from("outfit_slots")
        .delete()
        .eq("outfit_id", cleanupIds.outfitId);
      await admin.from("outfits").delete().eq("id", cleanupIds.outfitId);
    }
    await admin
      .from("style_portrait_consents")
      .delete()
      .eq("customer_id", customer.id);
    await admin
      .from("style_portrait_references")
      .delete()
      .eq("style_portrait_id", portrait.id);
    await admin.storage
      .from("wardrobe-studio")
      .remove([facePath, fullBodyPath]);
    await admin.from("style_portraits").delete().eq("id", portrait.id);
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
    await admin.from("customers").delete().eq("id", customer.id);
  }
});
