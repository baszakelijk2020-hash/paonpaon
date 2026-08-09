import {
  createSupabaseAdminClient,
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

const PHASE_ITEM_ID = "17.10";
const BROWSER_PROOF_SPEC = "apps/customer/e2e/complete-the-look.spec.ts";

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
 * MorningRoutine's "Complete the look" card end to end (PHASE 17.10 /
 * ADV-110, vision spec §14 item 3) — the fixture product is tagged with
 * an accepted `garment_type` concept ("Overcoat") the customer owns
 * nothing in, so it surfaces as a gap suggestion; tapping "See it on me"
 * must reach the same real Virtual Wardrobe Studio enqueue pipeline
 * `/wardrobe`'s own tap-to-generate already uses (`enqueueLook`) via a
 * throwaway single-slot Outfit, never a second generation path. This
 * sandbox has no OPENAI_API_KEY, so the job is only proven to reach
 * `queued` — same posture `virtual-studio.spec.ts` already documents.
 */
test("a Complete the Look suggestion generates a real try-on job for the suggested product", async ({
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

  const { data: customerRow } = await admin
    .from("customers")
    .select("id")
    .eq("retailer_id", retailer.id)
    .eq("email", TEST_CUSTOMER_EMAIL)
    .single();
  if (!customerRow) throw new Error("fixture customer missing");

  const { data: product } = await admin
    .from("products")
    .select("id")
    .eq("retailer_id", retailer.id)
    .eq("slug", TEST_PRODUCT_SLUG)
    .single();
  if (!product) throw new Error("fixture product missing");

  // A reviewed, accepted `garment_type` concept on the fixture product —
  // the exact accepted-taxonomy shape `findAcceptedConceptIdsForProduct`
  // reads, and the only real source of a catalogue product's garment
  // category (`products` itself carries no category column).
  const conceptSlug = "e2e-ctl-overcoat";
  let { data: concept } = await admin
    .from("metadata_concepts")
    .select("id")
    .eq("retailer_id", retailer.id)
    .eq("kind", "garment_type")
    .eq("slug", conceptSlug)
    .maybeSingle();
  if (!concept) {
    const { data: created, error: conceptError } = await admin
      .from("metadata_concepts")
      .insert({
        retailer_id: retailer.id,
        kind: "garment_type",
        slug: conceptSlug,
        canonical_name: "Overcoat",
        attributes: {},
        active: true,
      })
      .select("id")
      .single();
    if (conceptError) throw conceptError;
    concept = created;
  } else {
    await admin
      .from("metadata_concepts")
      .update({ active: true, deleted_at: null })
      .eq("id", concept.id);
  }
  const { data: reviewer } = await admin
    .from("retailer_staff_members")
    .select("id")
    .eq("retailer_id", retailer.id)
    .limit(1)
    .single();
  if (!reviewer) throw new Error("fixture metadata reviewer missing");

  await admin
    .from("entity_metadata_assignments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("retailer_id", retailer.id)
    .eq("concept_id", concept.id)
    .eq("target_id", product.id)
    .is("deleted_at", null);
  const { error: assignmentError } = await admin
    .from("entity_metadata_assignments")
    .insert({
      retailer_id: retailer.id,
      target_type: "product",
      target_id: product.id,
      concept_id: concept.id,
      source: "paon",
      confidence: 1,
      review_status: "accepted",
      evidence: { summary: "E2E reviewed Complete the Look fixture" },
      reviewed_by_staff_id: reviewer.id,
      reviewed_at: new Date().toISOString(),
    });
  if (assignmentError) throw assignmentError;

  const retailerId = asId<"RetailerId">(retailer.id);
  const customerId = asId<"CustomerId">(customerRow.id);

  const consent = await new StylePortraitConsentRepository(admin).grant(
    retailerId,
    customerId,
  );
  expect(consent.status).toBe("granted");

  const stylePortraitRepo = new StylePortraitRepository(admin);
  const unique = Date.now();
  const facePath = `${retailer.id}/${customerRow.id}/references/e2e-ctl-face-${unique}.png`;
  const fullBodyPath = `${retailer.id}/${customerRow.id}/references/e2e-ctl-body-${unique}.png`;
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

  const outfitIds: string[] = [];

  try {
    await signIn(page, admin);

    await page.goto("/morning-routine");
    const card = page.locator("[data-complete-the-look-card]").first();
    await expect(card).toBeVisible();
    const tile = card.locator("li", { hasText: "E2E Storefront Overcoat" });
    await expect(tile).toBeVisible();
    await expect(
      tile.getByText("You don't have a overcoat yet."),
    ).toBeVisible();

    await tile.getByRole("button", { name: "See it on me" }).click();

    await expect
      .poll(async () => {
        const { data } = await admin
          .from("outfits")
          .select("id")
          .eq("customer_id", customerRow.id)
          .eq("title", "See it on me: E2E Storefront Overcoat")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        return data?.id ?? null;
      })
      .not.toBeNull();

    const { data: outfitAfterCreate } = await admin
      .from("outfits")
      .select("id")
      .eq("customer_id", customerRow.id)
      .eq("title", "See it on me: E2E Storefront Overcoat")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (!outfitAfterCreate) throw new Error("outfit was not created");
    outfitIds.push(outfitAfterCreate.id);

    const { data: jobAfterEnqueue } = await admin
      .from("wardrobe_visualization_jobs")
      .select("id, status, outfit_id, customer_id")
      .eq("outfit_id", outfitAfterCreate.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (!jobAfterEnqueue) throw new Error("visualization job was not created");
    expect(jobAfterEnqueue.status).toBe("queued");
    expect(jobAfterEnqueue.customer_id).toBe(customerRow.id);

    proofPassed = true;
  } finally {
    if (outfitIds.length > 0) {
      await admin
        .from("wardrobe_visualization_jobs")
        .delete()
        .in("outfit_id", outfitIds);
      await admin.from("outfit_slots").delete().in("outfit_id", outfitIds);
      await admin.from("outfits").delete().in("id", outfitIds);
    }
    await admin
      .from("wardrobe_visualization_jobs")
      .delete()
      .eq("style_portrait_id", portrait.id);
    await admin
      .from("style_portrait_references")
      .delete()
      .eq("style_portrait_id", portrait.id);
    const { data: refObjects } = await admin.storage
      .from("wardrobe-studio")
      .list(`${retailer.id}/${customerRow.id}/references`);
    if (refObjects && refObjects.length > 0) {
      await admin.storage
        .from("wardrobe-studio")
        .remove(
          refObjects
            .filter((object) => object.name.includes("e2e-ctl-"))
            .map(
              (object) =>
                `${retailer.id}/${customerRow.id}/references/${object.name}`,
            ),
        );
    }
    await admin.from("style_portraits").delete().eq("id", portrait.id);
    await admin
      .from("style_portrait_consents")
      .delete()
      .eq("customer_id", customerRow.id);
    await admin
      .from("entity_metadata_assignments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("retailer_id", retailer.id)
      .eq("concept_id", concept.id)
      .eq("target_id", product.id);
  }
});
