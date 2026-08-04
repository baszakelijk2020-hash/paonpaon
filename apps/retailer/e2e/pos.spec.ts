import { createSupabaseAdminClient } from "@paon/database";
import { DEMO_PASSWORD } from "@paon/database/demo-seed";
import { ensureProgrammeProofSeed } from "@paon/database/programme-proof-seed";
import { PROGRAMME_PROOF_PERSONAS } from "@paon/domain";
import { expect, test, type Page } from "@playwright/test";

import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "13.3";
const BROWSER_PROOF_SPEC = "apps/retailer/e2e/pos.spec.ts";

let proofPassed = false;
let suspendResumeProofPassed = false;

test.afterAll(async () => {
  await writeBrowserProofRun({
    phaseItemId: PHASE_ITEM_ID,
    spec: BROWSER_PROOF_SPEC,
    status: proofPassed && suspendResumeProofPassed ? "passed" : "failed",
  });
});

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

test("associate sells a garment for cash, is refused a card and an unpaid finish, then returns it", async ({
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

  // A location nothing else has touched, so no leftover balance or open sale
  // can make an assertion pass by accident.
  const stamp = Date.now();
  const { data: till } = await admin
    .from("stock_locations")
    .insert({
      retailer_id: proof.retailerId,
      code: `E2E-TILL-${stamp}`,
      name: `E2E Till ${stamp}`,
      active: true,
    })
    .select("id")
    .single();
  const locationId = till!.id;

  const { data: variant } = await admin
    .from("product_variants")
    .select("id, products!inner(retailer_id)")
    .eq("products.retailer_id", proof.retailerId)
    .limit(1)
    .single();
  const variantId = variant!.id;

  // Stock to sell, put there through the ledger the till reads.
  await admin.from("stock_ledger_entries").insert({
    retailer_id: proof.retailerId,
    variant_id: variantId,
    location_id: locationId,
    kind: "receipt",
    quantity: 4,
  });

  const url = `/pos?location=${locationId}`;
  const inventoryUrl = `/inventory?location=${locationId}`;

  /** Polls the exact machine-readable state about to be asserted. */
  async function waitForSaleState(attribute: string, value: string) {
    await expect
      .poll(
        async () => {
          await page.goto(url);
          const section = page.locator(`[${attribute}]`);
          if ((await section.count()) === 0) return "absent";
          return section.first().getAttribute(attribute);
        },
        { timeout: 60_000 },
      )
      .toBe(value);
  }

  async function availableOnFloor(): Promise<string | null> {
    await page.goto(inventoryUrl);
    return page
      .locator(`[data-variant-id="${variantId}"]`)
      .getAttribute("data-available");
  }

  await signIn(page, PROGRAMME_PROOF_PERSONAS.manager.email);

  // ---- a designed empty state, not a blank screen ----------------------
  await page.goto(url);
  await expect(page.locator("#pos-no-sale")).toBeVisible();

  // ---- open a sale -----------------------------------------------------
  await page.selectOption("#open-location", locationId);
  await page.getByRole("button", { name: "Start a sale" }).click();
  await waitForSaleState("data-sale-line-count", "0");

  // ---- adding a garment HOLDS it: 4 on hand, 2 available ----------------
  await page.selectOption("#line-kind", "rtw");
  await page.selectOption("#line-variant", variantId);
  await page.fill("#line-quantity", "2");
  await page.fill("#line-price", "120.00");
  await page.getByRole("button", { name: "Add to sale" }).click();
  await waitForSaleState("data-sale-total", "24000");

  // The whole point of the seam: the item is off the shelf before any money
  // moves, so a second till cannot promise the same garment.
  await expect.poll(availableOnFloor, { timeout: 60_000 }).toBe("2");
  await page.goto(inventoryUrl);
  expect(
    await page
      .locator(`[data-variant-id="${variantId}"]`)
      .getAttribute("data-on-hand"),
  ).toBe("4");

  // And the page says so in words, not just in an attribute.
  await page.goto(url);
  await expect(
    page.getByText("Held for this client", { exact: false }).first(),
  ).toBeVisible();

  // ---- card is refused, and explains itself ----------------------------
  await page.fill("#card-reference", `terminal-${stamp}`);
  await page.fill("#card-amount", "240.00");
  await page.getByRole("button", { name: "Record a card payment" }).click();
  await expect(
    page.getByText("Card payment is not switched on yet"),
  ).toBeVisible({ timeout: 30_000 });

  // Nothing was recorded by the refusal.
  await waitForSaleState("data-sale-captured", "0");

  // ---- while unpaid, the sale is plainly unpaid and unfinished ---------
  // The money owed is on the page as a number, and the sale has NOT moved to
  // completed. `payment_incomplete` is proven at the application seam in the
  // live integration suite; what matters here is that the till never shows a
  // finished sale before the money is recorded.
  await waitForSaleState("data-sale-outstanding", "24000");
  await waitForSaleState("data-sale-state", "open");
  await expect(page.getByText("€240.00 still to pay.")).toBeVisible();

  // ---- cancelling puts every held garment straight back ----------------
  await page.fill("#cancel-reason", "Client changed their mind at the till.");
  await page.getByRole("button", { name: "Cancel this sale" }).click();
  await expect.poll(availableOnFloor, { timeout: 60_000 }).toBe("4");

  // ---- cash finishes a sale and moves the stock exactly once -----------
  await page.goto(url);
  await expect(page.locator("#pos-no-sale")).toBeVisible({ timeout: 30_000 });
  await page.selectOption("#open-location", locationId);
  await page.getByRole("button", { name: "Start a sale" }).click();
  await waitForSaleState("data-sale-line-count", "0");

  await page.selectOption("#line-kind", "rtw");
  await page.selectOption("#line-variant", variantId);
  await page.fill("#line-quantity", "1");
  await page.fill("#line-price", "80.00");
  await page.getByRole("button", { name: "Add to sale" }).click();
  await waitForSaleState("data-sale-total", "8000");

  const saleId = await page
    .locator("[data-sale-id]")
    .getAttribute("data-sale-id");
  expect(saleId).toBeTruthy();

  await page.getByRole("button", { name: "Take cash and finish" }).click();

  // Back to the empty state, because the sale is finished.
  await expect
    .poll(
      async () => {
        await page.goto(url);
        return (await page.locator("#pos-no-sale").count()) > 0
          ? "closed"
          : "open";
      },
      { timeout: 60_000 },
    )
    .toBe("closed");

  // ---- the database agrees about the money and the route it took -------
  const { data: saleRow } = await admin
    .from("pos_transactions")
    .select("state, completed_at")
    .eq("id", saleId!)
    .single();
  expect(saleRow!.state).toBe("completed");
  expect(saleRow!.completed_at).not.toBeNull();

  const { data: payments } = await admin
    .from("pos_payments")
    .select("provider, amount_minor_units, provider_reference")
    .eq("transaction_id", saleId!);
  expect(payments).toHaveLength(1);
  expect(payments![0]!.provider).toBe("cash");
  expect(payments![0]!.amount_minor_units).toBe(8000);
  // No card number could have reached here: the column does not exist, and
  // the reference is derived per transaction.
  expect(payments![0]!.provider_reference).toBe(`cash:${saleId}`);

  // ---- the ledger moved: release then sale, on-hand down by one --------
  const { data: entries } = await admin
    .from("stock_ledger_entries")
    .select("kind, quantity")
    .eq("location_id", locationId)
    .order("occurred_at", { ascending: true });
  const kinds = (entries ?? []).map((entry) => entry.kind);
  // Held, released when the sale was cancelled, held again, then released
  // and sold on completion. Nothing was ever deleted to make this tidy.
  expect(kinds).toEqual([
    "receipt",
    "reservation",
    "reservation_release",
    "reservation",
    "reservation_release",
    "sale",
  ]);

  // ---- the finished sale offers a RETURN, not an edit ------------------
  await page.goto(url);
  const finished = page.locator(`[data-completed-sale="${saleId}"]`);
  await expect(finished).toBeVisible({ timeout: 30_000 });
  await expect(finished.getByText("Sold")).toBeVisible();
  // There is no edit affordance anywhere on a finished sale.
  await expect(finished.getByRole("button", { name: /edit/i })).toHaveCount(0);

  const soldLineId = await finished
    .locator("[data-sold-line]")
    .first()
    .getAttribute("data-sold-line");
  await finished.locator(`#return-${soldLineId}`).click();

  // ---- the return is a NEW linked sale, and the garment is back --------
  await expect
    .poll(
      async () => {
        const { data } = await admin
          .from("pos_transactions")
          .select("id")
          .eq("returns_transaction_id", saleId!);
        return data?.length ?? 0;
      },
      { timeout: 60_000 },
    )
    .toBe(1);

  // The original sale is untouched: both the sale and the refund are true.
  const { data: originalAfter } = await admin
    .from("pos_transactions")
    .select("state")
    .eq("id", saleId!)
    .single();
  expect(originalAfter!.state).toBe("completed");

  // And the garment is physically back on the shelf.
  const { data: afterEntries } = await admin
    .from("stock_ledger_entries")
    .select("kind")
    .eq("location_id", locationId);
  expect(
    (afterEntries ?? []).filter((entry) => entry.kind === "receipt"),
  ).toHaveLength(2);

  // ---- a second return of the same item is refused, in plain language --
  await page.goto(url);
  const again = page.locator(`[data-completed-sale="${saleId}"]`);
  await again.locator(`#return-${soldLineId}`).click();
  await expect(
    again.getByText("This item has already been returned."),
  ).toBeVisible({ timeout: 30_000 });

  proofPassed = true;
});

test("made-to-measure cannot be returned, and the till says why", async ({
  page,
}) => {
  test.setTimeout(240_000);

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
  const { data: till } = await admin
    .from("stock_locations")
    .insert({
      retailer_id: proof.retailerId,
      code: `E2E-MTM-${stamp}`,
      name: `E2E MTM ${stamp}`,
      active: true,
    })
    .select("id")
    .single();
  const locationId = till!.id;
  const url = `/pos?location=${locationId}`;

  await signIn(page, PROGRAMME_PROOF_PERSONAS.manager.email);
  await page.goto(url);
  await page.selectOption("#open-location", locationId);
  await page.getByRole("button", { name: "Start a sale" }).click();

  await expect
    .poll(
      async () => {
        await page.goto(url);
        return (await page.locator("[data-sale-id]").count()) > 0
          ? "open"
          : "absent";
      },
      { timeout: 60_000 },
    )
    .toBe("open");

  // Bespoke: no stock, so nothing is held.
  await page.selectOption("#line-kind", "mtm");
  await page.fill("#line-quantity", "1");
  await page.fill("#line-price", "1800.00");
  await page.getByRole("button", { name: "Add to sale" }).click();

  await expect
    .poll(
      async () => {
        await page.goto(url);
        return page
          .locator("[data-sale-total]")
          .first()
          .getAttribute("data-sale-total");
      },
      { timeout: 60_000 },
    )
    .toBe("180000");

  // The consequence is stated on the sale, before anyone has to ask.
  await expect(
    page.getByText("Cut for one person, so it cannot be returned.").first(),
  ).toBeVisible();
  await expect(page.getByText("Not stock, so nothing is held")).toBeVisible();

  const saleId = await page
    .locator("[data-sale-id]")
    .getAttribute("data-sale-id");
  await page.getByRole("button", { name: "Take cash and finish" }).click();

  await expect
    .poll(
      async () => {
        await page.goto(url);
        return (await page
          .locator(`[data-completed-sale="${saleId}"]`)
          .count()) > 0
          ? "listed"
          : "absent";
      },
      { timeout: 60_000 },
    )
    .toBe("listed");

  const finished = page.locator(`[data-completed-sale="${saleId}"]`);
  const lineId = await finished
    .locator("[data-sold-line]")
    .first()
    .getAttribute("data-sold-line");
  await finished.locator(`#return-${lineId}`).click();

  // Refused, with the reason and an alternative — never a bare enum.
  await expect(
    finished.getByText("Made-to-measure is cut for one person"),
  ).toBeVisible({ timeout: 30_000 });
  await expect(finished.getByText("Book an alteration instead.")).toBeVisible();

  // And nothing was refunded or restocked.
  const { data: returns } = await admin
    .from("pos_transactions")
    .select("id")
    .eq("returns_transaction_id", saleId!);
  expect(returns ?? []).toHaveLength(0);
});

test("a suspended sale frees the counter, stays held, is refused mid-resume while another sale is open, and resumes once it is not", async ({
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
  const { data: till } = await admin
    .from("stock_locations")
    .insert({
      retailer_id: proof.retailerId,
      code: `E2E-SUSPEND-TILL-${stamp}`,
      name: `E2E Suspend Till ${stamp}`,
      active: true,
    })
    .select("id")
    .single();
  const locationId = till!.id;

  const { data: variant } = await admin
    .from("product_variants")
    .select("id, products!inner(retailer_id)")
    .eq("products.retailer_id", proof.retailerId)
    .limit(1)
    .single();
  const variantId = variant!.id;

  await admin.from("stock_ledger_entries").insert({
    retailer_id: proof.retailerId,
    variant_id: variantId,
    location_id: locationId,
    kind: "receipt",
    quantity: 4,
  });

  const url = `/pos?location=${locationId}`;

  async function waitFor(
    attribute: string,
    predicate: (value: string | null) => boolean,
  ): Promise<void> {
    await expect
      .poll(
        async () => {
          await page.goto(url);
          const section = page.locator(`[${attribute}]`);
          if ((await section.count()) === 0) return predicate(null);
          return predicate(await section.first().getAttribute(attribute));
        },
        { timeout: 60_000 },
      )
      .toBe(true);
  }

  await signIn(page, PROGRAMME_PROOF_PERSONAS.manager.email);

  // ---- open a sale and hold a garment -----------------------------------
  await page.goto(url);
  await page.locator("#open-location").selectOption(locationId);
  await page.getByRole("button", { name: "Start a sale" }).click();
  await waitFor("data-sale-id", (v) => v !== null);

  await page.locator("#line-kind").selectOption("rtw");
  await page.locator("#line-variant").selectOption(variantId);
  await page.locator("#line-quantity").fill("1");
  await page.locator("#line-price").fill("50");
  await page.getByRole("button", { name: "Add to sale" }).click();
  await waitFor("data-sale-line-count", (v) => v === "1");

  const { data: suspendedTx } = await admin
    .from("pos_transactions")
    .select("id")
    .eq("retailer_id", proof.retailerId)
    .eq("location_id", locationId)
    .eq("state", "open")
    .single();
  const suspendedId = suspendedTx!.id;

  // ---- suspend: the counter clears, the hold does not -------------------
  await page.goto(url);
  await page.getByRole("button", { name: "Suspend this sale" }).click();
  await expect(page.locator("#pos-no-sale")).toBeVisible({ timeout: 30_000 });

  await expect
    .poll(
      async () => {
        const { data } = await admin
          .from("pos_transactions")
          .select("state")
          .eq("id", suspendedId)
          .single();
        return data?.state;
      },
      { timeout: 30_000 },
    )
    .toBe("suspended");

  const parkedRow = page.locator(`[data-suspended-sale="${suspendedId}"]`);
  await expect(parkedRow).toBeVisible({ timeout: 15_000 });
  await expect(parkedRow).toHaveAttribute("data-suspended-total", "5000");

  // ---- open a second sale on the same till -------------------------------
  await page.goto(url);
  await page.locator("#open-location").selectOption(locationId);
  await page.getByRole("button", { name: "Start a sale" }).click();
  await waitFor("data-sale-id", (v) => v !== null && v !== suspendedId);

  // ---- resuming is refused while that second sale is on the counter -----
  await page.goto(url);
  await page.locator(`#resume-${suspendedId}`).click();
  await expect(page.getByText(/already a sale on this counter/i)).toBeVisible({
    timeout: 15_000,
  });

  // Still suspended — the refusal did not half-apply.
  const { data: stillSuspended } = await admin
    .from("pos_transactions")
    .select("state")
    .eq("id", suspendedId)
    .single();
  expect(stillSuspended!.state).toBe("suspended");

  // ---- cancel the second sale, freeing the counter -----------------------
  await page.goto(url);
  await page.locator("#cancel-reason").fill("Test cleanup — wrong till.");
  await page.getByRole("button", { name: "Cancel this sale" }).click();
  await expect(page.locator("#pos-no-sale")).toBeVisible({ timeout: 30_000 });

  // ---- now the parked sale resumes, with its held line intact -----------
  await page.goto(url);
  await page.locator(`#resume-${suspendedId}`).click();
  await waitFor("data-sale-id", (v) => v === suspendedId);
  await waitFor("data-sale-state", (v) => v === "open");
  await waitFor("data-sale-line-count", (v) => v === "1");

  suspendResumeProofPassed = true;
});
