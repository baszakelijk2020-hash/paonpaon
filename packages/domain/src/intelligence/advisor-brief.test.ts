import { describe, expect, it } from "vitest";

import { CONVERSATION_INTENT_LABELS } from "../engagement/messaging";
import { asId } from "../shared/branded-id";

import {
  advisorBriefPersonalizationStatus,
  buildAdvisorPreparationBrief,
  filterAdvisorVisibleEvents,
  type AdvisorBriefBuildInput,
} from "./advisor-brief";
import type { CustomerConsentState } from "./consent";
import type { BehavioralEvent } from "./interaction-event";
import type { StylePreferenceEvidence } from "./style-profile";

const retailerId = asId<"RetailerId">("11111111-1111-1111-1111-111111111111");
const customerId = asId<"CustomerId">("44444444-4444-4444-4444-444444444444");
const conceptId = asId<"MetadataConceptId">(
  "22222222-2222-2222-2222-222222222222",
);

function consentState(
  status: CustomerConsentState["personalization"]["status"],
): CustomerConsentState {
  return {
    retailerId,
    customerId,
    personalization: { purpose: "personalization", status },
    marketing: { purpose: "marketing", status: "denied" },
    location: { purpose: "location", status: "denied" },
    updatedAt: "2026-07-01T00:00:00.000Z",
  };
}

function event(
  overrides: Partial<BehavioralEvent> & Pick<BehavioralEvent, "name">,
): BehavioralEvent {
  return {
    retailerId,
    customerId,
    name: overrides.name,
    properties: overrides.properties ?? {},
    occurredAt: overrides.occurredAt ?? "2026-07-28T12:00:00.000Z",
    source: "customer_portal",
    purpose: "personalization",
    consentBasis: "explicit_opt_in",
    consentSnapshot: {
      personalization: "granted",
      marketing: "denied",
      location: "denied",
      capturedAt: "2026-07-28T12:00:00.000Z",
      basis: "explicit_opt_in",
    },
    retentionClass: "personalization_signal",
    retentionExpiresAt: "2027-07-28T12:00:00.000Z",
    ...overrides,
  };
}

function baseInput(
  overrides?: Partial<AdvisorBriefBuildInput>,
): AdvisorBriefBuildInput {
  return {
    retailerId,
    customerId,
    now: "2026-07-29T12:00:00.000Z",
    consent: consentState("granted"),
    events: [],
    profile: null,
    evidence: [],
    conceptLabels: { [conceptId]: "Navy wool" },
    productNames: { "product-1": "Blue chalk stripe suit" },
    knowledgeTitles: { "knowledge-1": "Understanding Super 120s" },
    shortlistItems: [],
    customerMessages: [],
    staffMessages: [],
    ...overrides,
  };
}

