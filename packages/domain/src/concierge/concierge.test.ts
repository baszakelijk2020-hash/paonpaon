import { describe, expect, it } from "vitest";

import { asId } from "../shared/branded-id";

import {
  bookingStatusLabel,
  bookingTransitionTarget,
  canConsumeEntitlement,
  conciergeBookingTransitionIssues,
  entitlementKindForOperation,
  operationsForServiceKind,
  resolveServiceHandoff,
} from "./concierge";

const retailerId = asId<"RetailerId">("11111111-1111-4111-8111-111111111111");
const customerId = asId<"CustomerId">("22222222-2222-4222-8222-222222222222");
const otherCustomerId = asId<"CustomerId">(
  "33333333-3333-4333-8333-333333333333",
);

describe("concierge booking transitions", () => {
  it("maps transitions to target statuses", () => {
    expect(bookingTransitionTarget("schedule")).toBe("scheduled");
    expect(bookingTransitionTarget("complete")).toBe("completed");
    expect(bookingTransitionTarget("cancel")).toBe("canceled");
  });

  it("allows advisor scheduling from requested", () => {
    const issues = conciergeBookingTransitionIssues({
      transition: "schedule",
      currentStatus: "requested",
      enrollmentStatus: "active",
      bookingRetailerId: retailerId,
      bookingCustomerId: customerId,
      scheduledAt: "2026-08-01T10:00:00.000Z",
      actor: {
        kind: "advisor",
        retailerId,
        role: "sales_associate",
      },
    });
    expect(issues).toEqual([]);
  });

  it("rejects customer scheduling and cross-tenant access", () => {
    expect(
      conciergeBookingTransitionIssues({
        transition: "schedule",
        currentStatus: "requested",
        enrollmentStatus: "active",
        bookingRetailerId: retailerId,
        bookingCustomerId: customerId,
        scheduledAt: "2026-08-01T10:00:00.000Z",
        actor: {
          kind: "customer",
          retailerId,
          customerId,
        },
      }),
    ).toContain("customer_only");

    expect(
      conciergeBookingTransitionIssues({
        transition: "cancel",
        currentStatus: "requested",
        enrollmentStatus: "active",
        bookingRetailerId: retailerId,
        bookingCustomerId: customerId,
        actor: {
          kind: "customer",
          retailerId,
          customerId: otherCustomerId,
        },
      }),
    ).toContain("cross_tenant");
  });

  it("blocks transitions when enrollment is inactive", () => {
    expect(
      conciergeBookingTransitionIssues({
        transition: "start",
        currentStatus: "scheduled",
        enrollmentStatus: "paused",
        bookingRetailerId: retailerId,
        bookingCustomerId: customerId,
        actor: {
          kind: "advisor",
          retailerId,
          role: "manager",
        },
      }),
    ).toContain("enrollment_inactive");
  });
});

describe("concierge entitlements", () => {
  it("maps operations to entitlement kinds", () => {
    expect(entitlementKindForOperation("planning_session")).toBe(
      "planning_sessions",
    );
    expect(entitlementKindForOperation("pressing")).toBe("pressing_visits");
    expect(entitlementKindForOperation("collection")).toBe("collection_trips");
    expect(entitlementKindForOperation("size_check")).toBeNull();
  });

  it("consumes entitlements idempotently within allowance", () => {
    const entitlement = {
      kind: "pressing_visits" as const,
      allowance: 2,
      consumed: 1,
    };
    expect(
      canConsumeEntitlement({
        entitlement,
        operationKind: "pressing",
      }),
    ).toBe(true);
    expect(
      canConsumeEntitlement({
        entitlement: { ...entitlement, consumed: 2 },
        operationKind: "pressing",
      }),
    ).toBe(false);
    expect(
      canConsumeEntitlement({
        entitlement,
        operationKind: "repair",
      }),
    ).toBe(false);
  });
});

describe("concierge handoffs", () => {
  it("routes Preferred Tailoring planning to appointments", () => {
    expect(
      resolveServiceHandoff({
        serviceKind: "preferred_tailoring",
        operationKinds: ["planning_session"],
      }),
    ).toBe("appointment");
  });

  it("routes HighMaintenance garment care to alterations", () => {
    expect(
      resolveServiceHandoff({
        serviceKind: "high_maintenance",
        operationKinds: ["pressing"],
      }),
    ).toBe("alteration");
    expect(
      resolveServiceHandoff({
        serviceKind: "high_maintenance",
        operationKinds: ["collection", "delivery"],
      }),
    ).toBe("none");
  });

  it("lists operations per service kind", () => {
    expect(operationsForServiceKind("preferred_tailoring")).toContain(
      "planning_session",
    );
    expect(operationsForServiceKind("high_maintenance")).toContain("pressing");
  });

  it("labels booking statuses for presentation", () => {
    expect(bookingStatusLabel("in_progress")).toBe("In progress");
  });
});
