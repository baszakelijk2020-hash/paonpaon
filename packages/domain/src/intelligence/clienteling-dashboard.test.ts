import { describe, expect, it } from "vitest";

import { asId } from "../shared/branded-id";

import {
  projectCustomerPresence,
  projectHourlyHeatmap,
  projectOpportunityFunnel,
} from "./clienteling-dashboard";

const customerId = asId<"CustomerId">("33333333-3333-4333-8333-333333333333");

describe("clienteling dashboard projectors", () => {
  it("never marks presence active after TTL expiry", () => {
    const now = "2026-07-30T12:00:00.000Z";
    const rows = projectCustomerPresence({
      now,
      ttlMs: 120_000,
      sessions: [
        {
          customerId,
          state: "active",
          lastSeenAt: "2026-07-30T11:55:00.000Z",
        },
        {
          customerId: asId<"CustomerId">(
            "44444444-4444-4444-8444-444444444444",
          ),
          state: "active",
          lastSeenAt: "2026-07-30T11:59:30.000Z",
        },
      ],
    });
    expect(rows.find((row) => row.customerId === customerId)?.status).toBe(
      "last_seen",
    );
    expect(
      rows.find(
        (row) => row.customerId === "44444444-4444-4444-8444-444444444444",
      )?.status,
    ).toBe("active");
    expect(rows.find((row) => row.status === "active")?.label).toBe(
      "Active now",
    );
  });

  it("counts opportunity funnel without vanity totals", () => {
    const funnel = projectOpportunityFunnel([
      { status: "draft", contactPressure: true },
      { status: "draft", contactPressure: false },
      { status: "accepted", contactPressure: false },
      { status: "completed", contactPressure: false },
    ]);
    expect(funnel.draft).toBe(2);
    expect(funnel.contactPressureDrafts).toBe(1);
    expect(funnel.accepted).toBe(1);
    expect(funnel.completed).toBe(1);
  });

  it("builds a 24-hour heatmap", () => {
    const heat = projectHourlyHeatmap([9, 9, 18, 25, -1]);
    expect(heat[9]?.count).toBe(2);
    expect(heat[18]?.count).toBe(1);
    expect(heat).toHaveLength(24);
  });
});
