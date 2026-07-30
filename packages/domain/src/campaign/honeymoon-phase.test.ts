import { describe, expect, it } from "vitest";

import { projectHoneymoonMilestones } from "./honeymoon-phase";

const now = "2026-07-30T10:00:00.000Z";

describe("projectHoneymoonMilestones", () => {
  it("returns no milestones for pending payment orders", () => {
    const milestones = projectHoneymoonMilestones({
      orderId: "order-1",
      orderStatus: "pending_payment",
      lines: [],
      nowUtcIso: now,
      recentTouchCount: 0,
    });
    expect(milestones).toHaveLength(0);
  });

  it("creates preparation milestones with lead-time truth", () => {
    const milestones = projectHoneymoonMilestones({
      orderId: "order-1",
      orderStatus: "in_production",
      placedAt: now,
      lines: [
        {
          productVariantId: "v-1",
          quantity: 1,
          requiresProduction: true,
          requiresAlteration: false,
          leadTimeDays: 21,
          inventoryQuantity: 0,
        },
      ],
      nowUtcIso: now,
      recentTouchCount: 0,
    });

    expect(milestones.some((m) => m.kind === "preparation")).toBe(true);
    expect(
      milestones.some((m) => m.leadTimeTruth?.includes("21 day")),
    ).toBe(true);
  });

  it("suppresses outreach milestones under contact pressure", () => {
    const milestones = projectHoneymoonMilestones({
      orderId: "order-1",
      orderStatus: "placed",
      placedAt: now,
      lines: [
        {
          productVariantId: "v-1",
          quantity: 1,
          requiresProduction: false,
          requiresAlteration: false,
          inventoryQuantity: 5,
        },
      ],
      nowUtcIso: now,
      recentTouchCount: 4,
    });

    const prep = milestones.find((m) => m.title === "Prepare your wardrobe");
    expect(prep?.status).toBe("suppressed");
    expect(prep?.suppressReason).toContain("Contact pressure");
  });

  it("adds collection and aftercare milestones for delivered orders", () => {
    const milestones = projectHoneymoonMilestones({
      orderId: "order-1",
      orderStatus: "delivered",
      placedAt: now,
      lines: [
        {
          productVariantId: "v-1",
          quantity: 1,
          requiresProduction: false,
          requiresAlteration: true,
          inventoryQuantity: 1,
        },
      ],
      nowUtcIso: now,
      recentTouchCount: 0,
    });

    expect(milestones.some((m) => m.kind === "aftercare")).toBe(true);
    expect(milestones.some((m) => m.title.includes("tailoring"))).toBe(true);
    expect(milestones.some((m) => m.stockTruth?.includes("low stock"))).toBe(
      true,
    );
  });
});
