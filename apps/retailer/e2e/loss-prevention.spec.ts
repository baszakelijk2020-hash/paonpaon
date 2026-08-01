import { createSupabaseAdminClient } from "@paon/database";
import { DEMO_PASSWORD } from "@paon/database/demo-seed";
import { ensureProgrammeProofSeed } from "@paon/database/programme-proof-seed";
import { PROGRAMME_PROOF_PERSONAS } from "@paon/domain";
import { expect, test, type Page } from "@playwright/test";

import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "13.2";
const BROWSER_PROOF_SPEC = "apps/retailer/e2e/loss-prevention.spec.ts";

let proofPassed = false;

test.afterAll(async () => {
  await writeBrowserProofRun({
    phaseItemId: PHASE_ITEM_ID,
    spec: BROWSER_PROOF_SPEC,
    status: proofPassed ? "passed" : "failed",
  });
});

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

/**
 * Loss prevention (PHASE 13.2).
 *
 * The control is that a valuable write-off does not happen when it is asked
 * for. It waits for a manager who was not involved, and only that approval
 * moves the stock. This drives it through the browser so the queue genuinely
 * shows an unapproved write-off as unapproved, rather than as done.
 */
test("a write-off waits for a second signature, and the sweep moves nothing", async ({
  page,
}) => {
  test.setTimeout(300_000);

  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const anonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]!;
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const proof = await ensureProgrammeProofSeed({
    supabaseUrl,
    anonKey,
    serviceRoleKey,
  });
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  const stamp = Date.now();
  const { data: location } = await admin
    .from("stock_locations")
    .insert({
      retailer_id: proof.retailerId,
      code: `E2E-RISK-${stamp}`,
      name: `E2E Risk ${stamp}`,
      active: true,
    })
    .select("id")
    .single();
  const locationId = location!.id;

  const { data: variant } = await admin
    .from("product_variants")
    .select("id, sku")
    .limit(1)
    .single();
  const variantId = variant!.id;

  // 20 on the shelf. Not 3: a 1-of-3 shortfall is a 33% variance which trips
  // the recount threshold, and the approval path would never be reached.
  await admin.from("stock_ledger_entries").insert({
    retailer_id: proof.retailerId,
    variant_id: variantId,
    location_id: locationId,
    kind: "receipt",
    quantity: 20,
  });

  // Tags unique per run. A fixed "EPC-D" collides with the rows left by
  // earlier runs of this same spec, and the assertion then fails in strict
  // mode on its own history rather than on anything the product did.
  const tag = (suffix: string) => `EPC-${suffix}-${stamp}`;

  await signIn(page, PROGRAMME_PROOF_PERSONAS.manager.email);
  await page.goto("/inventory/risk");

  // The page is identified by the form this spec drives, not by the queue
  // being globally empty: the approval queue is retailer-wide, so any other
  // suite's open flag would make an emptiness assertion fail for reasons that
  // have nothing to do with this one.
  await expect(page.locator("#writeoff-variant")).toBeVisible({
    timeout: 30_000,
  });

  // ---- raise a valuable write-off --------------------------------------
  await page.selectOption("#writeoff-variant", variantId);
  await page.selectOption("#writeoff-location", locationId);
  await page.fill("#writeoff-quantity", "-1");
  // €900: comfortably over the threshold that demands a second signature.
  await page.fill("#writeoff-price", "900.00");
  await page.getByRole("button", { name: "Send for approval" }).click();

  const flagId = await (async () => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const { data } = await admin
        .from("stock_risk_flags")
        .select("id, approved_at, ledger_entry_id")
        .eq("retailer_id", proof.retailerId)
        .eq("location_id", locationId)
        .maybeSingle();
      if (data) return data.id;
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    return null;
  })();
  expect(flagId, "the write-off was never raised").not.toBeNull();

  // ---- raising it moved NOTHING ----------------------------------------
  // The whole control rests on this: an unapproved write-off must not be
  // indistinguishable from a completed one.
  const { data: afterRaise } = await admin
    .from("stock_ledger_entries")
    .select("kind")
    .eq("location_id", locationId);
  expect(afterRaise!.map((entry) => entry.kind)).toEqual(["receipt"]);

  await page.goto("/inventory/risk");
  const flagCard = page.locator(`[data-risk-flag="${flagId}"]`);
  await expect(flagCard).toBeVisible({ timeout: 30_000 });
  await expect(flagCard).toHaveAttribute("data-flag-approved", "false");
  await expect(flagCard).toHaveAttribute("data-flag-ledger-entry", "");
  // Said in words, because "pending" reads as "done" to someone scanning.
  await expect(flagCard.getByText("Not written off yet")).toBeVisible();
  // And the rule is named in plain language, not as an enum.
  await expect(
    flagCard.getByText("A lot of value in one write-off"),
  ).toBeVisible();

  // ---- the person who raised it cannot approve it ----------------------
  // Signed in as the same manager who raised it, so this is self-approval.
  await flagCard.locator(`#approve-variant-${flagId}`).selectOption(variantId);
  await flagCard.locator(`#approve-quantity-${flagId}`).fill("-1");
  await flagCard
    .locator(`#approve-reason-${flagId}`)
    .fill("One found damaged during the count and written off.");
  await flagCard.locator(`#approve-${flagId}`).click();

  await expect(
    flagCard.getByText("you cannot be the one to approve it", {
      exact: false,
    }),
  ).toBeVisible({ timeout: 30_000 });

  // Still nothing moved.
  const { data: afterSelfApproval } = await admin
    .from("stock_ledger_entries")
    .select("kind")
    .eq("location_id", locationId);
  expect(afterSelfApproval!.map((entry) => entry.kind)).toEqual(["receipt"]);

  // ---- a sweep records reads and moves nothing at all ------------------
  await page.goto("/inventory/risk");
  await page.selectOption("#sweep-location", locationId);
  await page.fill("#sweep-zone", "floor");
  await page.fill(
    "#sweep-reads",
    // The same tag four times as the reader passes it, one good second tag,
    // one poor read, and one that should not be in this zone.
    [
      `${tag("A")} 0.97`,
      `${tag("A")} 0.95`,
      `${tag("A")} 0.99`,
      `${tag("A")} 0.92`,
      `${tag("B")} 0.88`,
      `${tag("C")} 0.41`,
      `${tag("Z")} 0.95`,
    ].join("\n"),
  );
  await page.fill("#sweep-expected", [tag("A"), tag("B"), tag("D")].join("\n"));
  await page.getByRole("button", { name: "Record sweep" }).click();

  // The sweep says what it found, and says out loud that nothing moved.
  await expect(page.getByText("No stock was moved.")).toBeVisible({
    timeout: 30_000,
  });

  // Four reads of one tag are one garment, so "3 found" not "6 found".
  await expect(page.getByText("3 found", { exact: false })).toBeVisible();

  // The hard guarantee: still exactly one ledger entry at this location.
  const { data: afterSweep } = await admin
    .from("stock_ledger_entries")
    .select("kind")
    .eq("location_id", locationId);
  expect(afterSweep!.map((entry) => entry.kind)).toEqual(["receipt"]);

  // ---- the unread tag is reported as unread, never as missing ----------
  await page.goto("/inventory/risk");
  const unobserved = page
    .locator('[data-discrepancy-kind="unobserved"]')
    .filter({ hasText: tag("D") });
  await expect(unobserved).toBeVisible({ timeout: 30_000 });
  await expect(unobserved.getByText("Expected here, not read")).toBeVisible();
  // The word "missing" invites a write-off nobody counted, so no discrepancy
  // is labelled with it. Scoped to the list: the sweep form's own hint says
  // "never as missing", and an unscoped scan matches the copy that explains
  // the absence — the guard would then be testing itself.
  await expect(
    page.locator("[data-discrepancy]").getByText("missing", { exact: false }),
  ).toHaveCount(0);

  const unexpected = page
    .locator('[data-discrepancy-kind="unexpected"]')
    .filter({ hasText: tag("Z") });
  await expect(unexpected).toBeVisible();

  // ---- a discrepancy cannot be closed without saying why ---------------
  const discrepancyId = await unobserved.getAttribute("data-discrepancy");
  await page.locator(`#resolve-note-${discrepancyId}`).fill("ok");
  await page.locator(`#resolve-${discrepancyId}`).click();
  await expect(
    page.getByText("cannot be told apart from one that was ignored", {
      exact: false,
    }),
  ).toBeVisible({ timeout: 30_000 });

  // ---- with an explanation it closes ----------------------------------
  await page.goto("/inventory/risk");
  await page
    .locator(`#resolve-note-${discrepancyId}`)
    .fill(
      "Tag was on a jacket in the fitting room, not on the floor when the reader passed.",
    );
  await page.locator(`#resolve-${discrepancyId}`).click();

  await expect
    .poll(
      async () => {
        const { data } = await admin
          .from("rfid_sweep_discrepancies")
          .select("resolved_at, resolution_note")
          .eq("id", discrepancyId!)
          .single();
        return data?.resolved_at === null ? "open" : "closed";
      },
      { timeout: 60_000 },
    )
    .toBe("closed");

  // The explanation is stored, not just demanded at the door.
  const { data: closed } = await admin
    .from("rfid_sweep_discrepancies")
    .select("resolution_note")
    .eq("id", discrepancyId!)
    .single();
  expect(closed!.resolution_note).toContain("fitting room");

  proofPassed = true;
});
