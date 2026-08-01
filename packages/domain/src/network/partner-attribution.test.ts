import { describe, expect, it } from "vitest";

import {
  buildPartnerPayload,
  checkConciergeRequest,
  checkRewardGrant,
  checkRewardRedemption,
  planRewardReversal,
  resolveAttribution,
  type AttributionRecord,
} from "./partner-attribution";

function record(overrides: Partial<AttributionRecord>): AttributionRecord {
  return {
    eventId: "e1",
    event: "click",
    listingId: "listing-1",
    pseudonymousRef: "pref-abc",
    occurredAt: "2026-07-01T00:00:00.000Z",
    providerEventKey: "k1",
    ...overrides,
  };
}

describe("resolveAttribution", () => {
  const click = record({ event: "click", providerEventKey: "click-1" });
  const order = record({
    event: "order_confirmed",
    occurredAt: "2026-07-05T00:00:00.000Z",
    providerEventKey: "order-1",
    valueMinorUnits: 15000,
  });

  it("holds a confirmed order until the return window closes", () => {
    // Paying on order and clawing back later is how a partner ends up
    // owing money on a month they have already spent.
    const outcome = resolveAttribution({
      records: [click, order],
      asOf: "2026-07-10T00:00:00.000Z",
    });
    expect(outcome.state).toBe("holding");
    expect(outcome.attributableMinorUnits).toBe(15000);
  });

  it("confirms once the window has passed with no refund", () => {
    const outcome = resolveAttribution({
      records: [click, order],
      asOf: "2026-08-20T00:00:00.000Z",
    });
    expect(outcome.state).toBe("confirmed");
  });

  it("reverses to zero on refund wherever it lands in the window", () => {
    const outcome = resolveAttribution({
      records: [
        click,
        order,
        record({
          event: "order_refunded",
          providerEventKey: "refund-1",
          occurredAt: "2026-07-20T00:00:00.000Z",
        }),
      ],
      asOf: "2026-08-20T00:00:00.000Z",
    });
    expect(outcome).toMatchObject({
      state: "reversed",
      attributableMinorUnits: 0,
    });
  });

  it("collapses a retried provider webhook rather than double-attributing", () => {
    const outcome = resolveAttribution({
      records: [click, order, { ...order, eventId: "dup" }],
      asOf: "2026-08-20T00:00:00.000Z",
    });
    expect(outcome.attributableMinorUnits).toBe(15000);
  });

  it("expires an order that arrived outside the click window", () => {
    const outcome = resolveAttribution({
      records: [click, { ...order, occurredAt: "2026-09-30T00:00:00.000Z" }],
      asOf: "2026-11-01T00:00:00.000Z",
    });
    expect(outcome.state).toBe("expired");
  });

  it("attributes nothing to an order with no click behind it", () => {
    const outcome = resolveAttribution({
      records: [order],
      asOf: "2026-08-20T00:00:00.000Z",
    });
    expect(outcome).toMatchObject({
      state: "expired",
      attributableMinorUnits: 0,
    });
  });

  it("stays pending with a click and no order", () => {
    expect(
      resolveAttribution({ records: [click], asOf: "2026-07-10T00:00:00.000Z" })
        .state,
    ).toBe("pending");
  });
});

describe("buildPartnerPayload", () => {
  it("tells a partner nothing about who the customer is", () => {
    const payload = buildPartnerPayload({
      record: record({ event: "order_confirmed" }),
      customerFullName: "Alexander van Doorn",
      customerEmail: "a@example.com",
      selfPortrait: { chest: 1020, favouriteColour: "navy" },
    });
    expect(Object.keys(payload)).toEqual([
      "pseudonymousRef",
      "listingId",
      "event",
      "occurredAt",
    ]);
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("Alexander");
    expect(serialized).not.toContain("example.com");
    expect(serialized).not.toContain("1020");
  });
});

