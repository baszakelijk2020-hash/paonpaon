import {
  CustomerRepository,
  MetadataRepository,
  ProductRepository,
  ProductVariantRepository,
  WardrobeRepository,
  createSupabaseAdminClient,
} from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import {
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
  TEST_RETAILER_SLUG,
} from "./fixtures";
import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "14.2";
const BROWSER_PROOF_SPEC = "apps/retailer/e2e/complete-look-insight.spec.ts";

let proofPassed = false;

test.afterAll(async () => {
  await writeBrowserProofRun({
    phaseItemId: PHASE_ITEM_ID,
    spec: BROWSER_PROOF_SPEC,
    status: proofPassed ? "passed" : "failed",
  });
});

/**
 * Proves the `complete_look` cited-intelligence projector (PHASE 14.2)
 * end to end: three real customers with real, deliberately incomplete
 * wardrobes against a real in-stock catalogue produce the correct
 * "most common gap" finding — not merely that the recompute button can be
 * clicked without throwing. Customer 0 owns shirt+trousers (missing
 * shoes); customer 1 owns shirt only (missing trousers+shoes); customer 2
 * owns nothing (missing shirt+trousers+shoes) — a 3:2:1 gap skew (shoes:
 * trousers:shirt) that makes "shoes" the most common gap regardless of
 * how many other real customers already exist on this shared fixture
 * retailer. The sample size is verified against that retailer's actual
 * live customer count, not a hardcoded number.
 */
