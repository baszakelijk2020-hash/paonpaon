import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  checkPurchaseOrderApproval,
  checkRfqTransition,
  checkShipmentIssue,
  evaluateGroupBuy,
  priceForQuantity,
  type MerchantListing,
} from "./munro-merchant";

const listing: MerchantListing = {
  listingId: "bag-kraft-medium",
  supplierKey: "supplier-a",
  category: "packaging",
  minimumOrderQuantity: 500,
  tiers: [
    { minimumQuantity: 500, unitPriceMinorUnits: 90 },
    { minimumQuantity: 2000, unitPriceMinorUnits: 70 },
    { minimumQuantity: 10000, unitPriceMinorUnits: 55 },
  ],
  customizable: true,
  sampleAvailable: true,
};

describe("bounded context isolation", () => {
  it("imports nothing from the consumer commerce or customer domains", () => {
    // The non-goal is "no customer-facing marketplace order reuse". The
    // way to honour it is for this module to be unable to reach those
    // entities at all, which a test can actually check.
    const source = readFileSync(
      new URL("./munro-merchant.ts", import.meta.url),
      "utf8",
    );
    const imports = [...source.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    expect(imports).toEqual([]);
    expect(source).not.toMatch(
      /\b(CustomerId|OrderId|WardrobeItem|SelfPortrait|customers)\b/,
    );
  });
});

describe("priceForQuantity", () => {
  it("applies the highest tier the quantity clears", () => {
    // Taking the first ascending match would quote the most expensive band
    // to the largest buyer.
    expect(priceForQuantity({ listing, quantity: 5000 })).toEqual({
      ok: true,
      unitPriceMinorUnits: 70,
      totalMinorUnits: 350000,
      appliedTierMinimum: 2000,
    });
  });

  it("refuses below the minimum order quantity and says what it is", () => {
    expect(priceForQuantity({ listing, quantity: 100 })).toEqual({
      ok: false,
      reason: "below_minimum_order_quantity",
      minimumOrderQuantity: 500,
    });
  });

  it("applies the top tier at a large volume", () => {
    expect(
      priceForQuantity({ listing, quantity: 20000 }).ok &&
        priceForQuantity({ listing, quantity: 20000 }),
    ).toMatchObject({ unitPriceMinorUnits: 55 });
  });

  it("refuses when no tier covers the quantity", () => {
    expect(
      priceForQuantity({
        listing: { ...listing, minimumOrderQuantity: 1, tiers: [] },
        quantity: 10,
      }),
    ).toEqual({ ok: false, reason: "no_applicable_tier" });
  });
});

describe("checkRfqTransition", () => {
  const base = { customizable: false };

  it("walks draft to sent to quoted to accepted", () => {
    expect(checkRfqTransition({ ...base, from: "draft", to: "sent" })).toEqual({
      ok: true,
    });
    expect(
      checkRfqTransition({
        ...base,
        from: "sent",
        to: "quoted",
        quotedUnitPriceMinorUnits: 70,
      }),
    ).toEqual({ ok: true });
    expect(
      checkRfqTransition({ ...base, from: "quoted", to: "accepted" }),
    ).toEqual({ ok: true });
  });

  it("refuses a quote with no price", () => {
    expect(checkRfqTransition({ ...base, from: "sent", to: "quoted" })).toEqual(
      { ok: false, reason: "quote_requires_price" },
    );
  });

  it("refuses to accept a customised item without an approved proof", () => {
    // Printing 5,000 bags with the wrong logo is not recoverable, and
    // "we thought you'd seen it" is not a defence.
    expect(
      checkRfqTransition({
        from: "quoted",
        to: "accepted",
        customizable: true,
        proofApproved: false,
      }),
    ).toEqual({ ok: false, reason: "proof_required_for_customization" });
    expect(
      checkRfqTransition({
        from: "quoted",
        to: "accepted",
        customizable: true,
        proofApproved: true,
      }),
    ).toEqual({ ok: true });
  });

  it("refuses to accept an expired quote", () => {
    expect(
      checkRfqTransition({
        ...base,
        from: "quoted",
        to: "accepted",
        quoteExpiresOn: "2026-07-01T00:00:00.000Z",
        asOf: "2026-08-01T00:00:00.000Z",
      }),
    ).toEqual({ ok: false, reason: "accept_requires_unexpired_quote" });
  });

  it("has no transition out of accepted", () => {
    expect(
      checkRfqTransition({ ...base, from: "accepted", to: "quoted" }),
    ).toEqual({ ok: false, reason: "transition_not_allowed" });
  });
});

describe("checkPurchaseOrderApproval", () => {
  const base = {
    raisedByStaffId: "a",
    approverStaffId: "b",
    totalMinorUnits: 200000,
    secondApprovalThresholdMinorUnits: 100000,
    approverLimitMinorUnits: 500000,
  };

  it("approves within limit by a second person", () => {
    expect(checkPurchaseOrderApproval(base)).toEqual({ ok: true });
  });

  it("refuses self-approval above the threshold", () => {
    expect(
      checkPurchaseOrderApproval({ ...base, approverStaffId: "a" }),
    ).toEqual({ ok: false, reason: "approval_requires_second_person" });
  });

  it("allows self-approval of a small order", () => {
    expect(
      checkPurchaseOrderApproval({
        ...base,
        approverStaffId: "a",
        totalMinorUnits: 5000,
      }),
    ).toEqual({ ok: true });
  });

  it("refuses beyond the approver's own limit", () => {
    expect(
      checkPurchaseOrderApproval({ ...base, totalMinorUnits: 900000 }),
    ).toEqual({ ok: false, reason: "over_approval_limit" });
  });

  it("refuses a payment outright rather than ignoring the flag", () => {
    // Same reasoning as the 12.3 partner invoice: a silently dropped flag
    // lets a caller believe money moved.
    expect(
      checkPurchaseOrderApproval({ ...base, initiatePayment: true }),
    ).toEqual({ ok: false, reason: "payment_not_designed" });
  });
});

describe("evaluateGroupBuy", () => {
  const state = {
    targetQuantity: 5000,
    committedQuantity: 4000,
    closesOn: "2026-09-01T00:00:00.000Z",
  };

  it("reports a near-miss as a miss, with the shortfall", () => {
    // A group buy that "nearly" hit its minimum is one the supplier will
    // not honour, and saying otherwise creates a promise nobody can keep.
    expect(
      evaluateGroupBuy({
        state,
        additionalQuantity: 500,
        asOf: "2026-08-01T00:00:00.000Z",
      }),
    ).toEqual({ ok: true, reached: false, shortfall: 500 });
  });

  it("reports success once the target is met", () => {
    expect(
      evaluateGroupBuy({
        state,
        additionalQuantity: 1000,
        asOf: "2026-08-01T00:00:00.000Z",
      }),
    ).toEqual({ ok: true, reached: true, shortfall: 0 });
  });

  it("refuses a commitment after close", () => {
    expect(
      evaluateGroupBuy({
        state,
        additionalQuantity: 1000,
        asOf: "2026-09-15T00:00:00.000Z",
      }),
    ).toEqual({ ok: false, reason: "closed" });
  });
});

describe("checkShipmentIssue", () => {
  const base = {
    kind: "damaged" as const,
    received: true,
    affectedQuantity: 50,
    shipmentQuantity: 500,
    evidenceRefs: ["photo-1"],
  };

  it("accepts an evidenced damage claim on a received shipment", () => {
    expect(checkShipmentIssue(base)).toEqual({ ok: true });
  });

  it("refuses a damage claim with no evidence", () => {
    // The supplier will reject it, so raising it wastes both sides' time.
    expect(checkShipmentIssue({ ...base, evidenceRefs: [] })).toEqual({
      ok: false,
      reason: "evidence_required",
    });
  });

  it("allows a lateness claim before anything has been received", () => {
    expect(
      checkShipmentIssue({
        ...base,
        kind: "late",
        received: false,
        evidenceRefs: [],
      }),
    ).toEqual({ ok: true });
  });

  it("refuses a damage claim on something not yet received", () => {
    expect(checkShipmentIssue({ ...base, received: false })).toEqual({
      ok: false,
      reason: "not_yet_received",
    });
  });

  it("refuses a claim for more units than were shipped", () => {
    expect(checkShipmentIssue({ ...base, affectedQuantity: 900 })).toEqual({
      ok: false,
      reason: "quantity_exceeds_shipment",
    });
  });
});
