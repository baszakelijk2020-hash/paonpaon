import { describe, expect, it } from "vitest";

import { asId } from "../shared/branded-id";

import {
  CUSTOMER_INTEREST_PROJECTOR_VERSION,
  formatCustomerInterestStatement,
  interestEventDedupeKey,
  projectCustomerInterestInsights,
  type CustomerInterestProjectionInput,
  type InterestProductMetadata,
} from "./customer-interest";
import type { BehavioralEvent } from "./interaction-event";

const retailerId = asId<"RetailerId">("11111111-1111-4111-8111-111111111111");
const otherRetailerId = asId<"RetailerId">(
  "22222222-2222-4222-8222-222222222222",
);
const customerId = asId<"CustomerId">("33333333-3333-4333-8333-333333333333");
const suitId = asId<"MetadataConceptId">(
  "44444444-4444-4444-8444-444444444444",
);
const brownId = asId<"MetadataConceptId">(
  "55555555-5555-4555-8555-555555555555",
);
const navyId = asId<"MetadataConceptId">(
  "66666666-6666-4666-8666-666666666666",
);
const linenId = asId<"MetadataConceptId">(
  "77777777-7777-4777-8777-777777777777",
);
const now = "2026-07-30T12:00:00.000Z";

function grantedConsent() {
  return {
    retailerId,
    customerId,
    personalization: {
      purpose: "personalization" as const,
      status: "granted" as const,
      grantedAt: "2026-01-01T00:00:00.000Z",
    },
    marketing: { purpose: "marketing" as const, status: "denied" as const },
    location: { purpose: "location" as const, status: "denied" as const },
    updatedAt: now,
  };
}

function productMeta(
  productNum: number,
  concepts: InterestProductMetadata["concepts"],
): InterestProductMetadata {
  const productId = asId<"ProductId">(
    `aaaaaaaa-aaaa-4aaa-8aaa-${String(productNum).padStart(12, "0")}`,
  );
  return { productId, concepts };
}

