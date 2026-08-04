import {
  CorporateOpportunityRepository,
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

const PHASE_ITEM_ID = "18.11";
const BROWSER_PROOF_SPEC =
  "apps/retailer/e2e/corporate-public-signal-citation.spec.ts";

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
 * Proves PHASE 18.11's citation-grounding discipline end to end: no
 * autonomous external-discovery pipeline exists in this environment
 * (genuinely `blocked_external` — there is no external data source
 * access to build one against), but the enforcement it will one day
 * feed is real. A `public_signal` with no citation is refused; one with
 * a real checkable URL is accepted, scored (the fixed weight, not a
 * hidden multiplier), and its citation is visible on the opportunity —
 * the same "not a black box" discipline 17.1 already established for
 * AI-authored content, applied here to externally-discovered content.
 */
test("a public signal is refused with no citation and accepted with a real one", async ({
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

  const unique = Date.now();
  const opportunityRepo = new CorporateOpportunityRepository(admin);
  const created = await opportunityRepo.create({
    retailerId,
    companyName: `E2E Public Signal Co ${unique}`,
  });
  if (!created.ok) throw new Error("failed to seed opportunity");
  const opportunity = created.opportunity;

  try {
    await page.goto(`/business-development/${opportunity.id}`);

    // 1. No citation, at the database write path the UI itself uses —
    // refused before it ever becomes a scored signal.
    const refused = await opportunityRepo.addSignal({
      retailerId,
      opportunityId: opportunity.id,
      source: "public_signal",
      detail: "Trade press mentions a head-office relocation.",
    });
    expect(refused).toEqual({ ok: false, reason: "citation_required" });

    // 2. Through the real UI, with a real checkable citation: accepted,
    // scored at its published weight, and the citation stays visible.
    await page.getByLabel("Source").selectOption("public_signal");
    await page
      .getByLabel("Detail")
      .fill("Trade press mentions a head-office relocation.");
    await page
      .getByLabel(/Citation URL/)
      .fill("https://example.com/press/relocation-announcement");
    await page.getByRole("button", { name: "Add signal" }).click();
    await expect(page.getByText("Score 20")).toBeVisible();
    await expect(
      page.getByText(
        "Source: https://example.com/press/relocation-announcement",
      ),
    ).toBeVisible();

    const { data: signals } = await admin
      .from("corporate_opportunity_signals")
      .select("source, citation_url")
      .eq("opportunity_id", opportunity.id);
    expect(signals).toHaveLength(1);
    expect(signals?.[0]?.source).toBe("public_signal");
    expect(signals?.[0]?.citation_url).toBe(
      "https://example.com/press/relocation-announcement",
    );

    proofPassed = true;
  } finally {
    await admin
      .from("corporate_opportunities")
      .delete()
      .eq("id", opportunity.id);
  }
});
