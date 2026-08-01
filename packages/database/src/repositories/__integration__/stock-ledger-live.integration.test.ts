/**
 * Live integration proof for the stock ledger (PHASE 13.1).
 *
 * Every assertion here runs real SQL against a real Postgres. The append-only
 * guarantee, the oversell guard, the reversal arithmetic and the adjustment
 * rules are exercised as behaviour, not asserted as migration text.
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

const LIVE = process.env["PAON_INTEGRATION"] === "1";
const CHECK_VIOLATION = "23514";
const UNIQUE_VIOLATION = "23505";

const RUN = Date.now();

let admin: PaonSupabaseClient;
let repo: StockLedgerRepository;
let retailerId: RetailerId;
let staffId: string;
let variantA: string;
let variantB: string;
let shopFloor: string;
let stockroom: string;

describe.skipIf(!LIVE)("stock ledger, live (13.1)", () => {
  beforeAll(async () => {
    const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
    const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!url || !key) throw new Error("Live integration needs Supabase env.");
    admin = createSupabaseAdminClient(url, key);
    repo = new StockLedgerRepository(admin);

    const { data: retailer } = await admin
      .from("retailers")
      .select("id")
      .limit(1)
      .single();
    retailerId = retailer!.id as RetailerId;

    const { data: staff } = await admin
      .from("retailer_staff_members")
      .select("id")
      .eq("retailer_id", retailerId)
      .is("deleted_at", null)
      .limit(1)
      .single();
    staffId = staff!.id;

    const { data: variants } = await admin
      .from("product_variants")
      .select("id")
      .limit(2);
    variantA = variants![0]!.id;
    variantB = variants![1]?.id ?? variants![0]!.id;

    // Locations are per run so parallel or repeated runs never share a
    // ledger and a stale balance cannot make an assertion pass.
    shopFloor = (
      await repo.ensureLocation({
        retailerId,
        code: `FLOOR-${RUN}`,
        name: "Shop floor",
      })
    ).id;
    stockroom = (
      await repo.ensureLocation({
        retailerId,
        code: `STOCK-${RUN}`,
        name: "Stockroom",
      })
    ).id;
  });

  it("projects a balance from entries rather than reading a column", async () => {
    await repo.receive({
      retailerId,
      variantId: variantA,
      locationId: shopFloor,
      quantity: 5,
      recordedByStaffId: staffId,
    });
    const balance = await repo.balanceFor({
      retailerId,
      variantId: variantA,
      locationId: shopFloor,
    });
    expect(balance).toMatchObject({ onHand: 5, reserved: 0, available: 5 });
  });

  it("REFUSES an UPDATE to a ledger entry", async () => {
    // The append-only guarantee, tested rather than described. This is the
    // exact hole that existed until 20260801000016.
    const entry = await repo.receive({
      retailerId,
      variantId: variantA,
      locationId: shopFloor,
      quantity: 1,
    });
    const attempt = await admin
      .from("stock_ledger_entries")
      .update({ quantity: 999 })
      .eq("id", entry.id)
      .select("id");
    const changedNothing =
      attempt.error !== null || (attempt.data?.length ?? 0) === 0;
    expect(changedNothing).toBe(true);
  });

  it("REFUSES a DELETE of a ledger entry", async () => {
    const entry = await repo.receive({
      retailerId,
      variantId: variantA,
      locationId: shopFloor,
      quantity: 1,
    });
    const attempt = await admin
      .from("stock_ledger_entries")
      .delete()
      .eq("id", entry.id)
      .select("id");
    const deletedNothing =
      attempt.error !== null || (attempt.data?.length ?? 0) === 0;
    expect(deletedNothing).toBe(true);
  });

  it("treats a reservation as a promise, not a movement, and blocks the oversell", async () => {
    const before = await repo.balanceFor({
      retailerId,
      variantId: variantB,
      locationId: stockroom,
    });
    await repo.receive({
      retailerId,
      variantId: variantB,
      locationId: stockroom,
      quantity: 1,
    });

    const first = await repo.reserve({
      retailerId,
      variantId: variantB,
      locationId: stockroom,
      quantity: 1,
    });
    expect(first.ok).toBe(true);

    const held = await repo.balanceFor({
      retailerId,
      variantId: variantB,
      locationId: stockroom,
    });
    // On-hand unchanged by a reservation: reserving promises a garment, it
    // does not move one.
    expect(held.onHand).toBe(before.onHand + 1);
    expect(held.available).toBe(before.available);

    // The second customer for the last jacket. on-hand would say yes.
    const second = await repo.reserve({
      retailerId,
      variantId: variantB,
      locationId: stockroom,
      quantity: 1,
    });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toBe("insufficient_available");
  });

  it("derives a reversal's effect from the entry it cites", async () => {
    const location = (
      await repo.ensureLocation({
        retailerId,
        code: `REV-${RUN}`,
        name: "Reversal test",
      })
    ).id;
    await repo.receive({
      retailerId,
      variantId: variantA,
      locationId: location,
      quantity: 10,
    });
    const sale = await repo.sell({
      retailerId,
      variantId: variantA,
      locationId: location,
      quantity: 4,
    });
    expect(
      (
        await repo.balanceFor({
          retailerId,
          variantId: variantA,
          locationId: location,
        })
      ).onHand,
    ).toBe(6);

    await repo.reverse({ retailerId, entryId: sale.id });
    // Back to 10, and BOTH the sale and its reversal remain on the record.
    const after = await repo.balanceFor({
      retailerId,
      variantId: variantA,
      locationId: location,
    });
    expect(after.onHand).toBe(10);
    const entries = await repo.entriesFor({
      retailerId,
      variantId: variantA,
      locationId: location,
    });
    expect(entries.filter((e) => e.kind === "sale")).toHaveLength(1);
    expect(entries.filter((e) => e.kind === "reversal")).toHaveLength(1);
  });

  it("collapses a replayed receipt on its idempotency key", async () => {
    const location = (
      await repo.ensureLocation({
        retailerId,
        code: `IDEM-${RUN}`,
        name: "Idempotency test",
      })
    ).id;
    const key = `po-${RUN}`;
    await repo.receive({
      retailerId,
      variantId: variantA,
      locationId: location,
      quantity: 3,
      idempotencyKey: key,
    });
    // A retried webhook. The unique index must refuse the second write.
    const replay = admin.from("stock_ledger_entries").insert({
      retailer_id: retailerId,
      variant_id: variantA,
      location_id: location,
      kind: "receipt",
      quantity: 3,
      idempotency_key: key,
    });
    expect((await replay).error?.code).toBe(UNIQUE_VIOLATION);

    expect(
      (
        await repo.balanceFor({
          retailerId,
          variantId: variantA,
          locationId: location,
        })
      ).onHand,
    ).toBe(3);
  });

  it("moves stock as two entries so in-transit is visible", async () => {
    const from = (
      await repo.ensureLocation({
        retailerId,
        code: `TFROM-${RUN}`,
        name: "Transfer origin",
      })
    ).id;
    const to = (
      await repo.ensureLocation({
        retailerId,
        code: `TTO-${RUN}`,
        name: "Transfer destination",
      })
    ).id;
    await repo.receive({
      retailerId,
      variantId: variantA,
      locationId: from,
      quantity: 4,
    });

    const moved = await repo.transfer({
      retailerId,
      variantId: variantA,
      fromLocationId: from,
      toLocationId: to,
      quantity: 3,
    });
    expect(moved.ok).toBe(true);

    const origin = await repo.balanceFor({
      retailerId,
      variantId: variantA,
      locationId: from,
    });
    const dest = await repo.balanceFor({
      retailerId,
      variantId: variantA,
      locationId: to,
    });
    expect(origin.onHand).toBe(1);
    expect(dest.onHand).toBe(3);
    // Nothing was created or destroyed by moving it.
    expect(origin.onHand + dest.onHand).toBe(4);
  });

  it("REFUSES a transfer of reserved stock out from under a customer", async () => {
    const from = (
      await repo.ensureLocation({
        retailerId,
        code: `TRES-${RUN}`,
        name: "Reserved origin",
      })
    ).id;
    await repo.receive({
      retailerId,
      variantId: variantA,
      locationId: from,
      quantity: 2,
    });
    await repo.reserve({
      retailerId,
      variantId: variantA,
      locationId: from,
      quantity: 2,
    });

    const moved = await repo.transfer({
      retailerId,
      variantId: variantA,
      fromLocationId: from,
      toLocationId: stockroom,
      quantity: 1,
    });
    expect(moved.ok).toBe(false);
    if (!moved.ok) expect(moved.reason).toBe("insufficient_available");
  });

  it("REFUSES an adjustment with no count session, in the database itself", async () => {
    const bad = await admin.from("stock_ledger_entries").insert({
      retailer_id: retailerId,
      variant_id: variantA,
      location_id: shopFloor,
      kind: "count_adjustment",
      quantity: 2,
      reason: "A reason with no session behind it.",
    });
    expect(bad.error?.code).toBe(CHECK_VIOLATION);
  });

  it("REFUSES a zero-quantity adjustment", async () => {
    const bad = await admin.from("stock_ledger_entries").insert({
      retailer_id: retailerId,
      variant_id: variantA,
      location_id: shopFloor,
      kind: "count_adjustment",
      quantity: 0,
      reason: "Adjusting by nothing at all.",
    });
    expect(bad.error?.code).toBe(CHECK_VIOLATION);
  });

  it("REFUSES a negative receipt, because direction lives in the kind", async () => {
    const bad = await admin.from("stock_ledger_entries").insert({
      retailer_id: retailerId,
      variant_id: variantA,
      location_id: shopFloor,
      kind: "receipt",
      quantity: -3,
    });
    expect(bad.error?.code).toBe(CHECK_VIOLATION);
  });

  it("counts a shortfall, reconciles it, and posts a signed adjustment", async () => {
    // The end-to-end reason 20260801000017 exists: a count that finds FEWER
    // than expected is the most common real outcome, and it was previously
    // impossible to record.
    const location = (
      await repo.ensureLocation({
        retailerId,
        code: `COUNT-${RUN}`,
        name: "Count test",
      })
    ).id;
    await repo.receive({
      retailerId,
      variantId: variantA,
      locationId: location,
      quantity: 20,
    });

    const session = await repo.openCountSession({
      retailerId,
      locationId: location,
      openedByStaffId: staffId,
    });
    expect(session.blind).toBe(true);

    // 19 of 20, not 9 of 10. One missing from ten is a 10% variance, which
    // correctly trips the relative recount threshold — my first fixture
    // tested the recount rule while claiming to test the adjustment rule.
    // One missing from twenty is 5%, under both thresholds.
    await repo.recordCountLine({
      retailerId,
      sessionId: session.id,
      variantId: variantA,
      countedQuantity: 19,
    });

    const reconciliation = await repo.reconcileCount({
      retailerId,
      sessionId: session.id,
      locationId: location,
    });
    const variance = reconciliation.variances.find(
      (v) => v.variantId === variantA,
    );
    expect(variance?.varianceQuantity).toBe(-1);

    // Under both recount thresholds: 1 absolute (< 2) and 5% (< 10%).
    expect(reconciliation.recountRequired).toBe(false);

    const adjusted = await repo.adjustFromCount({
      retailerId,
      sessionId: session.id,
      locationId: location,
      variantId: variantA,
      adjustmentQuantity: -1,
      reason: "One jacket found damaged during the count and written off.",
      recordedByStaffId: staffId,
    });
    expect(adjusted.ok).toBe(true);

    const after = await repo.balanceFor({
      retailerId,
      variantId: variantA,
      locationId: location,
    });
    expect(after.onHand).toBe(19);

    await repo.closeCountSession({
      retailerId,
      sessionId: session.id,
      state: "reconciled",
    });
  });

  it("REFUSES an adjustment larger than what the count actually found", async () => {
    const location = (
      await repo.ensureLocation({
        retailerId,
        code: `OVER-${RUN}`,
        name: "Over-adjust test",
      })
    ).id;
    await repo.receive({
      retailerId,
      variantId: variantA,
      locationId: location,
      quantity: 20,
    });
    const session = await repo.openCountSession({
      retailerId,
      locationId: location,
      openedByStaffId: staffId,
    });
    // 19 of 20 keeps the recount gate open so the assertion below is really
    // about the variance cap.
    await repo.recordCountLine({
      retailerId,
      sessionId: session.id,
      variantId: variantA,
      countedQuantity: 19,
    });

    const over = await repo.adjustFromCount({
      retailerId,
      sessionId: session.id,
      locationId: location,
      variantId: variantA,
      adjustmentQuantity: -5,
      reason: "Trying to write off more than the count found.",
    });
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.reason).toBe("adjustment_exceeds_variance");
  });

  it("blocks an adjustment while a recount is outstanding", async () => {
    const location = (
      await repo.ensureLocation({
        retailerId,
        code: `RECNT-${RUN}`,
        name: "Recount test",
      })
    ).id;
    await repo.receive({
      retailerId,
      variantId: variantA,
      locationId: location,
      quantity: 10,
    });
    const session = await repo.openCountSession({
      retailerId,
      locationId: location,
      openedByStaffId: staffId,
    });
    // Counting 3 of an expected 10 is a large variance and must force a
    // recount before anyone is allowed to write stock off.
    await repo.recordCountLine({
      retailerId,
      sessionId: session.id,
      variantId: variantA,
      countedQuantity: 3,
    });

    const reconciliation = await repo.reconcileCount({
      retailerId,
      sessionId: session.id,
      locationId: location,
    });
    expect(reconciliation.recountRequired).toBe(true);

    const blocked = await repo.adjustFromCount({
      retailerId,
      sessionId: session.id,
      locationId: location,
      variantId: variantA,
      adjustmentQuantity: -7,
      reason: "Writing off seven before anyone recounted.",
    });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.reason).toBe("recount_outstanding");
  });

  it("corrects a re-scanned count line instead of doubling it", async () => {
    const location = (
      await repo.ensureLocation({
        retailerId,
        code: `RESCAN-${RUN}`,
        name: "Rescan test",
      })
    ).id;
    const session = await repo.openCountSession({
      retailerId,
      locationId: location,
      openedByStaffId: staffId,
    });
    await repo.recordCountLine({
      retailerId,
      sessionId: session.id,
      variantId: variantA,
      countedQuantity: 4,
    });
    await repo.recordCountLine({
      retailerId,
      sessionId: session.id,
      variantId: variantA,
      countedQuantity: 6,
    });

    const { data: lines } = await admin
      .from("stock_count_lines")
      .select("counted_quantity")
      .eq("session_id", session.id);
    expect(lines?.length).toBe(1);
    expect(lines?.[0]?.counted_quantity).toBe(6);
  });
});
