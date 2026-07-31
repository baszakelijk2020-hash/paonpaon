import { describe, expect, it } from "vitest";

import {
  composeSevenDayOwnedFirstPlan,
  deriveHoneymoonActions,
  separateOwnedAndSuggested,
} from "./seven-day-honeymoon";

describe("seven-day and honeymoon packages", () => {
  it("separates owned and suggested slots and cites gaps", () => {
    const plan = composeSevenDayOwnedFirstPlan({
      owned: [
        {
          wardrobeItemId: "w1",
          slotKind: "jacket",
          label: "Navy jacket",
        },
      ],
      suggested: [
        {
          productId: "p1",
          slotKind: "shirt",
          label: "White shirt",
          inStock: true,
        },
        {
          productId: "p2",
          slotKind: "shoes",
          label: "OOS shoes",
          inStock: false,
        },
      ],
    });
    const separated = separateOwnedAndSuggested(plan.slots);
    expect(separated.owned.length).toBeGreaterThan(0);
    expect(separated.suggested.length).toBeGreaterThan(0);
    expect(plan.gaps.some((gap) => gap.slotKind === "shoes")).toBe(true);
    expect(plan.gaps.some((gap) => gap.slotKind === "trousers")).toBe(true);
    expect(separated.owned.every((slot) => slot.source === "owned")).toBe(true);
    expect(
      separated.suggested.every((slot) => slot.source === "suggested"),
    ).toBe(true);
  });

  it("derives honeymoon actions with stock, lead-time and pressure suppression", () => {
    const suppressed = deriveHoneymoonActions({
      orderStatus: "in_production",
      lines: [
        {
          productLabel: "Suit",
          quantity: 1,
          inStock: false,
          leadTimeDays: 14,
        },
      ],
      contactPressureActive: false,
    });
    expect(
      suppressed.find((action) => action.kind === "preparation")?.suppressed,
    ).toBe(true);
    expect(
      suppressed.every((action) => action.requiresPaymentApproval === false),
    ).toBe(true);

    const ready = deriveHoneymoonActions({
      orderStatus: "delivered",
      lines: [
        {
          productLabel: "Suit",
          quantity: 1,
          inStock: true,
          leadTimeDays: 0,
        },
      ],
      contactPressureActive: false,
    });
    expect(
      ready.find((action) => action.kind === "aftercare")?.suppressed,
    ).toBe(false);

    const pressure = deriveHoneymoonActions({
      orderStatus: "delivered",
      lines: [
        {
          productLabel: "Suit",
          quantity: 1,
          inStock: true,
          leadTimeDays: 0,
        },
      ],
      contactPressureActive: true,
    });
    expect(pressure.every((action) => action.suppressed)).toBe(true);
  });
});
