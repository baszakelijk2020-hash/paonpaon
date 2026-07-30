import { describe, expect, it } from "vitest";

import { asId } from "../shared/branded-id";

import {
  applyContactPressureAndDedupe,
  DEFAULT_CONTACT_COOLDOWN_DAYS,
  projectClientelingOpportunityDrafts,
  sparseRankOpportunityDrafts,
  type ClientelingOpportunityProjectionInput,
} from "./clienteling-opportunity";
import type { CustomerInterestInsight } from "./customer-interest";
import type { BehavioralEvent } from "./interaction-event";

const retailerId = asId<"RetailerId">("11111111-1111-4111-8111-111111111111");
const otherRetailerId = asId<"RetailerId">(
  "22222222-2222-4222-8222-222222222222",
);
const customerId = asId<"CustomerId">("33333333-3333-4333-8333-333333333333");
const now = "2026-07-30T12:00:00.000Z";

function event(args: {
  readonly id: string;
  readonly name: BehavioralEvent["name"];
  readonly occurredAt: string;
}): BehavioralEvent {
  return {
    id: asId<"BehavioralEventId">(args.id),
    retailerId,
    customerId,
    name: args.name,
    properties: {
      productId: asId<"ProductId">("aaaaaaaa-aaaa-4aaa-8aaa-000000000001"),
    },
    occurredAt: args.occurredAt,
    source: "customer_portal",
    purpose: "personalization",
    consentBasis: "explicit_opt_in",
    consentSnapshot: {
      personalization: "granted",
      marketing: "denied",
      location: "denied",
      capturedAt: args.occurredAt,
      basis: "explicit_opt_in",
    },
    retentionClass: "personalization_signal",
    retentionExpiresAt: "2027-07-30T12:00:00.000Z",
  };
}

function insight(
  overrides: Partial<CustomerInterestInsight> = {},
): CustomerInterestInsight {
  return {
    scopeConceptId: asId<"MetadataConceptId">(
      "44444444-4444-4444-8444-444444444444",
    ),
    scopeConceptLabel: "Suits",
    scopeKind: "garment_type",
    attributeConceptId: asId<"MetadataConceptId">(
      "55555555-5555-4555-8555-555555555555",
    ),
    attributeConceptLabel: "Brown",
    attributeKind: "colour",
    polarity: "positive",
    numerator: 8,
    denominator: 10,
    share: 0.8,
    eventCount: 12,
    uniqueProductCount: 10,
    sessionCount: 3,
    windowStart: "2026-07-01T00:00:00.000Z",
    windowEnd: now,
    latestEvidenceAt: "2026-07-29T10:00:00.000Z",
    confidence: 0.82,
    suppressed: false,
    evidenceEventIds: [
      asId<"BehavioralEventId">("bbbbbbbb-bbbb-4bbb-8bbb-000000000001"),
    ],
    projectorVersion: "customer-interest-v1",
    statement: "8 of 10 suit views were brown",
    ...overrides,
  };
}

function baseInput(
  overrides: Partial<ClientelingOpportunityProjectionInput> = {},
): ClientelingOpportunityProjectionInput {
  return {
    retailerId,
    viewerRetailerId: retailerId,
    customerId,
    customerName: "James Hart",
    now,
    events: [],
    interestInsights: [],
    recentContacts: [],
    existingProjectorKeys: [],
    ...overrides,
  };
}

