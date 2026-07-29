import { describe, expect, it } from "vitest";

import type { Message } from "../engagement/messaging";
import { asId } from "../shared/branded-id";

import {
  buildAdvisorPreparationBrief,
  buildPreparationSuggestions,
  isStaleAdvisorEvidence,
  mayProjectAdvisorBrief,
  resolveAdvisorBriefVisibility,
  type AdvisorBriefProjectionInput,
} from "./advisor-brief";
import type { CustomerConsentState } from "./consent";
import type { BehavioralEvent } from "./interaction-event";
import type {
  CustomerStyleProfile,
  StylePreferenceEvidence,
} from "./style-profile";

const retailerId = asId<"RetailerId">("11111111-1111-4111-8111-111111111111");
const otherRetailerId = asId<"RetailerId">(
  "22222222-2222-4222-8222-222222222222",
);
const customerId = asId<"CustomerId">("33333333-3333-4333-8333-333333333333");
const conceptId = asId<"MetadataConceptId">(
  "44444444-4444-4444-8444-444444444444",
);
const productId = asId<"ProductId">("55555555-5555-4555-8555-555555555555");
const variantId = asId<"ProductVariantId">(
  "66666666-6666-4666-8666-666666666666",
);
const knowledgeId = asId<"KnowledgeObjectId">(
  "77777777-7777-4777-8777-777777777777",
);
const conversationId = asId<"ConversationId">(
  "88888888-8888-4888-8888-888888888888",
);
const evidenceId = asId<"StylePreferenceEvidenceId">(
  "99999999-9999-4999-8999-999999999999",
);
const now = "2026-07-30T10:00:00.000Z";

function consent(
  status: CustomerConsentState["personalization"]["status"],
  overrides?: Partial<CustomerConsentState>,
): CustomerConsentState {
  return {
    retailerId,
    customerId,
    personalization: {
      purpose: "personalization",
      status,
      ...(status === "granted"
        ? { grantedAt: "2026-01-01T00:00:00.000Z" }
        : {}),
      ...(status === "withdrawn"
        ? { withdrawnAt: "2026-07-01T00:00:00.000Z" }
        : {}),
    },
    marketing: { purpose: "marketing", status: "denied" },
    location: { purpose: "location", status: "denied" },
    updatedAt: now,
    ...overrides,
  };
}

