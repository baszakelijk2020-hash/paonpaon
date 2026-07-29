import { describe, expect, it } from "vitest";

import {
  careRequiresAlterationHandoff,
  defaultEntitlementsForKind,
  evaluateBookingTransition,
  evaluateEntitlementConsumption,
  isBookingKindForService,
  recommendedAppointmentType,
  SERVICE_KIND_LABELS,
} from "./service-plan";
import {
  enrollServiceMembershipInputSchema,
  recordServiceCostInputSchema,
  requestServiceBookingInputSchema,
  transitionServiceBookingInputSchema,
  upsertServicePlanInputSchema,
} from "./service-plan.schema";

describe("concierge service plan domain", () => {
  it("names both founder services", () => {
    expect(SERVICE_KIND_LABELS.preferred_tailoring).toBe("Preferred Tailoring");
    expect(SERVICE_KIND_LABELS.high_maintenance).toBe("HighMaintenance");
  });

  it("scopes booking kinds to each service", () => {
    expect(isBookingKindForService("preferred_tailoring", "planning")).toBe(
      true,
    );
    expect(isBookingKindForService("preferred_tailoring", "pressing")).toBe(
      false,
    );
    expect(isBookingKindForService("high_maintenance", "pressing")).toBe(true);
    expect(isBookingKindForService("high_maintenance", "planning")).toBe(false);
  });

  it("seeds non-monetary default entitlements", () => {
    const pt = defaultEntitlementsForKind("preferred_tailoring");
    expect(pt.some((e) => e.kind === "planning_session")).toBe(true);
    const hm = defaultEntitlementsForKind("high_maintenance");
    expect(hm.some((e) => e.kind === "collection_delivery")).toBe(true);
    expect(JSON.stringify(hm)).not.toMatch(/payment|stripe|stored.?value/i);
  });

  it("consumes entitlements idempotently", () => {
    const first = evaluateEntitlementConsumption({
      remainingQuantity: 3,
      quantity: 1,
      membershipActive: true,
      alreadyConsumed: false,
    });
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.remainingAfter).toBe(2);
      expect(first.alreadyApplied).toBe(false);
    }

    const replay = evaluateEntitlementConsumption({
      remainingQuantity: 2,
      quantity: 1,
      membershipActive: true,
      alreadyConsumed: true,
    });
    expect(replay.ok).toBe(true);
    if (replay.ok) {
      expect(replay.remainingAfter).toBe(2);
      expect(replay.alreadyApplied).toBe(true);
    }

    const insufficient = evaluateEntitlementConsumption({
      remainingQuantity: 0,
      quantity: 1,
      membershipActive: true,
      alreadyConsumed: false,
    });
    expect(insufficient.ok).toBe(false);
    if (!insufficient.ok) expect(insufficient.reason).toBe("insufficient");
  });

  it("rejects entitlement use on inactive membership", () => {
    const result = evaluateEntitlementConsumption({
      remainingQuantity: 5,
      quantity: 1,
      membershipActive: false,
      alreadyConsumed: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("inactive_membership");
  });

  it("enforces booking status transitions and service composition", () => {
    expect(
      evaluateBookingTransition({
        from: "requested",
        to: "confirmed",
        serviceKind: "preferred_tailoring",
        bookingKind: "planning",
      }).ok,
    ).toBe(true);

    const badJump = evaluateBookingTransition({
      from: "requested",
      to: "fulfilled",
      serviceKind: "preferred_tailoring",
      bookingKind: "planning",
    });
    expect(badJump.ok).toBe(false);

    const wrongKind = evaluateBookingTransition({
      from: "requested",
      to: "confirmed",
      serviceKind: "preferred_tailoring",
      bookingKind: "pressing",
    });
    expect(wrongKind.ok).toBe(false);
  });

  it("composes appointments and alterations without inventing payment", () => {
    expect(recommendedAppointmentType("planning")).toBe("styling_consultation");
    expect(recommendedAppointmentType("repair")).toBe("alteration_fitting");
    expect(careRequiresAlterationHandoff("repair")).toBe(true);
    expect(careRequiresAlterationHandoff("pressing")).toBe(false);
  });

  it("validates plan, booking, and operational cost inputs", () => {
    const plan = upsertServicePlanInputSchema.parse({
      kind: "preferred_tailoring",
      title: "Preferred Tailoring",
      summary: "Advisor wardrobe planning around agenda and travel.",
      explanation: "Dedicated concierge planning, not an order status.",
    });
    expect(plan.status).toBe("draft");

    enrollServiceMembershipInputSchema.parse({
      planId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
      customerId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
    });

    requestServiceBookingInputSchema.parse({
      membershipId: "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
      kind: "planning",
      idempotencyKey: "book-planning-1",
    });

    transitionServiceBookingInputSchema.parse({
      bookingId: "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
      status: "confirmed",
    });

    const cost = recordServiceCostInputSchema.parse({
      membershipId: "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
      label: "Pressing labour",
      amountMinorUnits: 2500,
      currency: "EUR",
    });
    expect(cost.amountMinorUnits).toBe(2500);
    expect(JSON.stringify(cost)).not.toContain("paymentIntent");
  });
});