describe("checkRewardGrant", () => {
  const base = {
    fundingSource: "partner_commission" as const,
    valueMinorUnits: 500,
    expiresOn: "2027-01-01",
    attributionState: "confirmed" as const,
  };

  it("grants against a named funding source and a confirmed attribution", () => {
    expect(checkRewardGrant(base)).toEqual({ ok: true });
  });

  it("refuses a reward with no funding source", () => {
    // Every unit of value must trace to money that already exists, because
    // ADR-062 has not approved stored value.
    const { fundingSource: _drop, ...unfunded } = base;
    expect(checkRewardGrant(unfunded)).toEqual({
      ok: false,
      reason: "funding_source_required",
    });
  });

  it("refuses an unexpiring balance", () => {
    // An indefinite liability is exactly the stored-value question nobody
    // has answered.
    const { expiresOn: _drop, ...noExpiry } = base;
    expect(checkRewardGrant(noExpiry)).toEqual({
      ok: false,
      reason: "expiry_required",
    });
  });

  it("refuses to grant against an attribution still holding", () => {
    expect(checkRewardGrant({ ...base, attributionState: "holding" })).toEqual({
      ok: false,
      reason: "attribution_not_confirmed",
    });
  });
});

describe("checkRewardRedemption", () => {
  const base = {
    state: "available" as const,
    balanceMinorUnits: 500,
    redeemMinorUnits: 200,
    expiresOn: "2027-01-01T00:00:00.000Z",
    asOf: "2026-08-01T00:00:00.000Z",
    ownerCustomerId: "cust-1",
  };

  it("redeems within balance and before expiry", () => {
    expect(checkRewardRedemption(base)).toEqual({ ok: true });
  });

  it("refuses transfer to another customer outright", () => {
    // A transferable balance is a currency, and PAON has no licence to
    // issue one. A refusal rather than an unimplemented branch means
    // nobody can enable it with a boolean.
    expect(
      checkRewardRedemption({ ...base, targetCustomerId: "cust-2" }),
    ).toEqual({
      ok: false,
      reason: "transfer_between_customers_not_permitted",
    });
  });

  it("allows redeeming to your own account", () => {
    expect(
      checkRewardRedemption({ ...base, targetCustomerId: "cust-1" }),
    ).toEqual({ ok: true });
  });

  it("refuses an expired or over-balance redemption", () => {
    expect(
      checkRewardRedemption({ ...base, asOf: "2027-06-01T00:00:00.000Z" }),
    ).toEqual({ ok: false, reason: "expired" });
    expect(checkRewardRedemption({ ...base, redeemMinorUnits: 900 })).toEqual({
      ok: false,
      reason: "insufficient_balance",
    });
  });
});

describe("planRewardReversal", () => {
  it("reverses rewards whose source attribution was refunded", () => {
    const reversals = planRewardReversal({
      rewards: [
        {
          rewardId: "r1",
          attributionEventId: "a1",
          valueMinorUnits: 500,
          state: "available",
        },
        {
          rewardId: "r2",
          attributionEventId: "a2",
          valueMinorUnits: 300,
          state: "available",
        },
      ],
      reversedAttributionEventIds: ["a1"],
    });
    expect(reversals).toEqual([
      {
        rewardId: "r1",
        reversedMinorUnits: 500,
        reason: "Source attribution refunded",
      },
    ]);
  });

  it("does not reverse something already reversed or expired", () => {
    expect(
      planRewardReversal({
        rewards: [
          {
            rewardId: "r1",
            attributionEventId: "a1",
            valueMinorUnits: 500,
            state: "reversed",
          },
        ],
        reversedAttributionEventIds: ["a1"],
      }),
    ).toEqual([]);
  });
});

describe("checkConciergeRequest", () => {
  it("works with no money design at all", () => {
    // The useful half of 15.2 should not be blocked on a decision it does
    // not need.
    expect(
      checkConciergeRequest({
        detail: "Collect the navy suit on Thursday and press it.",
        involvesPayment: false,
      }),
    ).toEqual({ ok: true });
  });

  it("refuses a concierge request that would move money", () => {
    expect(
      checkConciergeRequest({
        detail: "Pay the tailor on my behalf.",
        involvesPayment: true,
      }),
    ).toEqual({ ok: false, reason: "money_movement_not_permitted" });
  });
});
