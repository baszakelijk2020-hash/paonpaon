import { createSupabaseAdminClient } from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import {
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
  TEST_RETAILER_SLUG,
} from "./fixtures";
import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "17.4";
const BROWSER_PROOF_SPEC = "apps/retailer/e2e/fabric-pairing.spec.ts";

let proofPassed = false;

test.afterAll(async () => {
  await writeBrowserProofRun({
    phaseItemId: PHASE_ITEM_ID,
    spec: BROWSER_PROOF_SPEC,
    status: proofPassed ? "passed" : "failed",
  });
});

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

/**
 * Proves the fabric-pairing upsell engine (PHASE 17.4 / ADV-104) end to
 * end: selecting a fabric with no rules shows "undecided" for both
 * buttons and linings (never a fabricated permissive default); saving a
 * button rule and a lining rule (standard vs upsell) through the real
 * form makes them appear, at the same repository write path
 * `checkFabricButtonPairing`/`checkFabricLiningPairing` already enforce;
 * and a real metadata-graph edge from the fabric to another concept
 * resolves to a real, currently accepted catalogue product under
 * "Complete the look" — never a fabricated list.
 */
test("a selected fabric shows undecided pairings until rules are saved, then shows real buttons, linings and a complete-the-look item", async ({
  page,
}) => {
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

  const { data: staffRow } = await admin
    .from("retailer_staff_members")
    .select("id")
    .eq("retailer_id", retailerId)
    .eq("email", TEST_OWNER_EMAIL)
    .single();
  if (!staffRow) throw new Error("fixture owner staff row missing");

  const unique = Date.now();

  const { data: fabricConcept } = await admin
    .from("metadata_concepts")
    .insert({
      retailer_id: retailerId,
      kind: "fabric_collection",
      slug: `e2e-flannel-${unique}`,
      canonical_name: `E2E Flannel ${unique}`,
    })
    .select("id, slug")
    .single();
  if (!fabricConcept) throw new Error("failed to seed fabric concept");

  const { data: styleConcept } = await admin
    .from("metadata_concepts")
    .insert({
      retailer_id: retailerId,
      kind: "style",
      slug: `e2e-classic-style-${unique}`,
      canonical_name: `E2E Classic Style ${unique}`,
    })
    .select("id")
    .single();
  if (!styleConcept) throw new Error("failed to seed style concept");

  const { error: edgeError } = await admin
    .from("metadata_concept_edges")
    .insert({
      retailer_id: retailerId,
      source_concept_id: fabricConcept.id,
      target_concept_id: styleConcept.id,
      kind: "suggests",
      weight: 0.9,
    });
  if (edgeError) throw edgeError;

  const { data: product } = await admin
    .from("products")
    .insert({
      retailer_id: retailerId,
      name: `E2E Complete The Look Pocket Square ${unique}`,
      slug: `e2e-complete-the-look-${unique}`,
      status: "active",
    })
    .select("id")
    .single();
  if (!product) throw new Error("failed to seed product");

  const { error: assignmentError } = await admin
    .from("entity_metadata_assignments")
    .insert({
      retailer_id: retailerId,
      target_type: "product",
      target_id: product.id,
      concept_id: styleConcept.id,
      source: "retailer",
      review_status: "accepted",
      reviewed_by_staff_id: staffRow.id,
      reviewed_at: new Date().toISOString(),
    });
  if (assignmentError) throw assignmentError;

  try {
    await page.goto("/fabric-pairing");
    await page.getByRole("link", { name: `E2E Flannel ${unique}` }).click();
    await expect(page).toHaveURL(new RegExp(`fabric=${fabricConcept.id}`));

    // No rules yet: undecided, never permissive.
    await expect(
      page.getByText("No rule yet — undecided, not open to any button."),
    ).toBeVisible();
    await expect(
      page.getByText("No rule yet — undecided, not open to any lining."),
    ).toBeVisible();

    // Real complete-the-look product, resolved from a real concept edge.
    await expect(
      page.getByText(`E2E Complete The Look Pocket Square ${unique}`),
    ).toBeVisible();

    // Save a button rule through the real form.
    await page
      .getByLabel("Allowed button keys (comma-separated)")
      .fill("horn-dark, corozo-charcoal");
    await page
      .getByLabel("Note", { exact: false })
      .first()
      .fill("Avoid high-shine on a matte cloth.");
    await page.getByRole("button", { name: "Save button rule" }).click();
    await expect(page.getByText("horn-dark")).toBeVisible();
    await expect(page.getByText("corozo-charcoal")).toBeVisible();

    // Save a lining rule through the real form — standard vs upsell.
    await page
      .getByLabel("Standard lining keys (comma-separated)")
      .fill("bemberg-charcoal");
    await page
      .getByLabel("Upsell lining keys (comma-separated, optional)")
      .fill("silk-jacquard-house");
    await page
      .getByLabel("Note", { exact: false })
      .last()
      .fill("House jacquard is the signature upgrade for flannel.");
    await page.getByRole("button", { name: "Save lining rule" }).click();
    await expect(page.getByText("bemberg-charcoal · standard")).toBeVisible();
    await expect(page.getByText("silk-jacquard-house · upsell")).toBeVisible();

    const { data: buttonRule } = await admin
      .from("fabric_button_rules")
      .select("allowed_button_keys")
      .eq("retailer_id", retailerId)
      .eq("fabric_key", fabricConcept.slug)
      .single();
    expect(buttonRule?.allowed_button_keys).toEqual([
      "horn-dark",
      "corozo-charcoal",
    ]);

    const { data: liningRule } = await admin
      .from("fabric_lining_rules")
      .select("standard_lining_keys, upsell_lining_keys")
      .eq("retailer_id", retailerId)
      .eq("fabric_key", fabricConcept.slug)
      .single();
    expect(liningRule?.standard_lining_keys).toEqual(["bemberg-charcoal"]);
    expect(liningRule?.upsell_lining_keys).toEqual(["silk-jacquard-house"]);

    proofPassed = true;
  } finally {
    await admin
      .from("fabric_button_rules")
      .delete()
      .eq("retailer_id", retailerId)
      .eq("fabric_key", fabricConcept.slug);
    await admin
      .from("fabric_lining_rules")
      .delete()
      .eq("retailer_id", retailerId)
      .eq("fabric_key", fabricConcept.slug);
    await admin
      .from("entity_metadata_assignments")
      .delete()
      .eq("target_id", product.id);
    await admin.from("products").delete().eq("id", product.id);
    await admin
      .from("metadata_concept_edges")
      .delete()
      .eq("source_concept_id", fabricConcept.id);
    await admin.from("metadata_concepts").delete().eq("id", styleConcept.id);
    await admin.from("metadata_concepts").delete().eq("id", fabricConcept.id);
  }
});
