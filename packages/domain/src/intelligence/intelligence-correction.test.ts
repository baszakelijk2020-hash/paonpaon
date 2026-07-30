import { describe, expect, it } from "vitest";

import { asId } from "../shared/branded-id";

import {
  buildCorrectionReplay,
  excludeCorrectedEvents,
} from "./intelligence-correction";
import type { BehavioralEvent } from "./interaction-event";

const factId = asId<"CustomerFactId">("aaaaaaaa-aaaa-4aaa-8aaa-000000000001");
const eventId = asId<"BehavioralEventId">(
  "bbbbbbbb-bbbb-4bbb-8bbb-000000000001",
);
const retailerId = asId<"RetailerId">("11111111-1111-4111-8111-111111111111");
const customerId = asId<"CustomerId">("33333333-3333-4333-8333-333333333333");

describe("correction replay", () => {
  it("expires draft opportunities citing corrected facts", () => {
    const replay = buildCorrectionReplay({
      now: "2026-07-30T12:00:00.000Z",
      correctedFactIds: [factId],
      excludedEventIds: [eventId],
      opportunities: [
        {
          id: "opp-1",
          status: "draft",
          evidence: [{ factId }],
        },
        {
          id: "opp-2",
          status: "completed",
          evidence: [{ factId }],
        },
      ],
    });
    expect(replay.expireOpportunityIds).toEqual(["opp-1"]);
    expect(replay.markIncorrectOpportunityIds).toEqual([]);
    expect(replay.excludedEventIds).toEqual([eventId]);
  });

  it("filters corrected events from replay input", () => {
    const events: BehavioralEvent[] = [
      {
        id: eventId,
        retailerId,
        customerId,
        name: "product_viewed",
        properties: { productId: "aaaaaaaa-aaaa-4aaa-8aaa-000000000002" },
        occurredAt: "2026-07-30T11:00:00.000Z",
        source: "customer_portal",
        purpose: "personalization",
        consentBasis: "explicit_opt_in",
        consentSnapshot: {
          personalization: "granted",
          marketing: "denied",
          location: "denied",
          capturedAt: "2026-07-30T11:00:00.000Z",
          basis: "explicit_opt_in",
        },
        retentionClass: "personalization_signal",
        retentionExpiresAt: "2027-07-30T11:00:00.000Z",
      },
    ];
    const filtered = excludeCorrectedEvents(events, new Set([eventId]));
    expect(filtered).toHaveLength(0);
  });
});
