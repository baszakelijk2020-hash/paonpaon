import { createSupabaseAdminClient } from "@paon/database";
import { DEMO_PASSWORD } from "@paon/database/demo-seed";
import { ensureProgrammeProofSeed } from "@paon/database/programme-proof-seed";
import { PROGRAMME_PROOF_PERSONAS } from "@paon/domain";
import { expect, test, type Page } from "@playwright/test";

import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "13.1";
const BROWSER_PROOF_SPEC = "apps/retailer/e2e/inventory.spec.ts";

let receivingProofPassed = false;
let transferProofPassed = false;

test.afterAll(async () => {
  await writeBrowserProofRun({
    phaseItemId: PHASE_ITEM_ID,
    spec: BROWSER_PROOF_SPEC,
    status: receivingProofPassed && transferProofPassed ? "passed" : "failed",
  });
});

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

test("manager receives stock, is blocked from overselling, and explains a count difference", async ({
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

  // Fresh locations per run, so a leftover balance can never make an
  // assertion pass by accident. Two, because a transfer needs somewhere to
  // go and the page's "To" select defaults to the second one.
  const stamp = Date.now();
  const { data: floor } = await admin
    .from("stock_locations")
    .insert({
      retailer_id: proof.retailerId,
      code: `E2E-FLOOR-${stamp}`,
      name: `E2E Floor ${stamp}`,
      active: true,
    })
    .select("id")
    .single();
  await admin.from("stock_locations").insert({
    retailer_id: proof.retailerId,
    code: `E2E-BACK-${stamp}`,
    name: `E2E Back ${stamp}`,
    active: true,
  });
  const locationId = floor!.id;

  const url = `/inventory?location=${locationId}`;

  /**
   * Waits for a variant row to reach an exact projected balance, reading
   * machine-readable attributes rather than prose. A page that renders
   * "3 available" also renders the word "available" elsewhere; asserting on
   * text is how a poll passes before the write has landed.
   */
  async function waitForBalance(
    variantId: string,
    onHand: number,
    available: number,
  ): Promise<void> {
    await expect
      .poll(
        async () => {
          await page.goto(url);
          const row = page.locator(`[data-variant-id="${variantId}"]`);
          if ((await row.count()) === 0) return "absent";
          return `${await row.getAttribute("data-on-hand")}/${await row.getAttribute("data-available")}`;
        },
        { timeout: 60_000 },
      )
      .toBe(`${onHand}/${available}`);
  }

  await signIn(page, PROGRAMME_PROOF_PERSONAS.manager.email);
  await page.goto(url);

  // Designed empty state, not a blank table.
  await expect(page.locator("#inventory-no-stock")).toBeVisible();

  // The item the page offers first, so the test drives what a user drives.
  const variantId = await page
    .locator("#receive-variant option")
    .first()
    .getAttribute("value");
  expect(variantId).toBeTruthy();

  // ---- receive ---------------------------------------------------------
  await page.selectOption("#receive-location", locationId);
  // 20, not 3. A count of 2-out-of-3 is a 33% variance, which correctly
  // trips the relative recount threshold, so the page hides the adjust form
  // and the assertions below would be testing the recount rule while
  // claiming to test the adjustment rule. 19-out-of-20 is 5%.
  await page.fill("#receive-quantity", "20");
  await page.getByRole("button", { name: "Receive stock" }).click();
  await waitForBalance(variantId!, 20, 20);

  // ---- a hold promises stock without moving it -------------------------
  await page.selectOption("#hold-variant", variantId!);
  await page.selectOption("#hold-location", locationId);
  await page.fill("#hold-quantity", "20");
  await page.getByRole("button", { name: "Hold for a client" }).click();
  // On-hand unchanged, available gone: reserving promises a garment rather
  // than moving one. This is the distinction the whole ledger exists for.
  await waitForBalance(variantId!, 20, 0);

  // ---- the oversell is refused, with a readable reason ------------------
  await page.selectOption("#hold-variant", variantId!);
  await page.selectOption("#hold-location", locationId);
  await page.fill("#hold-quantity", "1");
  await page.getByRole("button", { name: "Hold for a client" }).click();
  await expect(
    page.getByText("Some of this stock is already promised to someone."),
  ).toBeVisible({ timeout: 30_000 });
  // And nothing changed as a result of the refusal.
  await waitForBalance(variantId!, 20, 0);

  // ---- a blind count that finds fewer ----------------------------------
  await page.goto(url);
  await page.selectOption("#count-location", locationId);
  await page.getByRole("button", { name: "Start a stock count" }).click();
  await expect(page.locator("#inventory-count-open")).toBeVisible({
    timeout: 30_000,
  });

  await page.selectOption("#countline-variant", variantId!);
  await page.fill("#countline-quantity", "19");
  await page.getByRole("button", { name: "Record what you counted" }).click();

  const variance = page.locator(`[data-variance-variant="${variantId}"]`);
  await expect
    .poll(
      async () => {
        await page.goto(url);
        const row = page.locator(`[data-variance-variant="${variantId}"]`);
        if ((await row.count()) === 0) return "absent";
        return row.getAttribute("data-variance-quantity");
      },
      { timeout: 60_000 },
    )
    .toBe("-1");

  // Plain language, not an enum or a signed integer on its own.
  await expect(variance).toContainText("fewer than the ledger");

  // ---- an unexplained adjustment is refused ----------------------------
  await variance.locator(`#adjust-${variantId}`).fill("-1");
  await variance.locator(`#reason-${variantId}`).fill("");
  await variance.getByRole("button", { name: "Record adjustment" }).click();
  await expect(
    variance.getByText("an unexplained adjustment is indistinguishable"),
  ).toBeVisible({ timeout: 30_000 });

  // ---- and an over-large one is refused against the count --------------
  await page.goto(url);
  const varianceAgain = page.locator(`[data-variance-variant="${variantId}"]`);
  await varianceAgain.locator(`#adjust-${variantId}`).fill("-3");
  await varianceAgain
    .locator(`#reason-${variantId}`)
    .fill("Trying to write off more than was counted.");
  await varianceAgain
    .getByRole("button", { name: "Record adjustment" })
    .click();
  await expect(
    varianceAgain.getByText("more than the count actually found"),
  ).toBeVisible({ timeout: 30_000 });

  // ---- the explained adjustment lands ----------------------------------
  await page.goto(url);
  const varianceFinal = page.locator(`[data-variance-variant="${variantId}"]`);
  await varianceFinal.locator(`#adjust-${variantId}`).fill("-1");
  await varianceFinal
    .locator(`#reason-${variantId}`)
    .fill("One found damaged during the count and written off.");
  await varianceFinal
    .getByRole("button", { name: "Record adjustment" })
    .click();

  // On-hand falls to 19 while 20 are promised, so the shop IS oversold and
  // the page must say so rather than clamp availability at zero.
  await waitForBalance(variantId!, 19, -1);
  await expect(
    page.locator(`[data-variant-id="${variantId}"]`).getByText("oversold"),
  ).toBeVisible();

  // ---- the database agrees, and the ledger is append-only -------------
  const { data: entries, error: entriesError } = await admin
    .from("stock_ledger_entries")
    .select("kind, quantity, reason, count_session_id")
    .eq("retailer_id", proof.retailerId)
    .eq("location_id", locationId)
    .order("occurred_at", { ascending: true });
  expect(entriesError).toBeNull();

  const kinds = (entries ?? []).map((e) => e.kind);
  expect(kinds).toEqual(["receipt", "reservation", "count_adjustment"]);

  const adjustment = entries!.find((e) => e.kind === "count_adjustment")!;
  // The signed adjustment that 20260801000017 made possible at all.
  expect(adjustment.quantity).toBe(-1);
  expect(adjustment.reason).toContain("found damaged");
  // Tied to the count it came from, so shrinkage stays analysable.
  expect(adjustment.count_session_id).not.toBeNull();

  // The refused hold left no row behind: a refusal must not half-write.
  expect(kinds.filter((k) => k === "reservation")).toHaveLength(1);

  receivingProofPassed = true;
});

/**
 * Transfer is the fourth named write path in this item's Acceptance line
 * ("purchase receipt, transfer, sale reservation and blind count reconcile")
 * and is exercised in its own scenario with fresh locations, rather than
 * folded into the scenario above: by the end of that test the origin
 * location is deliberately oversold (on-hand 19, available -1), and a
 * transfer correctly refuses to move stock from a location that has none
 * available — testing it there would be testing the refusal, not the move.
 */
test("a manager transfers stock between two locations, and the ledger records both entries", async ({
  page,
}) => {
  test.setTimeout(180_000);

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
  const { data: origin } = await admin
    .from("stock_locations")
    .insert({
      retailer_id: proof.retailerId,
      code: `E2E-ORIGIN-${stamp}`,
      name: `E2E Origin ${stamp}`,
      active: true,
    })
    .select("id")
    .single();
  const { data: destination } = await admin
    .from("stock_locations")
    .insert({
      retailer_id: proof.retailerId,
      code: `E2E-DEST-${stamp}`,
      name: `E2E Destination ${stamp}`,
      active: true,
    })
    .select("id")
    .single();
  const originId = origin!.id;
  const destinationId = destination!.id;

  async function waitForBalanceAt(
    locationId: string,
    variantId: string,
    onHand: number,
    available: number,
  ): Promise<void> {
    await expect
      .poll(
        async () => {
          await page.goto(`/inventory?location=${locationId}`);
          const row = page.locator(`[data-variant-id="${variantId}"]`);
          if ((await row.count()) === 0) return "absent";
          return `${await row.getAttribute("data-on-hand")}/${await row.getAttribute("data-available")}`;
        },
        { timeout: 60_000 },
      )
      .toBe(`${onHand}/${available}`);
  }

  await signIn(page, PROGRAMME_PROOF_PERSONAS.manager.email);
  await page.goto(`/inventory?location=${originId}`);

  const variantId = await page
    .locator("#receive-variant option")
    .first()
    .getAttribute("value");
  expect(variantId).toBeTruthy();

  // ---- receive at the origin --------------------------------------------
  await page.selectOption("#receive-location", originId);
  await page.fill("#receive-quantity", "10");
  await page.getByRole("button", { name: "Receive stock" }).click();
  await waitForBalanceAt(originId, variantId!, 10, 10);

  // ---- move some of it to the destination -------------------------------
  await page.goto(`/inventory?location=${originId}`);
  await page.selectOption("#transfer-variant", variantId!);
  await page.selectOption("#transfer-from", originId);
  await page.selectOption("#transfer-to", destinationId);
  await page.fill("#transfer-quantity", "4");
  await page.getByRole("button", { name: "Move stock" }).click();

  await waitForBalanceAt(originId, variantId!, 6, 6);
  await waitForBalanceAt(destinationId, variantId!, 4, 4);

  // ---- the ledger records two entries, not one --------------------------
  const { data: originEntries } = await admin
    .from("stock_ledger_entries")
    .select("kind, quantity")
    .eq("retailer_id", proof.retailerId)
    .eq("location_id", originId)
    .order("occurred_at", { ascending: true });
  expect((originEntries ?? []).map((e) => e.kind)).toEqual([
    "receipt",
    "transfer_out",
  ]);
  // Stored as a magnitude; the ledger's sign per kind (transfer_out: -1,
  // transfer_in: +1) is applied when projecting a balance, not in the row.
  expect(originEntries!.find((e) => e.kind === "transfer_out")!.quantity).toBe(
    4,
  );

  const { data: destinationEntries } = await admin
    .from("stock_ledger_entries")
    .select("kind, quantity")
    .eq("retailer_id", proof.retailerId)
    .eq("location_id", destinationId);
  expect((destinationEntries ?? []).map((e) => e.kind)).toEqual([
    "transfer_in",
  ]);
  expect(destinationEntries![0]!.quantity).toBe(4);

  // ---- moving more than is available at the origin is refused -----------
  await page.goto(`/inventory?location=${originId}`);
  await page.selectOption("#transfer-variant", variantId!);
  await page.selectOption("#transfer-from", originId);
  await page.selectOption("#transfer-to", destinationId);
  await page.fill("#transfer-quantity", "999");
  await page.getByRole("button", { name: "Move stock" }).click();
  await expect(page.getByText(/Not enough available/i)).toBeVisible({
    timeout: 30_000,
  });
  // In-transit stayed put: still exactly two ledger rows at the origin.
  const { data: afterRefusal } = await admin
    .from("stock_ledger_entries")
    .select("id")
    .eq("retailer_id", proof.retailerId)
    .eq("location_id", originId);
  expect(afterRefusal ?? []).toHaveLength(2);

  transferProofPassed = true;
});
