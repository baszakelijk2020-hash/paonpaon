import { describe, expect, it } from "vitest";

import {
  CASH_TENDER,
  checkPaymentCapture,
  checkReturnEligibility,
  checkSaleCompletable,
  checkTransactionTransition,
  planReturn,
  totalCart,
  type CartLine,
} from "./pos-transaction";

const rtw: CartLine = {
  lineId: "l1",
  kind: "rtw",
  variantId: "v1",
  quantity: 2,
  unitPriceMinorUnits: 12000,
  reservesStock: true,
};
const service: CartLine = {
  lineId: "l2",
  kind: "alteration_service",
  quantity: 1,
  unitPriceMinorUnits: 4500,
  reservesStock: false,
};
const mtm: CartLine = {
  lineId: "l3",
  kind: "mtm",
  quantity: 1,
  unitPriceMinorUnits: 180000,
  reservesStock: false,
};

describe("totalCart", () => {
  it("keeps the kinds apart instead of netting them into one number", () => {
    // RTW, service and MTM behave differently on return, so a refund
    // decision needs them separately.
    const totals = totalCart([rtw, service, mtm]);
    expect(totals.subtotalMinorUnits).toBe(24000 + 4500 + 180000);
    expect(totals.byKindMinorUnits).toEqual({
      rtw: 24000,
      alteration_service: 4500,
      mtm: 180000,
    });
  });

  it("totals an empty cart to zero rather than throwing", () => {
    expect(totalCart([]).subtotalMinorUnits).toBe(0);
  });
});

describe("checkTransactionTransition", () => {
  it("suspends and resumes a sale", () => {
    expect(
      checkTransactionTransition({
        from: "open",
        to: "suspended",
        lineCount: 1,
      }),
    ).toEqual({ ok: true });
    expect(
      checkTransactionTransition({
        from: "suspended",
        to: "open",
        lineCount: 1,
      }),
    ).toEqual({ ok: true });
  });

  it("treats a completed sale as final", () => {
    // The correction for a completed sale is a return or exchange - a new
    // linked transaction - which is what keeps stock and financial history
    // survivable.
    for (const to of ["open", "voided", "awaiting_payment"] as const) {
      expect(
        checkTransactionTransition({ from: "completed", to, lineCount: 1 }),
      ).toEqual({ ok: false, reason: "completed_is_final" });
    }
  });

  it("refuses to take payment for an empty cart", () => {
    expect(
      checkTransactionTransition({
        from: "open",
        to: "awaiting_payment",
        lineCount: 0,
      }),
    ).toEqual({ ok: false, reason: "empty_cart" });
  });

  it("refuses an unexplained void", () => {
    expect(
      checkTransactionTransition({ from: "open", to: "voided", lineCount: 1 }),
    ).toEqual({ ok: false, reason: "void_requires_reason" });
    expect(
      checkTransactionTransition({
        from: "open",
        to: "voided",
        lineCount: 1,
        voidReason: "Customer changed their mind at the till.",
      }),
    ).toEqual({ ok: true });
  });

  it("allows a quote to become a sale", () => {
    expect(
      checkTransactionTransition({
        from: "quoted",
        to: "awaiting_payment",
        lineCount: 2,
      }),
    ).toEqual({ ok: true });
  });
});

describe("checkPaymentCapture", () => {
  const base = {
    activatedProviders: ["stripe_terminal"],
    provider: "stripe_terminal",
    providerReference: "pi_123",
    capturedMinorUnits: 24000,
    expectedMinorUnits: 24000,
  };

  it("records a capture against an activated provider", () => {
    expect(checkPaymentCapture(base)).toEqual({ ok: true });
  });

  it("rejects the whole capture if anything card-shaped is passed", () => {
    // Dropping the field silently would let a caller believe it was stored
    // and keep sending it.
    expect(
      checkPaymentCapture({
        ...base,
        rawFieldNames: ["amount", "card_number"],
      }),
    ).toEqual({ ok: false, reason: "card_data_not_accepted" });
    expect(checkPaymentCapture({ ...base, rawFieldNames: ["cvc"] })).toEqual({
      ok: false,
      reason: "card_data_not_accepted",
    });
  });

  it("refuses a provider ADR-062 has not activated", () => {
    expect(checkPaymentCapture({ ...base, provider: "some_new_psp" })).toEqual({
      ok: false,
      reason: "provider_not_activated",
    });
  });

  it("refuses a capture with no provider reference to reconcile against", () => {
    expect(checkPaymentCapture({ ...base, providerReference: "  " })).toEqual({
      ok: false,
      reason: "provider_reference_required",
    });
  });

  it("refuses a capture whose amount does not match the cart", () => {
    expect(checkPaymentCapture({ ...base, capturedMinorUnits: 23999 })).toEqual(
      { ok: false, reason: "amount_mismatch" },
    );
  });
});

