/**
 * Live proof that stock has ONE truth (PHASE 13.1 follow-up).
 *
 * Before migrations 18 and 19, `place_order` / `checkout_cart` decremented
 * `product_variants.inventory_quantity` while the till appended to
 * `stock_ledger_entries`, and neither could see the other. A garment sold
 * online was still promisable at the counter, and vice versa. Both screens
 * looked right while the shop oversold.
 *
 * These assertions exist to stop that reappearing. Every one of them checks
 * the SEAM between the two systems rather than either side on its own.
 *
 * Run with:
 *   PAON_INTEGRATION=1 pnpm --filter @paon/database exec vitest run \
 *     src/repositories/__integration__
 */

import type { RetailerId } from "@paon/domain";
import { beforeAll, describe, expect, it } from "vitest";

import type { PaonSupabaseClient } from "../../client-type";
import { createSupabaseAdminClient } from "../../clients/admin";
import { StockLedgerRepository } from "../stock-ledger-repository";

import { findProductId, findStaffCohort } from "./fixture-selection";

const LIVE = process.env["PAON_INTEGRATION"] === "1";
const RUN = Date.now();

let admin: PaonSupabaseClient;
let ledger: StockLedgerRepository;
let retailerId: RetailerId;
let productId: string;
let staffId: string;

