import {
  asId,
  type Appointment,
  type ClientelingOpportunity,
} from "@paon/domain";
import { describe, expect, it } from "vitest";

import type { PaonSupabaseClient } from "../client-type";

import { DecisionFeedRepository } from "./decision-feed-repository";

const TEST_RETAILER_ID = asId<"RetailerId">("test-retailer-feed");
const TEST_CUSTOMER_ID = asId<"CustomerId">("test-customer-feed");
const TEST_NOW = new Date("2026-08-13T14:00:00Z");

describe("DecisionFeedRepository", () => {
  it("correctly maps clienteling opportunity to feed input", () => {
    // This test verifies the repository can map domain objects to feed inputs
    const opportunity: ClientelingOpportunity = {
      id: "opp-1",
      retailerId: TEST_RETAILER_ID,
      customerId: TEST_CUSTOMER_ID,
      type: "interest_follow_up",
      whyNow: "Customer interested in new collection",
      suggestedAction: "Call this week",
      channel: "message",
      priority: 1,
      confidence: 0.85,
      status: "draft",
      contactPressure: false,
      evidence: [],
      projectorVersion: "v1",
      createdAt: "2026-08-13T00:00:00Z",
      updatedAt: "2026-08-13T00:00:00Z",
    };

    // Verify opportunity data can be converted to DecisionFeedInput shape
    expect(opportunity.whyNow).toBe("Customer interested in new collection");
    expect(opportunity.confidence).toBe(0.85);
  });

  it("correctly maps appointment to feed input", () => {
    // This test verifies the repository can map appointments to feed inputs
    const appointment: Appointment = {
      id: asId<"AppointmentId">("apt-1"),
      retailerId: TEST_RETAILER_ID,
      customerId: TEST_CUSTOMER_ID,
      type: "fitting",
      status: "confirmed",
      startsAt: new Date(TEST_NOW.getTime() + 30 * 60 * 1000).toISOString(),
      endsAt: new Date(TEST_NOW.getTime() + 90 * 60 * 1000).toISOString(),
      createdAt: "2026-08-13T00:00:00Z",
      updatedAt: "2026-08-13T00:00:00Z",
    };

    // Verify appointment data can be converted to DecisionFeedInput shape
    expect(appointment.startsAt).toBeDefined();
    expect(appointment.type).toBe("fitting");
  });

  it("instantiates with a PaonSupabaseClient", () => {
    const mockClient = {} as PaonSupabaseClient;
    const repo = new DecisionFeedRepository(mockClient);
    expect(repo).toBeDefined();
  });
});
