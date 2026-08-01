import { describe, expect, it } from "vitest";

import {
  checkCountAdjustment,
  checkReservation,
  checkTransfer,
  projectBalance,
  reconcileBlindCount,
  resolveScan,
  type LedgerEntry,
} from "./stock-ledger";

function entry(overrides: Partial<LedgerEntry>): LedgerEntry {
  return {
    entryId: "e1",
    variantId: "v1",
    locationId: "l1",
    kind: "receipt",
    quantity: 1,
    occurredAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("projectBalance", () => {
  it("adds receipts and subtracts sales", () => {
    expect(
      projectBalance([
        entry({ entryId: "a", kind: "receipt", quantity: 5 }),
        entry({ entryId: "b", kind: "sale", quantity: 2 }),
      ]),
    ).toEqual({ onHand: 3, reserved: 0, available: 3 });
  });

  it("treats a reservation as a promise, not a movement", () => {
    // Reserving does not move a garment. On-hand must not change.
    expect(
      projectBalance([
        entry({ entryId: "a", kind: "receipt", quantity: 5 }),
        entry({ entryId: "b", kind: "reservation", quantity: 2 }),
      ]),
    ).toEqual({ onHand: 5, reserved: 2, available: 3 });
  });

  it("releases a reservation back into availability", () => {
    expect(
      projectBalance([
        entry({ entryId: "a", kind: "receipt", quantity: 5 }),
        entry({ entryId: "b", kind: "reservation", quantity: 2 }),
        entry({ entryId: "c", kind: "reservation_release", quantity: 2 }),
      ]).available,
    ).toBe(5);
  });

  it("inverts a reversal from the entry it cites, not from its own sign", () => {
    // The caller cannot mis-sign a reversal: the ledger knows what it is
    // undoing.
    const balance = projectBalance([
      entry({ entryId: "a", kind: "receipt", quantity: 5 }),
      entry({ entryId: "b", kind: "sale", quantity: 2 }),
      entry({
        entryId: "c",
        kind: "reversal",
        quantity: 999,
        reversesEntryId: "b",
      }),
    ]);
    expect(balance.onHand).toBe(5);
  });

  it("ignores a reversal that cites nothing resolvable", () => {
    expect(
      projectBalance([
        entry({ entryId: "a", kind: "receipt", quantity: 5 }),
        entry({ entryId: "c", kind: "reversal", quantity: 5 }),
      ]).onHand,
    ).toBe(5);
  });

  it("collapses a duplicate idempotency key on read as well as on write", () => {
    // Deduping only at the write boundary means a webhook replayed during
    // a partition silently double-counts.
    expect(
      projectBalance([
        entry({
          entryId: "a",
          kind: "receipt",
          quantity: 5,
          idempotencyKey: "po-1",
        }),
        entry({
          entryId: "b",
          kind: "receipt",
          quantity: 5,
          idempotencyKey: "po-1",
        }),
      ]).onHand,
    ).toBe(5);
  });

  it("surfaces a negative availability rather than clamping it to zero", () => {
    // If the ledger says we oversold, the caller needs to know.
    expect(
      projectBalance([
        entry({ entryId: "a", kind: "receipt", quantity: 1 }),
        entry({ entryId: "b", kind: "reservation", quantity: 3 }),
      ]).available,
    ).toBe(-2);
  });

  it("nets a transfer out and in to zero across both locations", () => {
    const out = projectBalance([
      entry({ entryId: "a", kind: "receipt", quantity: 4 }),
      entry({ entryId: "b", kind: "transfer_out", quantity: 1 }),
    ]);
    const inbound = projectBalance([
      entry({
        entryId: "c",
        kind: "transfer_in",
        quantity: 1,
        locationId: "l2",
      }),
    ]);
    expect(out.onHand + inbound.onHand).toBe(4);
  });
});

describe("checkReservation", () => {
  it("refuses the second customer reserving the last jacket", () => {
    // on-hand would say yes to both. Availability is the guard.
    const balance = { onHand: 1, reserved: 1, available: 0 };
    expect(checkReservation({ balance, requestedQuantity: 1 })).toEqual({
      ok: false,
      reason: "insufficient_available",
      available: 0,
    });
  });

  it("allows a reservation within availability", () => {
    expect(
      checkReservation({
        balance: { onHand: 3, reserved: 1, available: 2 },
        requestedQuantity: 2,
      }),
    ).toEqual({ ok: true });
  });

  it("refuses a zero or fractional quantity", () => {
    const balance = { onHand: 5, reserved: 0, available: 5 };
    expect(checkReservation({ balance, requestedQuantity: 0 })).toEqual({
      ok: false,
      reason: "quantity_not_positive",
    });
    expect(checkReservation({ balance, requestedQuantity: 1.5 })).toEqual({
      ok: false,
      reason: "quantity_not_positive",
    });
  });
});

describe("resolveScan", () => {
  const map = new Map([["8710000000015", "variant-1"]]);

  it("looks up without writing, even with no session open", () => {
    // Checking what something is must never accidentally receive it.
    expect(
      resolveScan({
        barcode: "8710000000015",
        mode: "lookup",
        barcodeToVariant: map,
        hasOpenSession: false,
      }),
    ).toEqual({ ok: true, variantId: "variant-1", writes: false });
  });

  it("refuses a writing mode with no open session", () => {
    expect(
      resolveScan({
        barcode: "8710000000015",
        mode: "receiving",
        barcodeToVariant: map,
        hasOpenSession: false,
      }),
    ).toEqual({ ok: false, reason: "mode_requires_open_session" });
  });

  it("refuses an unknown barcode rather than creating a variant", () => {
    expect(
      resolveScan({
        barcode: "0000000000000",
        mode: "receiving",
        barcodeToVariant: map,
        hasOpenSession: true,
      }),
    ).toEqual({ ok: false, reason: "unknown_barcode" });
  });
});

describe("reconcileBlindCount", () => {
  const expected = new Map([
    ["v1", 10],
    ["v2", 1],
    ["v3", 4],
  ]);

  it("reports only the lines that differ", () => {
    const result = reconcileBlindCount({
      expected,
      counted: [
        { variantId: "v1", countedQuantity: 10 },
        { variantId: "v2", countedQuantity: 0 },
        { variantId: "v3", countedQuantity: 4 },
      ],
    });
    expect(result.variances.map((v) => v.variantId)).toEqual(["v2"]);
  });

  it("does not treat an unscanned variant as counted-zero", () => {
    // Treating absence as zero would write off stock nobody looked for.
    const result = reconcileBlindCount({
      expected,
      counted: [{ variantId: "v1", countedQuantity: 10 }],
    });
    expect(result.uncountedVariantIds).toEqual(["v2", "v3"]);
    expect(result.variances).toEqual([]);
  });

  it("demands a recount on a large absolute variance", () => {
    const result = reconcileBlindCount({
      expected,
      counted: [{ variantId: "v1", countedQuantity: 7 }],
    });
    expect(result.recountRequired).toBe(true);
  });

  it("demands a recount on a proportionally large variance of a small line", () => {
    const result = reconcileBlindCount({
      expected: new Map([["v2", 1]]),
      counted: [{ variantId: "v2", countedQuantity: 0 }],
    });
    expect(result.variances[0]?.requiresRecount).toBe(true);
  });

  it("counts a surplus as a variance too", () => {
    // Finding more than expected is as much a signal as finding less.
    const result = reconcileBlindCount({
      expected: new Map([["v1", 10]]),
      counted: [{ variantId: "v1", countedQuantity: 12 }],
    });
    expect(result.variances[0]?.varianceQuantity).toBe(2);
  });
});

describe("checkCountAdjustment", () => {
  const variance = {
    variantId: "v1",
    expectedQuantity: 10,
    countedQuantity: 8,
    varianceQuantity: -2,
    requiresRecount: false,
  };
  const base = {
    countSessionId: "count-1",
    variance,
    adjustmentQuantity: -2,
    reason: "Two jackets found damaged and written off.",
    recountOutstanding: false,
  };

  it("accepts a reasoned adjustment matching the count", () => {
    expect(checkCountAdjustment(base)).toEqual({ ok: true });
  });

  it("refuses an adjustment with no count session behind it", () => {
    const { countSessionId: _drop, ...withoutSession } = base;
    expect(checkCountAdjustment(withoutSession)).toEqual({
      ok: false,
      reason: "no_count_session",
    });
  });

  it("refuses while a recount is outstanding", () => {
    expect(checkCountAdjustment({ ...base, recountOutstanding: true })).toEqual(
      { ok: false, reason: "recount_outstanding" },
    );
  });

  it("refuses an adjustment larger than what the count actually found", () => {
    expect(checkCountAdjustment({ ...base, adjustmentQuantity: -5 })).toEqual({
      ok: false,
      reason: "adjustment_exceeds_variance",
    });
  });

  it("refuses an unexplained adjustment", () => {
    // Otherwise shrinkage becomes a pile of unexplained corrections.
    expect(checkCountAdjustment({ ...base, reason: "fix" })).toEqual({
      ok: false,
      reason: "reason_required",
    });
  });
});

describe("checkTransfer", () => {
  const originBalance = { onHand: 5, reserved: 1, available: 4 };

  it("allows a transfer within availability", () => {
    expect(
      checkTransfer({
        fromLocationId: "a",
        toLocationId: "b",
        quantity: 4,
        originBalance,
      }),
    ).toEqual({ ok: true });
  });

  it("refuses transferring reserved stock out from under a customer", () => {
    expect(
      checkTransfer({
        fromLocationId: "a",
        toLocationId: "b",
        quantity: 5,
        originBalance,
      }),
    ).toEqual({ ok: false, reason: "insufficient_available" });
  });

  it("refuses a transfer to the same location", () => {
    expect(
      checkTransfer({
        fromLocationId: "a",
        toLocationId: "a",
        quantity: 1,
        originBalance,
      }),
    ).toEqual({ ok: false, reason: "same_location" });
  });
});