describe("projectClientelingOpportunityDrafts", () => {
  it("fail-closes cross-tenant projection", () => {
    const result = projectClientelingOpportunityDrafts(
      baseInput({ viewerRetailerId: otherRetailerId }),
    );
    expect(result.drafts).toHaveLength(0);
  });

  it("creates recent browsing and interest affinity hooks with evidence", () => {
    const result = projectClientelingOpportunityDrafts(
      baseInput({
        events: [
          event({
            id: "e1",
            name: "product_viewed",
            occurredAt: "2026-07-29T10:00:00.000Z",
          }),
          event({
            id: "e2",
            name: "product_viewed",
            occurredAt: "2026-07-30T08:00:00.000Z",
          }),
        ],
        interestInsights: [insight()],
      }),
    );
    expect(result.drafts.length).toBeGreaterThanOrEqual(2);
    const browsing = result.drafts.find(
      (d) => d.hookKind === "recent_browsing",
    );
    const affinity = result.drafts.find(
      (d) => d.hookKind === "interest_affinity",
    );
    expect(browsing?.whyNow).toContain("product views");
    expect(browsing?.evidence.length).toBeGreaterThan(0);
    expect(affinity?.whyNow).toBe("8 of 10 suit views were brown");
    expect(affinity?.suggestedAction).toBe("review_shortlist");
  });

  it("prioritizes appointment intent over dormancy", () => {
    const result = projectClientelingOpportunityDrafts(
      baseInput({
        events: [
          event({
            id: "old",
            name: "product_viewed",
            occurredAt: "2026-03-01T10:00:00.000Z",
          }),
          event({
            id: "intent",
            name: "appointment_intent",
            occurredAt: "2026-07-29T15:00:00.000Z",
          }),
        ],
        maxDrafts: 1,
      }),
    );
    expect(result.drafts).toHaveLength(1);
    expect(result.drafts[0]?.hookKind).toBe("appointment_intent");
  });

  it("suppresses hooks under contact cooldown except advisor questions", () => {
    const browsingOnly = projectClientelingOpportunityDrafts(
      baseInput({
        events: [
          event({
            id: "e1",
            name: "product_viewed",
            occurredAt: "2026-07-29T10:00:00.000Z",
          }),
          event({
            id: "e2",
            name: "product_viewed",
            occurredAt: "2026-07-30T08:00:00.000Z",
          }),
        ],
        recentContacts: [
          {
            customerId,
            occurredAt: "2026-07-28T10:00:00.000Z",
            source: "message",
          },
        ],
      }),
    );
    expect(browsingOnly.drafts).toHaveLength(0);
    expect(browsingOnly.suppressedByCooldown).toBeGreaterThan(0);

    const withQuestion = projectClientelingOpportunityDrafts(
      baseInput({
        events: [
          event({
            id: "q1",
            name: "advisor_question",
            occurredAt: "2026-07-30T09:00:00.000Z",
          }),
        ],
        recentContacts: [
          {
            customerId,
            occurredAt: "2026-07-28T10:00:00.000Z",
            source: "message",
          },
        ],
      }),
    );
    expect(
      withQuestion.drafts.some((d) => d.hookKind === "advisor_question"),
    ).toBe(true);
  });

  it("dedupes existing projector keys", () => {
    const result = projectClientelingOpportunityDrafts(
      baseInput({
        events: [
          event({
            id: "intent",
            name: "appointment_intent",
            occurredAt: "2026-07-29T15:00:00.000Z",
          }),
        ],
        existingProjectorKeys: [`appointment_intent:${customerId}:intent`],
      }),
    );
    expect(result.drafts).toHaveLength(0);
    expect(result.suppressedByDuplicate).toBe(1);
  });

  it("limits sparsity to max drafts per customer", () => {
    const ranked = sparseRankOpportunityDrafts(
      [
        {
          retailerId,
          customerId,
          customerName: "James",
          hookKind: "recent_browsing",
          projectorKey: "a",
          title: "A",
          whyNow: "A",
          suggestedAction: "send_message",
          suggestedChannel: "in_app_message",
          suggestedAt: now,
          priority: 50,
          confidence: 0.5,
          dueAt: now,
          expiresAt: now,
          evidence: [],
          projectorVersion: "clienteling-opportunity-v1",
        },
        {
          retailerId,
          customerId,
          customerName: "James",
          hookKind: "appointment_intent",
          projectorKey: "b",
          title: "B",
          whyNow: "B",
          suggestedAction: "book_appointment",
          suggestedChannel: "phone",
          suggestedAt: now,
          priority: 90,
          confidence: 0.9,
          dueAt: now,
          expiresAt: now,
          evidence: [],
          projectorVersion: "clienteling-opportunity-v1",
        },
        {
          retailerId,
          customerId,
          customerName: "James",
          hookKind: "wishlist_signal",
          projectorKey: "c",
          title: "C",
          whyNow: "C",
          suggestedAction: "review_shortlist",
          suggestedChannel: "in_app_message",
          suggestedAt: now,
          priority: 60,
          confidence: 0.6,
          dueAt: now,
          expiresAt: now,
          evidence: [],
          projectorVersion: "clienteling-opportunity-v1",
        },
      ],
      2,
    );
    expect(ranked).toHaveLength(2);
    expect(ranked[0]?.hookKind).toBe("appointment_intent");
  });
});

describe("applyContactPressureAndDedupe", () => {
  it("respects configurable cooldown days", () => {
    const draft = {
      retailerId,
      customerId,
      customerName: "James",
      hookKind: "wishlist_signal" as const,
      projectorKey: "wishlist:1",
      title: "Saved",
      whyNow: "Saved",
      suggestedAction: "send_message" as const,
      suggestedChannel: "in_app_message" as const,
      suggestedAt: now,
      priority: 60,
      confidence: 0.6,
      dueAt: now,
      expiresAt: now,
      evidence: [],
      projectorVersion: "clienteling-opportunity-v1",
    };
    const withinDefault = applyContactPressureAndDedupe({
      drafts: [draft],
      customerId,
      recentContacts: [
        {
          customerId,
          occurredAt: "2026-07-28T10:00:00.000Z",
          source: "clienteling_note",
        },
      ],
      existingProjectorKeys: [],
      now,
    });
    expect(withinDefault.kept).toHaveLength(0);

    const outsideWindow = applyContactPressureAndDedupe({
      drafts: [draft],
      customerId,
      recentContacts: [
        {
          customerId,
          occurredAt: "2026-07-15T10:00:00.000Z",
          source: "clienteling_note",
        },
      ],
      existingProjectorKeys: [],
      now,
      cooldownDays: DEFAULT_CONTACT_COOLDOWN_DAYS,
    });
    expect(outsideWindow.kept).toHaveLength(1);
  });
});