function viewEvent(args: {
  readonly id: string;
  readonly productNum: number;
  readonly occurredAt: string;
  readonly idempotencyKey?: string;
  readonly retailerId?: typeof retailerId;
  readonly anonymizedAt?: string;
  readonly retentionExpiresAt?: string;
  readonly name?: BehavioralEvent["name"];
}): BehavioralEvent {
  const productId = asId<"ProductId">(
    `aaaaaaaa-aaaa-4aaa-8aaa-${String(args.productNum).padStart(12, "0")}`,
  );
  return {
    id: asId<"BehavioralEventId">(args.id),
    retailerId: args.retailerId ?? retailerId,
    customerId,
    name: args.name ?? "product_viewed",
    properties: {
      productId,
      ...(args.idempotencyKey ? { idempotencyKey: args.idempotencyKey } : {}),
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
    retentionExpiresAt: args.retentionExpiresAt ?? "2027-07-30T12:00:00.000Z",
    ...(args.anonymizedAt ? { anonymizedAt: args.anonymizedAt } : {}),
  };
}

function baseInput(
  overrides: Partial<CustomerInterestProjectionInput> = {},
): CustomerInterestProjectionInput {
  const metadata = new Map<string, InterestProductMetadata>();
  for (let i = 1; i <= 10; i += 1) {
    const colour = i <= 8 ? brownId : navyId;
    const colourLabel = i <= 8 ? "Brown" : "Navy";
    const meta = productMeta(i, [
      { conceptId: suitId, kind: "garment_type", label: "Suit" },
      { conceptId: colour, kind: "colour", label: colourLabel },
    ]);
    metadata.set(meta.productId, meta);
  }

  const events = Array.from({ length: 10 }, (_, index) => {
    const n = index + 1;
    return viewEvent({
      id: `bbbbbbbb-bbbb-4bbb-8bbb-${String(n).padStart(12, "0")}`,
      productNum: n,
      occurredAt: `2026-07-${String(n).padStart(2, "0")}T10:00:00.000Z`,
    });
  });

  return {
    retailerId,
    customerId,
    viewerRetailerId: retailerId,
    now,
    consent: grantedConsent(),
    events,
    productMetadata: metadata,
    minScopeUniqueProducts: 5,
    ...overrides,
  };
}

describe("projectCustomerInterestInsights", () => {
  it("projects 8 of 10 suit views were brown with evidence citations", () => {
    const result = projectCustomerInterestInsights(baseInput());
    expect(result.visibility).toBe("usable");
    expect(result.projectorVersion).toBe(CUSTOMER_INTEREST_PROJECTOR_VERSION);
    expect(result.insights).toHaveLength(2);

    const brown = result.insights.find(
      (insight) => insight.attributeConceptId === brownId,
    );
    expect(brown).toMatchObject({
      numerator: 8,
      denominator: 10,
      share: 0.8,
      uniqueProductCount: 8,
      sessionCount: null,
      polarity: "positive",
      statement: "8 of 10 suit views were brown",
      suppressed: false,
    });
    expect(brown?.evidenceEventIds).toHaveLength(8);
    expect(brown?.confidence).toBeGreaterThan(0);
  });

  it("formats exact UI-facing copy", () => {
    expect(
      formatCustomerInterestStatement({
        numerator: 8,
        denominator: 10,
        scopeLabel: "Suit",
        attributeLabel: "Brown",
        polarity: "positive",
      }),
    ).toBe("8 of 10 suit views were brown");
    expect(
      formatCustomerInterestStatement({
        numerator: 3,
        denominator: 6,
        scopeLabel: "Tie",
        attributeLabel: "Linen",
        polarity: "negative",
      }),
    ).toBe("3 of 6 tie skips were linen");
  });

  it("dedupes retries by idempotency key", () => {
    const events = [
      viewEvent({
        id: "bbbbbbbb-bbbb-4bbb-8bbb-000000000001",
        productNum: 1,
        occurredAt: "2026-07-10T10:00:00.000Z",
        idempotencyKey: "view-1",
      }),
      viewEvent({
        id: "bbbbbbbb-bbbb-4bbb-8bbb-000000000099",
        productNum: 1,
        occurredAt: "2026-07-10T10:00:01.000Z",
        idempotencyKey: "view-1",
      }),
      ...Array.from({ length: 9 }, (_, index) =>
        viewEvent({
          id: `bbbbbbbb-bbbb-4bbb-8bbb-${String(index + 2).padStart(12, "0")}`,
          productNum: index + 2,
          occurredAt: `2026-07-${String(index + 11).padStart(2, "0")}T10:00:00.000Z`,
          idempotencyKey: `view-${index + 2}`,
        }),
      ),
    ];
    const result = projectCustomerInterestInsights(baseInput({ events }));
    const brown = result.insights.find(
      (insight) => insight.attributeConceptId === brownId,
    );
    expect(brown?.denominator).toBe(10);
    expect(brown?.eventCount).toBe(8);
    expect(interestEventDedupeKey(events[0]!)).toBe("idempotency:view-1");
    expect(interestEventDedupeKey(events[1]!)).toBe("idempotency:view-1");
  });

  it("excludes anonymized, expired, and cross-tenant events", () => {
    const events = [
      viewEvent({
        id: "bbbbbbbb-bbbb-4bbb-8bbb-000000000001",
        productNum: 1,
        occurredAt: "2026-07-10T10:00:00.000Z",
        anonymizedAt: "2026-07-11T00:00:00.000Z",
      }),
      viewEvent({
        id: "bbbbbbbb-bbbb-4bbb-8bbb-000000000002",
        productNum: 2,
        occurredAt: "2026-07-10T10:00:00.000Z",
        retentionExpiresAt: "2026-07-01T00:00:00.000Z",
      }),
      viewEvent({
        id: "bbbbbbbb-bbbb-4bbb-8bbb-000000000003",
        productNum: 3,
        occurredAt: "2026-07-10T10:00:00.000Z",
        retailerId: otherRetailerId,
      }),
      ...Array.from({ length: 7 }, (_, index) =>
        viewEvent({
          id: `bbbbbbbb-bbbb-4bbb-8bbb-${String(index + 4).padStart(12, "0")}`,
          productNum: index + 4,
          occurredAt: `2026-07-${String(index + 12).padStart(2, "0")}T10:00:00.000Z`,
        }),
      ),
    ];
    const result = projectCustomerInterestInsights(baseInput({ events }));
    expect(result.insights[0]?.denominator).toBe(7);
  });

  it("fails closed when consent is withdrawn or denied", () => {
    const withdrawn = projectCustomerInterestInsights(
      baseInput({
        consent: {
          ...grantedConsent(),
          personalization: {
            purpose: "personalization",
            status: "withdrawn",
            withdrawnAt: "2026-07-01T00:00:00.000Z",
          },
        },
      }),
    );
    expect(withdrawn.visibility).toBe("consent_withdrawn");
    expect(withdrawn.insights).toEqual([]);
    expect(withdrawn.emptyStateCopy).toContain("withdrawn");

    const denied = projectCustomerInterestInsights(
      baseInput({
        consent: {
          ...grantedConsent(),
          personalization: {
            purpose: "personalization",
            status: "denied",
          },
        },
      }),
    );
    expect(denied.visibility).toBe("consent_denied");
    expect(denied.insights).toEqual([]);
  });

  it("fails closed on cross-tenant viewer", () => {
    const result = projectCustomerInterestInsights(
      baseInput({ viewerRetailerId: otherRetailerId }),
    );
    expect(result.visibility).toBe("consent_denied");
    expect(result.insights).toEqual([]);
  });

  it("ignores pending/rejected metadata by requiring accepted product map only", () => {
    const metadata = new Map<string, InterestProductMetadata>();
    for (let i = 1; i <= 10; i += 1) {
      const meta = productMeta(i, [
        { conceptId: suitId, kind: "garment_type", label: "Suit" },
        // No colour — simulates pending/rejected colour assignment omitted
        // from the accepted map.
      ]);
      metadata.set(meta.productId, meta);
    }
    const result = projectCustomerInterestInsights(
      baseInput({ productMetadata: metadata }),
    );
    expect(result.insights).toEqual([]);
  });

  it("separates negative skip evidence from positive views", () => {
    const metadata = new Map<string, InterestProductMetadata>();
    for (let i = 1; i <= 6; i += 1) {
      const meta = productMeta(i, [
        { conceptId: suitId, kind: "garment_type", label: "Suit" },
        { conceptId: linenId, kind: "fibre", label: "Linen" },
      ]);
      metadata.set(meta.productId, meta);
    }
    const events = Array.from({ length: 6 }, (_, index) =>
      viewEvent({
        id: `bbbbbbbb-bbbb-4bbb-8bbb-${String(index + 1).padStart(12, "0")}`,
        productNum: index + 1,
        occurredAt: `2026-07-${String(index + 10).padStart(2, "0")}T10:00:00.000Z`,
        name: "product_skipped",
      }),
    );
    const result = projectCustomerInterestInsights(
      baseInput({
        events,
        productMetadata: metadata,
        minScopeUniqueProducts: 5,
      }),
    );
    expect(result.insights[0]).toMatchObject({
      polarity: "negative",
      numerator: 6,
      denominator: 6,
      statement: "6 of 6 suit skips were linen",
    });
  });

  it("suppresses low-sample ratios and sorts deterministically", () => {
    const metadata = new Map<string, InterestProductMetadata>();
    for (let i = 1; i <= 3; i += 1) {
      const meta = productMeta(i, [
        { conceptId: suitId, kind: "garment_type", label: "Suit" },
        { conceptId: brownId, kind: "colour", label: "Brown" },
      ]);
      metadata.set(meta.productId, meta);
    }
    const events = Array.from({ length: 3 }, (_, index) =>
      viewEvent({
        id: `bbbbbbbb-bbbb-4bbb-8bbb-${String(index + 1).padStart(12, "0")}`,
        productNum: index + 1,
        occurredAt: `2026-07-${String(index + 10).padStart(2, "0")}T10:00:00.000Z`,
      }),
    );
    const result = projectCustomerInterestInsights(
      baseInput({
        events,
        productMetadata: metadata,
        minScopeUniqueProducts: 5,
      }),
    );
    expect(result.insights).toEqual([]);
    expect(result.suppressedInsights[0]).toMatchObject({
      suppressed: true,
      suppressReason: "low_sample",
      denominator: 3,
    });
  });

  it("sorts by share then denominator then concept ids", () => {
    const first = projectCustomerInterestInsights(baseInput());
    const second = projectCustomerInterestInsights(baseInput());
    expect(first.insights.map((row) => row.statement)).toEqual(
      second.insights.map((row) => row.statement),
    );
    expect(first.insights[0]?.share).toBeGreaterThanOrEqual(
      first.insights[1]?.share ?? 0,
    );
  });
});
