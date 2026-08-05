import { createSupabaseAdminClient } from "@paon/database";
import { expect, test } from "@playwright/test";

import { TEST_CUSTOMER_EMAIL } from "./fixtures";
import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "17.10";
const BROWSER_PROOF_SPEC =
  "apps/customer/e2e/morning-routine-occasions.spec.ts";

let proofPassed = false;

test.afterAll(async () => {
  await writeBrowserProofRun({
    phaseItemId: PHASE_ITEM_ID,
    spec: BROWSER_PROOF_SPEC,
    status: proofPassed ? "passed" : "failed",
  });
});

function isoDateDaysFromNow(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Proves MorningRoutine's "Coming up" card (PHASE 17.10 / ADV-110, vision
 * spec §14) end to end: a dated Self-Portrait fact (anniversary/
 * wedding_date/occasion/travel_window) due within the lead window
 * surfaces as its own card — separate from today's OOTD, never replacing
 * it — and a fact far outside the window doesn't appear. Reuses 10.4's
 * existing `evaluateRelationshipDateWindow` recurrence math end to end,
 * not a second copy of it.
 */
test("a customer's near-term dated fact surfaces on MorningRoutine as a separate 'Coming up' card, and a far-off one doesn't", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("requires local Supabase.");
  }
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  const { data: customer } = await admin
    .from("customers")
    .select("id, retailer_id")
    .eq("email", TEST_CUSTOMER_EMAIL)
    .single();
  if (!customer) throw new Error("fixture customer missing");

  const nearDate = isoDateDaysFromNow(12);
  const farDate = isoDateDaysFromNow(200);

  const { data: facts, error } = await admin
    .from("customer_facts")
    .insert([
      {
        retailer_id: customer.retailer_id,
        customer_id: customer.id,
        fact_type: "anniversary",
        provenance_class: "advisor_observed",
        value_label: nearDate,
        value_text: "E2E near anniversary",
        observed_at: new Date().toISOString(),
      },
      {
        retailer_id: customer.retailer_id,
        customer_id: customer.id,
        fact_type: "travel_window",
        provenance_class: "advisor_observed",
        value_label: farDate,
        value_text: "E2E far travel window",
        observed_at: new Date().toISOString(),
      },
    ])
    .select("id");
  if (error || !facts) throw new Error("failed to seed customer facts");

  try {
    const { data, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: TEST_CUSTOMER_EMAIL,
    });
    if (linkError || !data.properties) {
      throw new Error(
        `Failed to generate magic link: ${linkError?.message ?? "unknown error"}`,
      );
    }
    await page.goto(
      `/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`,
    );
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/morning-routine");
    const card = page.locator("[data-upcoming-occasions-card]").first();
    await expect(card).toBeVisible();
    await expect(card.getByText("E2E near anniversary")).toBeVisible();
    await expect(card.getByText("E2E far travel window")).toHaveCount(0);

    // "Coming up" is a separate card, not a replacement of today's OOTD.
    await expect(
      page.getByRole("heading", { name: "MorningRoutine" }),
    ).toBeVisible();

    proofPassed = true;
  } finally {
    // customer_facts is append-only by design (no DELETE grant, even for
    // service_role — a fact is soft-deleted/superseded, never hard
    // deleted) and this fixture reuses the shared TEST_CUSTOMER_EMAIL
    // identity other specs depend on, so cleanup soft-deletes only the
    // two rows this test itself created.
    await admin
      .from("customer_facts")
      .update({ deleted_at: new Date().toISOString() })
      .in(
        "id",
        facts.map((fact) => fact.id),
      );
  }
});
