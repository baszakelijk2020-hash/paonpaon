import { describe, expect, it } from "vitest";

import { asId } from "../shared/branded-id";

import {
  DECISION_FEED_ENTRY_WEIGHTS,
  DECISION_FEED_RULE_VERSION,
  rankDecisionFeedEntries,
  type DecisionFeedInput,
} from "./decision-feed";

const TEST_CUSTOMER_ID = asId<"CustomerId">("test-customer");
const TEST_NOW = new Date("2026-08-13T14:00:00Z");

describe("rankDecisionFeedEntries", () => {
  it("returns empty array for empty input", () => {
    const result = rankDecisionFeedEntries([], TEST_NOW);
    expect(result).toEqual([]);
  });

  it("assigns rank starting from 1", () => {
    const inputs: DecisionFeedInput[] = [
      {
        kind: "unread_message",
        sourceId: "msg1",
        messageThreadId: "thread1",
        unreadCount: 1,
      },
      {
        kind: "low_stock",
        sourceId: "stock1",
        variantName: "Blue L",
        unitCount: 3,
      },
    ];
    const result = rankDecisionFeedEntries(inputs, TEST_NOW);
    expect(result[0]?.rank).toBe(1);
    expect(result[1]?.rank).toBe(2);
  });

  it("ranks price approval pending highest due to base weight", () => {
    const inputs: DecisionFeedInput[] = [
      {
        kind: "price_approval_pending",
        sourceId: "approve1",
        workOrderNumber: "WO-001",
        originalAmountMinorUnits: 10000,
        proposedAmountMinorUnits: 15000,
      },
      {
        kind: "unread_message",
        sourceId: "msg1",
        messageThreadId: "thread1",
        unreadCount: 1,
      },
    ];
    const result = rankDecisionFeedEntries(inputs, TEST_NOW);
    // Price approval has base 90, unread has base 55
    expect(result[0]?.input.kind).toBe("price_approval_pending");
    expect(result[1]?.input.kind).toBe("unread_message");
  });

  it("ranks imminent appointments higher than future appointments", () => {
    const imminentTime = new Date(TEST_NOW.getTime() + 30 * 60 * 1000); // 30 mins from now
    const laterTime = new Date(TEST_NOW.getTime() + 3 * 60 * 60 * 1000); // 3 hours from now

    const inputs: DecisionFeedInput[] = [
      {
        kind: "appointment_today",
        sourceId: asId<"AppointmentId">("appt1"),
        customerId: TEST_CUSTOMER_ID,
        startsAt: laterTime.toISOString(),
        customerName: "John",
        appointmentType: "fitting",
      },
      {
        kind: "appointment_soon",
        sourceId: asId<"AppointmentId">("appt2"),
        customerId: TEST_CUSTOMER_ID,
        startsAt: imminentTime.toISOString(),
        customerName: "Jane",
        appointmentType: "styling_consultation",
      },
    ];
    const result = rankDecisionFeedEntries(inputs, TEST_NOW);
    // Imminent (appointment_soon + 30 bonus) = 85 + 30 = 115
    // Later (appointment_today + 15 bonus) = 70 + 15 = 85
    expect(result[0]?.input.sourceId).toBe("appt2");
    expect(result[1]?.input.sourceId).toBe("appt1");
  });

  it("considers confidence when ranking opportunities", () => {
    const inputs: DecisionFeedInput[] = [
      {
        kind: "clienteling_opportunity",
        sourceId: "opp1",
        customerId: TEST_CUSTOMER_ID,
        opportunityType: "interest_follow_up",
        whyNow: "High confidence interest",
        suggestedAction: "Call this week",
        priority: 1,
        confidence: 0.9, // 0.9 * 20 = 18 bonus
      },
      {
        kind: "clienteling_opportunity",
        sourceId: "opp2",
        customerId: TEST_CUSTOMER_ID,
        opportunityType: "interest_follow_up",
        whyNow: "Low confidence interest",
        suggestedAction: "Call this week",
        priority: 1,
        confidence: 0.3, // 0.3 * 20 = 6 bonus
      },
    ];
    const result = rankDecisionFeedEntries(inputs, TEST_NOW);
    // High confidence: 60 + 18 + (10 - 1*5) = 60 + 18 + 5 = 83
    // Low confidence: 60 + 6 + (10 - 1*5) = 60 + 6 + 5 = 71
    expect(result[0]?.input.sourceId).toBe("opp1");
    expect(result[1]?.input.sourceId).toBe("opp2");
  });

  it("includes reasonText from opportunity whyNow field", () => {
    const inputs: DecisionFeedInput[] = [
      {
        kind: "clienteling_opportunity",
        sourceId: "opp1",
        customerId: TEST_CUSTOMER_ID,
        opportunityType: "interest_follow_up",
        whyNow: "Customer showed interest in new collection",
        suggestedAction: "Call this week",
        priority: 1,
        confidence: 0.8,
      },
    ];
    const result = rankDecisionFeedEntries(inputs, TEST_NOW);
    expect(result[0]?.reasonText).toBe(
      "Customer showed interest in new collection",
    );
  });

  it("handles missing dueAt without crashing", () => {
    const inputs: DecisionFeedInput[] = [
      {
        kind: "clienteling_opportunity",
        sourceId: "opp1",
        customerId: TEST_CUSTOMER_ID,
        opportunityType: "interest_follow_up",
        whyNow: "No due date set",
        suggestedAction: "Follow up",
        priority: 1,
        confidence: 0.5,
        // no dueAt
      },
    ];
    expect(() => rankDecisionFeedEntries(inputs, TEST_NOW)).not.toThrow();
    const result = rankDecisionFeedEntries(inputs, TEST_NOW);
    expect(result[0]?.reasonCode).toContain("no_due_time");
  });

  it("sets ruleVersion on every entry", () => {
    const inputs: DecisionFeedInput[] = [
      {
        kind: "unread_message",
        sourceId: "msg1",
        messageThreadId: "thread1",
        unreadCount: 1,
      },
    ];
    const result = rankDecisionFeedEntries(inputs, TEST_NOW);
    expect(result[0]?.ruleVersion).toBe(DECISION_FEED_RULE_VERSION);
  });

  it("includes confidence for all entry kinds", () => {
    const inputs: DecisionFeedInput[] = [
      {
        kind: "price_approval_pending",
        sourceId: "approve1",
        workOrderNumber: "WO-001",
        originalAmountMinorUnits: 10000,
        proposedAmountMinorUnits: 15000,
      },
      {
        kind: "appointment_soon",
        sourceId: asId<"AppointmentId">("appt1"),
        customerId: TEST_CUSTOMER_ID,
        startsAt: new Date(TEST_NOW.getTime() + 30 * 60 * 1000).toISOString(),
        customerName: "Jane",
        appointmentType: "fitting",
      },
      {
        kind: "clienteling_opportunity",
        sourceId: "opp1",
        customerId: TEST_CUSTOMER_ID,
        opportunityType: "interest_follow_up",
        whyNow: "Interested",
        suggestedAction: "Call",
        priority: 1,
        confidence: 0.8,
      },
    ];
    const result = rankDecisionFeedEntries(inputs, TEST_NOW);
    // All should have confidence
    result.forEach((entry) => {
      expect(entry.confidence).toBeDefined();
      expect(typeof entry.confidence).toBe("number");
    });
  });

  it("maintains stable ordering for equal scores", () => {
    const inputs: DecisionFeedInput[] = [
      {
        kind: "low_stock",
        sourceId: "stock1",
        variantName: "Blue L",
        unitCount: 3,
      },
      {
        kind: "low_stock",
        sourceId: "stock2",
        variantName: "Red M",
        unitCount: 2,
      },
    ];
    const result = rankDecisionFeedEntries(inputs, TEST_NOW);
    // Both have same base weight and no urgency bonus
    expect(result[0]?.input.sourceId).toBe("stock1");
    expect(result[1]?.input.sourceId).toBe("stock2");
  });

  it("formats appointment time in reasonText", () => {
    const appointmentTime = new Date("2026-08-13T15:30:00Z");
    const inputs: DecisionFeedInput[] = [
      {
        kind: "appointment_today",
        sourceId: asId<"AppointmentId">("appt1"),
        customerId: TEST_CUSTOMER_ID,
        startsAt: appointmentTime.toISOString(),
        customerName: "John Doe",
        appointmentType: "fitting",
      },
    ];
    const result = rankDecisionFeedEntries(inputs, TEST_NOW);
    expect(result[0]?.reasonText).toContain("John Doe");
    expect(result[0]?.reasonText).toContain("today");
  });

  it("correctly scores unread messages by count", () => {
    const inputs: DecisionFeedInput[] = [
      {
        kind: "unread_message",
        sourceId: "msg1",
        messageThreadId: "thread1",
        unreadCount: 1,
      },
      {
        kind: "unread_message",
        sourceId: "msg2",
        messageThreadId: "thread2",
        unreadCount: 5,
      },
    ];
    const result = rankDecisionFeedEntries(inputs, TEST_NOW);
    // Both have same base weight, order should be stable
    expect(result[0]?.input.sourceId).toBe("msg1");
    expect(result[1]?.input.sourceId).toBe("msg2");
    // But reasonText should be different
    expect(result[0]?.reasonText).toContain("One");
    expect(result[1]?.reasonText).toContain("5");
  });

  it("uses weight table as documented", () => {
    expect(DECISION_FEED_ENTRY_WEIGHTS.price_approval_pending.baseWeight).toBe(
      90,
    );
    expect(DECISION_FEED_ENTRY_WEIGHTS.appointment_soon.baseWeight).toBe(85);
    expect(DECISION_FEED_ENTRY_WEIGHTS.appointment_today.baseWeight).toBe(70);
    expect(DECISION_FEED_ENTRY_WEIGHTS.clienteling_opportunity.baseWeight).toBe(
      60,
    );
    expect(DECISION_FEED_ENTRY_WEIGHTS.unread_message.baseWeight).toBe(55);
    expect(DECISION_FEED_ENTRY_WEIGHTS.low_stock.baseWeight).toBe(25);
  });
});