describe("checkReturnEligibility", () => {
  const sold = {
    saleCompleted: true,
    soldOn: "2026-08-01T00:00:00.000Z",
    requestedOn: "2026-08-10T00:00:00.000Z",
  };

  it("accepts an in-window RTW return", () => {
    expect(checkReturnEligibility({ ...sold, line: rtw })).toEqual({
      ok: true,
      refundableMinorUnits: 24000,
    });
  });

  it("refuses an out-of-window RTW return", () => {
    expect(
      checkReturnEligibility({
        ...sold,
        line: rtw,
        requestedOn: "2026-09-15T00:00:00.000Z",
      }),
    ).toEqual({ ok: false, reason: "window_expired" });
  });

  it("refuses MTM outright rather than giving it a shorter window", () => {
    // A garment cut to one person's measurements has no second buyer, and
    // a policy pretending otherwise creates a dispute at the worst moment.
    expect(checkReturnEligibility({ ...sold, line: mtm })).toEqual({
      ok: false,
      reason: "mtm_is_bespoke",
    });
  });

  it("refuses a service that was already performed but allows one that was not", () => {
    expect(
      checkReturnEligibility({
        ...sold,
        line: service,
        servicePerformed: true,
      }),
    ).toEqual({ ok: false, reason: "service_already_performed" });
    expect(
      checkReturnEligibility({
        ...sold,
        line: service,
        servicePerformed: false,
      }),
    ).toEqual({ ok: true, refundableMinorUnits: 4500 });
  });

  it("refunds only the not-yet-returned quantity on a partial return", () => {
    expect(
      checkReturnEligibility({
        ...sold,
        line: rtw,
        alreadyReturnedQuantity: 1,
      }),
    ).toEqual({ ok: true, refundableMinorUnits: 12000 });
  });

  it("refuses a second return of a fully returned line", () => {
    expect(
      checkReturnEligibility({
        ...sold,
        line: rtw,
        alreadyReturnedQuantity: 2,
      }),
    ).toEqual({ ok: false, reason: "already_returned" });
  });

  it("refuses a return against a sale that never completed", () => {
    expect(
      checkReturnEligibility({ ...sold, line: rtw, saleCompleted: false }),
    ).toEqual({ ok: false, reason: "not_from_completed_sale" });
  });
});

describe("planReturn", () => {
  it("restocks goods but not services, and always links a new transaction", () => {
    const plan = planReturn({
      lines: [
        { line: rtw, refundableMinorUnits: 24000, restock: true },
        { line: service, refundableMinorUnits: 4500, restock: false },
      ],
    });
    expect(plan.restockLines).toEqual([{ variantId: "v1", quantity: 2 }]);
    expect(plan.refundMinorUnits).toBe(28500);
    // Never an edit of the original sale.
    expect(plan.createsLinkedTransaction).toBe(true);
  });

  it("restocks nothing for a line with no variant", () => {
    const plan = planReturn({
      lines: [{ line: service, refundableMinorUnits: 4500, restock: true }],
    });
    expect(plan.restockLines).toEqual([]);
  });
});

describe("cash is a tender, not a provider integration", () => {
  it("accepts cash with no provider activated at all", () => {
    // The empty list is the real production state until ADR-062 approves a
    // processor. A shop must still be able to trade.
    expect(
      checkPaymentCapture({
        activatedProviders: [],
        provider: CASH_TENDER,
        providerReference: "drawer-1",
        capturedMinorUnits: 12000,
        expectedMinorUnits: 12000,
      }),
    ).toEqual({ ok: true });
  });

  it("still refuses a card provider that nobody activated", () => {
    expect(
      checkPaymentCapture({
        activatedProviders: [],
        provider: "some_psp",
        providerReference: "pi_1",
        capturedMinorUnits: 12000,
        expectedMinorUnits: 12000,
      }),
    ).toEqual({ ok: false, reason: "provider_not_activated" });
  });

  it("refuses card data even when the tender is cash", () => {
    // The carve-out is about provider approval, never about what may be
    // stored. Cash is not a loophole for a PAN.
    expect(
      checkPaymentCapture({
        activatedProviders: [],
        provider: CASH_TENDER,
        providerReference: "drawer-1",
        capturedMinorUnits: 12000,
        expectedMinorUnits: 12000,
        rawFieldNames: ["amount", "card_number"],
      }),
    ).toEqual({ ok: false, reason: "card_data_not_accepted" });
  });

  it("still holds cash to the cart total", () => {
    expect(
      checkPaymentCapture({
        activatedProviders: [],
        provider: CASH_TENDER,
        providerReference: "drawer-1",
        capturedMinorUnits: 11999,
        expectedMinorUnits: 12000,
      }),
    ).toEqual({ ok: false, reason: "amount_mismatch" });
  });
});

describe("a sale closes when the money is accounted for", () => {
  const base = {
    from: "awaiting_payment" as const,
    lineCount: 1,
    expectedMinorUnits: 12000,
  };

  it("REFUSES to complete a cart nobody paid for", () => {
    // Without this the stock would move on an unpaid sale and the ledger
    // would look perfectly consistent while the shop was robbed.
    expect(checkSaleCompletable({ ...base, capturedMinorUnits: 0 })).toEqual({
      ok: false,
      reason: "payment_incomplete",
    });
  });

  it("REFUSES a part payment", () => {
    expect(
      checkSaleCompletable({ ...base, capturedMinorUnits: 11999 }),
    ).toEqual({ ok: false, reason: "payment_incomplete" });
  });

  it("allows an overpayment, because change is given in the room", () => {
    expect(
      checkSaleCompletable({ ...base, capturedMinorUnits: 12500 }),
    ).toEqual({ ok: true });
  });

  it("completes on an exact payment", () => {
    expect(
      checkSaleCompletable({ ...base, capturedMinorUnits: 12000 }),
    ).toEqual({ ok: true });
  });

  it("REFUSES an empty cart before it asks about money", () => {
    expect(
      checkSaleCompletable({
        ...base,
        lineCount: 0,
        capturedMinorUnits: 99999,
      }),
    ).toEqual({ ok: false, reason: "nothing_to_sell" });
  });

  it("REFUSES to complete something already completed", () => {
    expect(
      checkSaleCompletable({
        ...base,
        from: "completed",
        capturedMinorUnits: 12000,
      }),
    ).toEqual({ ok: false, reason: "completed_is_final" });
  });

  it("REFUSES to resurrect a voided sale by paying for it", () => {
    expect(
      checkSaleCompletable({
        ...base,
        from: "voided",
        capturedMinorUnits: 12000,
      }),
    ).toEqual({ ok: false, reason: "not_presented_for_payment" });
  });
});