function event(
  overrides: Partial<BehavioralEvent> &
    Pick<BehavioralEvent, "name" | "properties">,
): BehavioralEvent {
  return {
    id: asId<"BehavioralEventId">("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
    retailerId,
    customerId,
    occurredAt: "2026-07-29T12:00:00.000Z",
    source: "customer_portal",
    purpose: "personalization",
    consentBasis: "explicit_opt_in",
    consentSnapshot: {
      personalization: "granted",
      marketing: "denied",
      location: "denied",
      capturedAt: "2026-07-29T12:00:00.000Z",
      basis: "explicit_opt_in",
    },
    retentionClass: "personalization_signal",
    retentionExpiresAt: "2027-07-29T12:00:00.000Z",
    ...overrides,
  };
}

function evidence(
  overrides?: Partial<StylePreferenceEvidence>,
): StylePreferenceEvidence {
  return {
    id: evidenceId,
    retailerId,
    customerId,
    conceptId,
    source: "product_favorited",
    polarity: "positive",
    confidence: 1,
    createdAt: "2026-07-20T00:00:00.000Z",
    ...overrides,
  };
}

function profile(): CustomerStyleProfile {
  return {
    id: asId<"CustomerStyleProfileId">("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
    retailerId,
    customerId,
    explicitPreferences: [
      {
        conceptId,
        polarity: "positive",
        note: "Summer wedding",
        updatedAt: "2026-07-15T00:00:00.000Z",
      },
    ],
    inferredPreferences: [],
    confidence: {
      overall: 0.8,
      inferredCount: 0,
      explicitCount: 1,
      activeEvidenceCount: 1,
    },
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-15T00:00:00.000Z",
  };
}

function message(overrides?: Partial<Message>): Message {
  return {
    id: asId<"MessageId">("cccccccc-cccc-4ccc-8ccc-cccccccccccc"),
    conversationId,
    senderType: "customer",
    body: "Do you have linen for a May wedding?",
    createdAt: "2026-07-28T09:00:00.000Z",
    updatedAt: "2026-07-28T09:00:00.000Z",
    ...overrides,
  };
}

function baseInput(
  overrides?: Partial<AdvisorBriefProjectionInput>,
): AdvisorBriefProjectionInput {
  return {
    retailerId,
    customerId,
    advisorRetailerId: retailerId,
    now,
    consent: consent("granted"),
    events: [
      event({
        name: "product_favorited",
        properties: { productId, productVariantId: variantId },
      }),
      event({
        name: "knowledge_opened",
        properties: { knowledgeObjectId: knowledgeId },
        occurredAt: "2026-07-28T11:00:00.000Z",
      }),
      event({
        name: "advisor_question",
        properties: { question: "Is fresco too warm for May?" },
        occurredAt: "2026-07-28T10:00:00.000Z",
      }),
    ],
    profile: profile(),
    evidence: [evidence()],
    conceptLabels: new Map([[conceptId, "Summer wedding"]]),
    productLabels: new Map([[productId, "Navy fresco jacket"]]),
    knowledgeLabels: new Map([[knowledgeId, "Fresco cloth explained"]]),
    wishlistItems: [
      {
        productVariantId: variantId,
        productId,
        label: "Navy fresco jacket / 50",
        addedAt: "2026-07-27T00:00:00.000Z",
      },
    ],
    conversationId,
    conversationIntent: "wedding",
    messages: [message()],
    appointmentNotes: "Looking for May garden wedding outfits",
    ...overrides,
  };
}

describe("resolveAdvisorBriefVisibility", () => {
  it("maps consent statuses", () => {
    expect(resolveAdvisorBriefVisibility("granted")).toBe("usable");
    expect(resolveAdvisorBriefVisibility("denied")).toBe("consent_denied");
    expect(resolveAdvisorBriefVisibility("withdrawn")).toBe(
      "consent_withdrawn",
    );
  });
});

describe("mayProjectAdvisorBrief", () => {
  it("allows same-retailer same-customer projection", () => {
    expect(
      mayProjectAdvisorBrief({
        retailerId,
        advisorRetailerId: retailerId,
        consentRetailerId: retailerId,
        consentCustomerId: customerId,
        customerId,
      }),
    ).toBe(true);
  });

  it("denies cross-tenant advisor reads", () => {
    expect(
      mayProjectAdvisorBrief({
        retailerId,
        advisorRetailerId: otherRetailerId,
        consentRetailerId: retailerId,
        consentCustomerId: customerId,
        customerId,
      }),
    ).toBe(false);
  });
});

describe("isStaleAdvisorEvidence", () => {
  it("flags suppressed and aged evidence", () => {
    expect(
      isStaleAdvisorEvidence({
        createdAt: "2026-01-01T00:00:00.000Z",
        now,
        staleAfterDays: 30,
      }),
    ).toBe(true);
    expect(
      isStaleAdvisorEvidence({
        createdAt: "2026-07-20T00:00:00.000Z",
        now,
        staleAfterDays: 30,
      }),
    ).toBe(false);
    expect(
      isStaleAdvisorEvidence({
        createdAt: "2026-07-20T00:00:00.000Z",
        now,
        suppressedAt: "2026-07-21T00:00:00.000Z",
      }),
    ).toBe(true);
  });
});

describe("buildAdvisorPreparationBrief", () => {
  it("projects consented interests, shortlist, knowledge, evidence, questions, and prep", () => {
    const brief = buildAdvisorPreparationBrief(baseInput());

    expect(brief.visibility).toBe("usable");
    expect(brief.likelyNeed?.summary).toContain("Summer wedding");
    expect(brief.occasion?.label).toBe("Summer wedding");
    expect(brief.interests.some((row) => row.label === "Summer wedding")).toBe(
      true,
    );
    expect(brief.savedProducts).toHaveLength(1);
    expect(brief.shortlist.some((row) => row.label.includes("fresco"))).toBe(
      true,
    );
    expect(brief.knowledgeConsumed[0]?.label).toBe("Fresco cloth explained");
    expect(brief.evidence[0]?.conceptLabel).toBe("Summer wedding");
    expect(brief.evidence[0]?.stale).toBe(false);
    expect(brief.questions.map((q) => q.body)).toEqual(
      expect.arrayContaining([
        "Do you have linen for a May wedding?",
        "Is fresco too warm for May?",
      ]),
    );
    expect(brief.wardrobeGaps).toEqual([]);
    expect(brief.wardrobeSelfReports).toEqual([]);
    expect(brief.conversation?.intent).toBe("wedding");
    expect(brief.preparationSuggestions.length).toBeGreaterThan(0);
    expect(JSON.stringify(brief)).not.toMatch(/@|phone|ssn|password/i);
  });

  it("fails closed when personalization is withdrawn", () => {
    const brief = buildAdvisorPreparationBrief(
      baseInput({ consent: consent("withdrawn") }),
    );

    expect(brief.visibility).toBe("consent_withdrawn");
    expect(brief.interests).toEqual([]);
    expect(brief.evidence).toEqual([]);
    expect(brief.shortlist).toEqual([]);
    expect(brief.knowledgeConsumed).toEqual([]);
    expect(brief.savedProducts).toEqual([]);
    expect(brief.questions).toEqual([]);
    expect(brief.conversation?.recentMessages).toHaveLength(1);
    expect(
      brief.preparationSuggestions.some(
        (row) => row.code === "start_from_relationship",
      ),
    ).toBe(true);
  });

  it("fails closed when personalization is denied", () => {
    const brief = buildAdvisorPreparationBrief(
      baseInput({ consent: consent("denied") }),
    );
    expect(brief.visibility).toBe("consent_denied");
    expect(brief.interests).toEqual([]);
    expect(brief.evidence).toEqual([]);
  });

  it("returns empty intelligence for cross-tenant advisor", () => {
    const brief = buildAdvisorPreparationBrief(
      baseInput({ advisorRetailerId: otherRetailerId }),
    );
    expect(brief.visibility).toBe("consent_denied");
    expect(brief.interests).toEqual([]);
    expect(brief.conversation).toBeUndefined();
  });

  it("excludes anonymized, expired, and cross-tenant events", () => {
    const brief = buildAdvisorPreparationBrief(
      baseInput({
        events: [
          event({
            name: "product_favorited",
            properties: { productId },
            anonymizedAt: "2026-07-29T13:00:00.000Z",
          }),
          event({
            name: "product_viewed",
            properties: { productId },
            retentionExpiresAt: "2026-07-01T00:00:00.000Z",
          }),
          event({
            name: "search_performed",
            properties: { query: "linen" },
            retailerId: otherRetailerId,
          }),
        ],
        wishlistItems: [],
        profile: null,
        evidence: [],
        messages: [],
      }),
    );

    expect(brief.interests).toEqual([]);
    expect(brief.shortlist).toEqual([]);
  });

  it("marks stale evidence and omits suppressed rows", () => {
    const brief = buildAdvisorPreparationBrief(
      baseInput({
        staleEvidenceAfterDays: 7,
        evidence: [
          evidence({ createdAt: "2026-01-01T00:00:00.000Z" }),
          evidence({
            id: asId<"StylePreferenceEvidenceId">(
              "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            ),
            suppressedAt: "2026-07-21T00:00:00.000Z",
            suppressedBy: "customer",
          }),
        ],
      }),
    );

    expect(brief.evidence).toHaveLength(1);
    expect(brief.evidence[0]?.stale).toBe(true);
  });

  it("handles empty consented state without inventing facts", () => {
    const brief = buildAdvisorPreparationBrief(
      baseInput({
        events: [],
        profile: null,
        evidence: [],
        wishlistItems: [],
        messages: [],
        appointmentNotes: "",
      }),
    );

    // Drop conversation fields by rebuilding without them.
    const empty = buildAdvisorPreparationBrief({
      retailerId,
      customerId,
      advisorRetailerId: retailerId,
      now,
      consent: consent("granted"),
      events: [],
      profile: null,
      evidence: [],
      conceptLabels: new Map(),
      productLabels: new Map(),
      knowledgeLabels: new Map(),
      wishlistItems: [],
      messages: [],
    });

    expect(brief.visibility).toBe("usable");
    expect(empty.likelyNeed).toBeUndefined();
    expect(empty.occasion).toBeUndefined();
    expect(empty.interests).toEqual([]);
    expect(empty.preparationSuggestions[0]?.code).toBe(
      "start_from_relationship",
    );
  });

  it("does not embed raw hidden PII fields in the projection", () => {
    const brief = buildAdvisorPreparationBrief(
      baseInput({
        events: [
          event({
            name: "search_performed",
            properties: {
              query: "navy jacket",
              email: "hidden@example.com",
              phone: "+31000000000",
            },
          }),
        ],
      }),
    );

    expect(JSON.stringify(brief)).not.toContain("hidden@example.com");
    expect(JSON.stringify(brief)).not.toContain("+31000000000");
  });
});

describe("buildPreparationSuggestions", () => {
  it("prioritises occasion, shortlist, and conversation continuity", () => {
    const suggestions = buildPreparationSuggestions({
      visibility: "usable",
      occasion: {
        label: "Summer wedding",
        source: "declared",
        occurredAt: now,
      },
      shortlistCount: 2,
      questionCount: 1,
      evidenceCount: 1,
      hasConversation: true,
      hasAppointmentNotes: true,
    });

    expect(suggestions.map((row) => row.code)).toEqual(
      expect.arrayContaining([
        "review_occasion",
        "pull_shortlist",
        "continue_conversation",
        "confirm_preferences",
        "open_appointment_request",
      ]),
    );
  });
});