describe("advisor brief personalization gate", () => {
  it("maps consent states to brief availability", () => {
    expect(advisorBriefPersonalizationStatus(consentState("granted"))).toBe(
      "available",
    );
    expect(advisorBriefPersonalizationStatus(consentState("denied"))).toBe(
      "consent_denied",
    );
    expect(
      advisorBriefPersonalizationStatus(consentState("withdrawn")),
    ).toBe("consent_withdrawn");
  });

  it("withholds personalization slices when consent is withdrawn", () => {
    const brief = buildAdvisorPreparationBrief(
      baseInput({
        consent: consentState("withdrawn"),
        events: [
          event({
            name: "product_viewed",
            properties: { productId: "product-1" },
          }),
        ],
        shortlistItems: [
          {
            productId: "product-1",
            productName: "Blue chalk stripe suit",
            savedAt: "2026-07-28T12:00:00.000Z",
            source: "wishlist",
          },
        ],
        profile: {
          id: asId("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
          retailerId,
          customerId,
          explicitPreferences: [],
          inferredPreferences: [],
          confidence: {
            overall: 0,
            inferredCount: 0,
            explicitCount: 0,
            activeEvidenceCount: 0,
          },
          createdAt: "2026-07-01T00:00:00.000Z",
          updatedAt: "2026-07-01T00:00:00.000Z",
        },
      }),
    );

    expect(brief.personalizationStatus).toBe("consent_withdrawn");
    expect(brief.interests).toHaveLength(0);
    expect(brief.shortlist).toHaveLength(0);
    expect(brief.stylePreferences).toHaveLength(0);
    expect(brief.recentEvidence).toHaveLength(0);
  });

  it("filters cross-tenant, anonymized, and expired events", () => {
    const otherRetailer = asId<"RetailerId">(
      "99999999-9999-9999-9999-999999999999",
    );
    const visible = filterAdvisorVisibleEvents({
      advisorRetailerId: retailerId,
      personalizationConsent: "granted",
      now: "2026-07-29T12:00:00.000Z",
      events: [
        event({ name: "product_viewed" }),
        event({
          name: "search_performed",
          retailerId: otherRetailer,
        }),
        event({
          name: "filter_applied",
          anonymizedAt: "2026-07-20T00:00:00.000Z",
        }),
        event({
          name: "cart_updated",
          retentionExpiresAt: "2026-07-01T00:00:00.000Z",
        }),
      ],
    });

    expect(visible).toHaveLength(1);
    expect(visible[0]?.name).toBe("product_viewed");
  });
});

describe("advisor brief projection completeness", () => {
  it("projects interests, shortlist, knowledge, style, and questions with source detail", () => {
    const evidence: StylePreferenceEvidence[] = [
      {
        id: asId("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
        retailerId,
        customerId,
        conceptId,
        source: "product_favorited",
        polarity: "positive",
        confidence: 1,
        createdAt: "2026-07-27T10:00:00.000Z",
      },
    ];

    const brief = buildAdvisorPreparationBrief(
      baseInput({
        conversationIntent: "wedding",
        events: [
          event({
            name: "product_viewed",
            properties: { productId: "product-1" },
          }),
          event({
            name: "knowledge_opened",
            properties: { knowledgeObjectId: "knowledge-1" },
            occurredAt: "2026-07-27T11:00:00.000Z",
          }),
          event({
            name: "advisor_question",
            properties: { question: "What should I wear to a summer wedding?" },
            occurredAt: "2026-07-27T09:00:00.000Z",
          }),
        ],
        shortlistItems: [
          {
            productId: "product-1",
            productName: "Blue chalk stripe suit",
            savedAt: "2026-07-26T08:00:00.000Z",
            source: "wishlist",
          },
        ],
        profile: {
          id: asId("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
          retailerId,
          customerId,
          explicitPreferences: [
            {
              conceptId,
              polarity: "positive",
              updatedAt: "2026-07-20T00:00:00.000Z",
            },
          ],
          inferredPreferences: [],
          confidence: {
            overall: 0.4,
            inferredCount: 0,
            explicitCount: 1,
            activeEvidenceCount: 1,
          },
          createdAt: "2026-07-01T00:00:00.000Z",
          updatedAt: "2026-07-20T00:00:00.000Z",
        },
        evidence,
        customerMessages: [
          {
            body: "Can we look at lighter fabrics for August?",
            createdAt: "2026-07-25T15:00:00.000Z",
          },
        ],
      }),
    );

    expect(brief.occasion?.label).toBe(CONVERSATION_INTENT_LABELS.wedding);
    expect(brief.interests[0]?.detail).toBe("Blue chalk stripe suit");
    expect(brief.shortlist).toHaveLength(1);
    expect(brief.knowledge[0]?.title).toBe("Understanding Super 120s");
    expect(brief.stylePreferences[0]?.conceptLabel).toBe("Navy wool");
    expect(brief.recentEvidence[0]?.source).toBe("product_favorited");
    expect(brief.questions.some((q) => q.source === "message")).toBe(true);
    expect(brief.conversationContinuity[0]?.sender).toBe("customer");
    expect(brief.wardrobeGapsAvailable).toBe(false);
  });

  it("truncates long message previews without leaking raw prompt duplication", () => {
    const longBody = "Need advice? ".repeat(40);
    const brief = buildAdvisorPreparationBrief(
      baseInput({
        customerMessages: [{ body: longBody, createdAt: "2026-07-25T15:00:00.000Z" }],
      }),
    );

    expect(brief.conversationContinuity[0]?.body.endsWith("…")).toBe(true);
    expect(brief.conversationContinuity[0]?.body.length).toBeLessThanOrEqual(
      280,
    );
  });
});