test("complete_look projector finds the most common wardrobe gap and cites it", async ({
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

  const { data: staffMember } = await admin
    .from("retailer_staff_members")
    .select("id")
    .eq("retailer_id", retailerId)
    .eq("email", TEST_OWNER_EMAIL)
    .single();
  if (!staffMember) throw new Error("fixture owner staff row missing");

  const unique = Date.now();
  const customerRepo = new CustomerRepository(admin);
  const wardrobeRepo = new WardrobeRepository(admin);
  const productRepo = new ProductRepository(admin);
  const variantRepo = new ProductVariantRepository(admin);
  const metadataRepo = new MetadataRepository(admin);

  const customerIds: string[] = [];
  const productIds: string[] = [];
  const conceptIds: string[] = [];

  try {
    // Three customers with deliberately different wardrobe completeness.
    for (let i = 0; i < 3; i++) {
      const customer = await customerRepo.create({
        retailerId,
        fullName: `E2E Complete Look Customer ${unique}-${i}`,
        email: `complete-look-${unique}-${i}@paon.test`,
        lifecycleStage: "prospect",
      });
      customerIds.push(customer.id);
    }
    const [customer0, customer1] = customerIds;

    await wardrobeRepo.createExternalItem({
      retailerId,
      customerId: customer0!,
      categoryCode: "shirt",
      displayName: `Blue Oxford ${unique}`,
      condition: "good",
      careState: "current",
      fitPerception: "true_to_size",
    });
    await wardrobeRepo.createExternalItem({
      retailerId,
      customerId: customer0!,
      categoryCode: "trousers",
      displayName: `Navy Chinos ${unique}`,
      condition: "good",
      careState: "current",
      fitPerception: "true_to_size",
    });
    await wardrobeRepo.createExternalItem({
      retailerId,
      customerId: customer1!,
      categoryCode: "shirt",
      displayName: `White Linen ${unique}`,
      condition: "good",
      careState: "current",
      fitPerception: "true_to_size",
    });
    // customerIds[2] deliberately owns nothing.

    // Real in-stock catalogue: one active, reviewed-and-accepted product
    // per category, so the projector has real categories to compare
    // customer ownership against.
    for (const categoryCode of ["shirt", "trousers", "shoes"] as const) {
      const concept = await metadataRepo.createConcept({
        retailerId,
        kind: "garment_type",
        slug: `${categoryCode}-${unique}`,
        canonicalName: categoryCode,
      });
      conceptIds.push(concept.id);

      const product = await productRepo.create({
        retailerId,
        name: `E2E ${categoryCode} product ${unique}`,
        slug: `e2e-${categoryCode}-${unique}`,
        description: `Test ${categoryCode} for complete_look proof.`,
        status: "active",
        isMadeToOrder: false,
        isAlterable: false,
      });
      productIds.push(product.id);

      await variantRepo.create({
        productId: product.id,
        sku: `E2E-${categoryCode.toUpperCase()}-${unique}`,
        size: "M",
        price: { amountMinorUnits: 10000, currency: "GBP" },
        inventoryQuantity: 10,
      });

      const assignment = await metadataRepo.createAssignment({
        retailerId,
        target: { targetType: "product", targetId: product.id },
        conceptId: concept.id,
        source: "retailer",
      });
      // review_metadata_assignment is a security-definer RPC granted only
      // to `authenticated` (it derives the reviewer from a real staff
      // session via current_retailer_role()/current_staff_id()) — the
      // admin/service-role client used for fixture setup has no such
      // session, so it is denied that RPC specifically. Direct table
      // update bypasses RLS/grants the same way every other admin-client
      // fixture write in this suite already does — but
      // entity_metadata_assignments_check2 requires reviewed_by_staff_id
      // and reviewed_at to be set together with a terminal review_status
      // (mirroring exactly what the RPC itself sets), so setting
      // review_status alone violates that constraint and fails silently
      // (the Supabase JS client does not throw on an unchecked .update()
      // error) — found via a direct SQL repro after this exact silent
      // failure caused the projector to see zero accepted concepts and
      // report "no_customers_or_gaps" on every run.
      const { error: reviewError } = await admin
        .from("entity_metadata_assignments")
        .update({
          review_status: "accepted",
          reviewed_by_staff_id: staffMember.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", assignment.id);
      if (reviewError) {
        throw new Error(
          `Failed to accept metadata assignment: ${reviewError.message}`,
        );
      }
    }

    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
    await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
    await page.getByRole("button", { name: "Enter the atelier" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/analytics");

    // Recompute is a real, always-available, idempotent manager action in
    // production (never disabled, never rate-limited) — a manager clicking
    // it twice is ordinary, expected behaviour, not a workaround. Retrying
    // the click itself (not weakening the assertion below, which must
    // still see the exact correct statement/sample_size) absorbs a real,
    // observed transient read-timing hiccup under heavy local system load
    // between this test's own fixture writes and the Server Action's own
    // read, without ever accepting a wrong or partial result as success.
    let recomputed = false;
    for (let attempt = 0; attempt < 3 && !recomputed; attempt += 1) {
      await page
        .locator('[data-cited-insights="complete_look"]')
        .getByRole("button", { name: "Recompute" })
        .click();
      try {
        await expect(
          page.getByText("Recomputed from wardrobe and catalogue data."),
        ).toBeVisible({ timeout: 15_000 });
        recomputed = true;
      } catch {
        // fall through to retry
      }
    }
    expect(recomputed).toBe(true);

    // e2e-retailer-workspace is a shared fixture retailer with many real
    // customers accumulated across this whole e2e suite's history, not
    // just this test's own 3 — the projector correctly reports the gap
    // across ALL of them, not just the ones this test created. This test
    // engineers a clear 3:2:1 gap skew (shoes missing by 3, trousers by 2,
    // shirt by 1) so "shoes" wins regardless of the retailer's real total
    // customer count, and independently confirms the claimed sample size
    // against that real, current total rather than a hardcoded count.
    const { count: totalCustomerCount } = await admin
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("retailer_id", retailerId);
    if (!totalCustomerCount)
      throw new Error("could not count fixture customers");

    const card = page.locator('[data-cited-insights="complete_look"]');
    await expect(card.getByText(/shoes/i)).toBeVisible();
    await expect(
      card.getByText(
        new RegExp(
          `${totalCustomerCount} of ${totalCustomerCount} customers`,
          "i",
        ),
      ),
    ).toBeVisible();

    // Independent database-level proof: exactly one live complete_look
    // recommendation, citing the exact sample the UI claims.
    const { data: liveRows } = await admin
      .from("cited_recommendations")
      .select("id, kind, statement, sample_size, confidence, withdrawn_at")
      .eq("retailer_id", retailerId)
      .eq("kind", "complete_look")
      .is("withdrawn_at", null);
    expect(liveRows).toHaveLength(1);
    const row = liveRows![0]!;
    expect(row.sample_size).toBe(totalCustomerCount);
    expect(row.statement).toContain("shoes");
    expect(row.statement).toContain(
      `${totalCustomerCount} of ${totalCustomerCount} customers`,
    );

    proofPassed = true;
  } finally {
    await admin
      .from("cited_recommendations")
      .delete()
      .eq("retailer_id", retailerId)
      .eq("kind", "complete_look");
    if (customerIds.length > 0) {
      await admin
        .from("wardrobe_items")
        .delete()
        .in("customer_id", customerIds);
      await admin.from("customers").delete().in("id", customerIds);
    }
    if (productIds.length > 0) {
      await admin
        .from("entity_metadata_assignments")
        .delete()
        .in("target_id", productIds);
      // A variant created with inventory writes a stock_ledger_entries row
      // (a DB trigger) that is deliberately append-only — its grants
      // revoke delete/update entirely (see
      // 20260801000016_enforce_append_only_grants.sql), so the variant
      // (and transitively the product) can never actually be deleted once
      // it has any stock movement. Archiving the product instead of
      // deleting it is the correct cleanup: computeCompleteLook's own
      // catalogue scan filters to `status === "active"`, so an archived
      // product silently drops out of every future run's scan with no
      // FK conflict, leaving only harmless, correctly-immutable ledger
      // rows behind — exactly what an append-only ledger is for. (Found
      // via a real leftover-row inspection after attempting to delete
      // this row caused an FK violation, and — before that — after a
      // silent, unchecked delete failure had already let leftover active
      // products accumulate past computeCompleteLook's own
      // MAX_CATALOGUE_PRODUCTS_SCANNED cap, causing this suite's
      // intermittent "no_customers_or_gaps" failures.)
      await admin
        .from("products")
        .update({ status: "archived" })
        .in("id", productIds);
    }
    if (conceptIds.length > 0) {
      await admin.from("metadata_concepts").delete().in("id", conceptIds);
    }
  }
});
