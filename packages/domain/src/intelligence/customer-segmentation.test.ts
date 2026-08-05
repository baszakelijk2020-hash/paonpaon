import { describe, expect, it } from "vitest";

import {
  classifyBuyerSegments,
  rankCustomersBySpend,
  type CustomerOrderSummary,
} from "./customer-segmentation";

const asOf = new Date("2026-08-05T00:00:00Z");

function summary(overrides: Partial<CustomerOrderSummary> = {}) {
  return {
    customerId: "cust-1",
    customerName: "Test Customer",
    totalSpendMinorUnits: 100_000,
    currency: "USD",
    orderCount: 1,
    orderMonths: [3],
    ...overrides,
  };
}

describe("classifyBuyerSegments", () => {
  it("classifies a single order as one_time", () => {
    const segments = classifyBuyerSegments({ summary: summary(), asOf });
    expect(segments).toContain("one_time");
    expect(segments).not.toContain("repeat");
  });

  it("classifies two or more orders as repeat", () => {
    const segments = classifyBuyerSegments({
      summary: summary({ orderCount: 3, orderMonths: [3, 6, 9] }),
      asOf,
    });
    expect(segments).toContain("repeat");
    expect(segments).not.toContain("one_time");
  });

  it("classifies orders clustered in few months as seasonal", () => {
    const segments = classifyBuyerSegments({
      summary: summary({ orderCount: 3, orderMonths: [12, 12, 1] }),
      asOf,
    });
    expect(segments).toContain("seasonal");
  });

  it("never classifies spread-out orders as seasonal", () => {
    const segments = classifyBuyerSegments({
      summary: summary({ orderCount: 3, orderMonths: [1, 5, 9] }),
      asOf,
    });
    expect(segments).not.toContain("seasonal");
  });

  it("classifies a customer with no recent order as dormant", () => {
    const segments = classifyBuyerSegments({
      summary: summary({ mostRecentOrderAt: "2025-01-01T00:00:00Z" }),
      asOf,
    });
    expect(segments).toContain("dormant");
  });

  it("never classifies a customer with a recent order as dormant", () => {
    const segments = classifyBuyerSegments({
      summary: summary({ mostRecentOrderAt: "2026-08-01T00:00:00Z" }),
      asOf,
    });
    expect(segments).not.toContain("dormant");
  });

  it("omits suit/casual segments entirely when no category data exists", () => {
    const segments = classifyBuyerSegments({ summary: summary(), asOf });
    expect(segments).not.toContain("suit_focused");
    expect(segments).not.toContain("casual_focused");
  });

  it("classifies a majority-suit order history as suit_focused", () => {
    const segments = classifyBuyerSegments({
      summary: summary({ categoryCounts: { suit: 3, denim: 1 } }),
      asOf,
    });
    expect(segments).toContain("suit_focused");
    expect(segments).not.toContain("casual_focused");
  });

  it("classifies a majority-casual order history as casual_focused", () => {
    const segments = classifyBuyerSegments({
      summary: summary({ categoryCounts: { denim: 3, suit: 1 } }),
      asOf,
    });
    expect(segments).toContain("casual_focused");
    expect(segments).not.toContain("suit_focused");
  });
});

describe("rankCustomersBySpend", () => {
  it("ranks the highest real spender first", () => {
    const result = rankCustomersBySpend(
      [
        summary({ customerId: "low", totalSpendMinorUnits: 10_000 }),
        summary({ customerId: "high", totalSpendMinorUnits: 500_000 }),
        summary({ customerId: "mid", totalSpendMinorUnits: 100_000 }),
      ],
      asOf,
    );
    expect(result.map((r) => r.customerId)).toEqual(["high", "mid", "low"]);
    expect(result[0]!.rank).toBe(1);
    expect(result[2]!.rank).toBe(3);
  });
});
