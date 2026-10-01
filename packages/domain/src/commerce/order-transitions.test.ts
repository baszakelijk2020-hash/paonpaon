import { describe, expect, it } from "vitest";

import {
  allowedOrderTransitions,
  canTransitionOrder,
} from "./order-transitions";

describe("order transitions", () => {
  it("refuses the jumps the old free-for-all dropdown allowed", () => {
    // The dropdown used to list every status with no server-side check, so an
    // order could skip straight from awaiting payment to completed.
    expect(canTransitionOrder("pending_payment", "completed")).toBe(false);
    expect(canTransitionOrder("placed", "delivered")).toBe(false);
    expect(canTransitionOrder("pending_payment", "shipped")).toBe(false);
  });

  it("allows the real path through the shop", () => {
    expect(canTransitionOrder("pending_payment", "placed")).toBe(true);
    expect(canTransitionOrder("placed", "in_production")).toBe(true);
    expect(canTransitionOrder("in_production", "ready_for_fulfillment")).toBe(
      true,
    );
    expect(canTransitionOrder("ready_for_fulfillment", "shipped")).toBe(true);
    expect(canTransitionOrder("shipped", "delivered")).toBe(true);
    expect(canTransitionOrder("delivered", "completed")).toBe(true);
  });

  it("never resurrects a terminal order", () => {
    expect(allowedOrderTransitions("canceled")).toHaveLength(0);
    expect(allowedOrderTransitions("refunded")).toHaveLength(0);
    expect(canTransitionOrder("canceled", "placed")).toBe(false);
    expect(canTransitionOrder("refunded", "in_production")).toBe(false);
  });

  it("lets staff cancel any order that is not already finished", () => {
    for (const status of [
      "pending_payment",
      "placed",
      "in_production",
      "ready_for_fulfillment",
      "shipped",
    ] as const) {
      expect(canTransitionOrder(status, "canceled")).toBe(true);
    }
    // Once it is with the customer, the remedy is a refund, not a cancel.
    expect(canTransitionOrder("delivered", "canceled")).toBe(false);
    expect(canTransitionOrder("completed", "canceled")).toBe(false);
    expect(canTransitionOrder("completed", "refunded")).toBe(true);
  });

  it("treats staying put as legal, so re-submitting a form is not an error", () => {
    expect(canTransitionOrder("in_production", "in_production")).toBe(true);
    expect(canTransitionOrder("canceled", "canceled")).toBe(true);
  });
});