/** A variant nothing else has touched, created through the normal path. */
async function freshVariant(tag: string, opening: number): Promise<string> {
  const { data, error } = await admin
    .from("product_variants")
    .insert({
      product_id: productId,
      sku: `TRUTH-${tag}-${RUN}`,
      inventory_quantity: opening,
      price_amount_minor_units: 10000,
      price_currency: "EUR",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

/**
 * Sets the catalogue quantity the way `checkout_cart` does, and CHECKS the
 * error. An unchecked supabase-js write error is indistinguishable from a
 * silent no-op, which is how the trigger recursion in migration 19 hid.
 */
async function setColumn(variantId: string, quantity: number): Promise<void> {
  const { error } = await admin
    .from("product_variants")
    .update({ inventory_quantity: quantity })
    .eq("id", variantId);
  expect(error).toBeNull();
}

async function columnQuantity(variantId: string): Promise<number> {
  const { data } = await admin
    .from("product_variants")
    .select("inventory_quantity")
    .eq("id", variantId)
    .single();
  return data!.inventory_quantity;
}

describe.skipIf(!LIVE)("stock has one truth (13.1 / 13.3 seam)", () => {
  beforeAll(async () => {
    const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
    const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!url || !key) throw new Error("Live integration needs Supabase env.");
    admin = createSupabaseAdminClient(url, key);
    ledger = new StockLedgerRepository(admin);

    const cohort = await findStaffCohort(admin, 1);
    retailerId = cohort.retailerId;
    staffId = cohort.staff[0]!.id;
    productId = await findProductId(admin, retailerId);
  });

  it("a new variant's opening stock exists in the LEDGER, not only the column", async () => {
    const variantId = await freshVariant("OPENING", 7);

    const { data: entries } = await admin
      .from("stock_ledger_entries")
      .select("kind, quantity, reason")
      .eq("variant_id", variantId);

    expect(entries).toHaveLength(1);
    expect(entries![0]!.kind).toBe("receipt");
    expect(entries![0]!.quantity).toBe(7);
    // Where the number came from, so a later variance is still explicable.
    expect(entries![0]!.reason).toContain("Opening stock");

    const balance = await ledger.balanceFor({
      retailerId,
      variantId,
      locationId: (await onlineLocation()).id,
    });
    expect(balance.onHand).toBe(7);
  });

  /** The location an online order draws from. */
  async function onlineLocation(): Promise<{ id: string }> {
    const { data } = await admin
      .from("stock_locations")
      .select("id")
      .eq("retailer_id", retailerId)
      .eq("code", "ONLINE")
      .single();
    return data!;
  }

  it("an ONLINE sale reaches the till's ledger", async () => {
    const variantId = await freshVariant("ONLINE", 5);
    const { id: locationId } = await onlineLocation();

    // Exactly what checkout_cart does: decrement the catalogue column.
    await setColumn(variantId, 3);

    // The till must now see 3, not 5 — otherwise it would promise a garment
    // that has already left the building.
    const balance = await ledger.balanceFor({
      retailerId,
      variantId,
      locationId,
    });
    expect(balance.onHand).toBe(3);

    const { data: entries } = await admin
      .from("stock_ledger_entries")
      .select("kind, quantity")
      .eq("variant_id", variantId)
      .eq("kind", "sale");
    expect(entries).toHaveLength(1);
    expect(entries![0]!.quantity).toBe(2);
  });

  it("a TILL sale reaches the storefront's number", async () => {
    const variantId = await freshVariant("TILL", 4);
    const { id: locationId } = await onlineLocation();

    await ledger.sell({ retailerId, variantId, locationId, quantity: 3 });

    // The storefront guard reads the column. If it still said 4, the webshop
    // would sell a garment that is already in a customer's bag.
    expect(await columnQuantity(variantId)).toBe(1);
  });

  it("a till HOLD makes stock unsellable online", async () => {
    const variantId = await freshVariant("HOLD", 2);
    const { id: locationId } = await onlineLocation();

    await ledger.reserve({ retailerId, variantId, locationId, quantity: 2 });

    // The cache tracks AVAILABLE, not on-hand: a garment promised to someone
    // standing in the shop must not be sold from under them online, and
    // on-hand would say yes to both.
    expect(await columnQuantity(variantId)).toBe(0);

    const balance = await ledger.balanceFor({
      retailerId,
      variantId,
      locationId,
    });
    expect(balance.onHand).toBe(2);
    expect(balance.reserved).toBe(2);
  });

  it("releasing a hold puts it back on sale online", async () => {
    const variantId = await freshVariant("RELEASE", 2);
    const { id: locationId } = await onlineLocation();

    await ledger.reserve({ retailerId, variantId, locationId, quantity: 2 });
    expect(await columnQuantity(variantId)).toBe(0);

    await ledger.release({ retailerId, variantId, locationId, quantity: 2 });
    expect(await columnQuantity(variantId)).toBe(2);
  });

  it("a direct write CANNOT set a quantity the ledger disagrees with", async () => {
    const variantId = await freshVariant("FORCE", 3);

    // Someone tries to type 99 into the catalogue. It is not refused — it is
    // RECORDED, as a receipt of 96, and the column lands on what the ledger
    // then says. A number nobody can account for is the thing being removed.
    await setColumn(variantId, 99);

    expect(await columnQuantity(variantId)).toBe(99);

    const { data: entries } = await admin
      .from("stock_ledger_entries")
      .select("kind, quantity, reason")
      .eq("variant_id", variantId)
      .order("occurred_at", { ascending: true });
    expect(entries!.map((e) => e.kind)).toEqual(["receipt", "receipt"]);
    expect(entries![1]!.quantity).toBe(96);
    expect(entries![1]!.reason).toContain("directly");
  });

  it("an oversold variant clamps the storefront to zero, and the ledger keeps the truth", async () => {
    // 20, not 3. A count of 2-out-of-3 is a 33% variance, which correctly
    // trips the RELATIVE recount threshold — the adjustment is then refused
    // and this test would be exercising the recount gate while claiming to
    // exercise the oversell clamp. 19-out-of-20 is 5%.
    const variantId = await freshVariant("OVERSOLD", 20);
    const { id: locationId } = await onlineLocation();

    // Hold all twenty, then a count finds one fewer. The shop is genuinely
    // oversold: 19 on hand against 20 promised.
    await ledger.reserve({ retailerId, variantId, locationId, quantity: 20 });
    const session = await ledger.openCountSession({
      retailerId,
      locationId,
      openedByStaffId: staffId,
    });
    await ledger.recordCountLine({
      retailerId,
      sessionId: session.id,
      variantId,
      countedQuantity: 19,
    });
    const adjusted = await ledger.adjustFromCount({
      retailerId,
      sessionId: session.id,
      variantId,
      locationId,
      adjustmentQuantity: -1,
      reason: "One found damaged during the count and written off.",
    });
    expect(adjusted.ok).toBe(true);

    // The storefront must refuse, not go negative — the column carries a
    // `>= 0` check and a negative number would break every read of it.
    expect(await columnQuantity(variantId)).toBe(0);

    // But the real figure survives where it can be acted on.
    const balance = await ledger.balanceFor({
      retailerId,
      variantId,
      locationId,
    });
    expect(balance.onHand).toBe(19);
    expect(balance.reserved).toBe(20);
    expect(balance.available).toBe(-1);
  });

  it("no ledger-managed variant disagrees with the ledger, anywhere", async () => {
    // The whole point, asserted across the real catalogue rather than a
    // fixture. A non-zero answer means a write path has appeared that
    // bypasses the ledger, which is the silent oversell coming back.
    const { data, error } = await admin.rpc("count_inventory_disagreements");
    expect(error).toBeNull();
    expect(data).toBe(0);
  });
});
