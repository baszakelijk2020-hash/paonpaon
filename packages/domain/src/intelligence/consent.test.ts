import { describe, expect, it } from "vitest";

import { asId } from "../shared/branded-id";

import {
  buildConsentSnapshot,
  isAdvisorVisiblePersonalizationEvent,
  mayCapturePersonalizationForCustomer,
  mayLinkAnonymousSessionToCustomer,
  mayPersistAnonymousInteraction,
  purposeConsentStatus,
  retentionExpiresAt,
  withdrawalEffect,
  type CustomerConsentState,
} from "./consent";
import { setCustomerConsentInputSchema } from "./consent.schema";
import {
  validateCaptureInteractionEvent,
  type CaptureInteractionEventInput,
} from "./interaction-event";

const retailerId = asId<"RetailerId">("11111111-1111-1111-1111-111111111111");
const customerId = asId<"CustomerId">("44444444-4444-4444-4444-444444444444");
const anonymousSessionId = asId<"AnonymousSessionId">(
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
);

function consentState(
  overrides?: Partial<{
    personalization: CustomerConsentState["personalization"];
    marketing: CustomerConsentState["marketing"];
    location: CustomerConsentState["location"];
  }>,
): CustomerConsentState {
  return {
    retailerId,
    customerId,
    personalization: overrides?.personalization ?? {
      purpose: "personalization",
      status: "granted",
      grantedAt: "2026-07-01T00:00:00.000Z",
    },
    marketing: overrides?.marketing ?? {
      purpose: "marketing",
      status: "denied",
    },
    location: overrides?.location ?? {
      purpose: "location",
      status: "denied",
    },
    updatedAt: "2026-07-01T00:00:00.000Z",
  };
}

describe("consent purposes stay separate", () => {
  it("derives status from opt-in and withdrawal independently", () => {
    expect(purposeConsentStatus({ optIn: true })).toBe("granted");
    expect(purposeConsentStatus({ optIn: false })).toBe("denied");
    expect(
      purposeConsentStatus({
        optIn: false,
        withdrawnAt: "2026-07-15T00:00:00.000Z",
      }),
    ).toBe("withdrawn");
  });

  it("snapshots all three purposes without collapsing them", () => {
    const snapshot = buildConsentSnapshot({
      state: consentState({
        marketing: {
          purpose: "marketing",
          status: "granted",
          grantedAt: "2026-07-01T00:00:00.000Z",
        },
      }),
      basis: "explicit_opt_in",
      capturedAt: "2026-07-30T00:00:00.000Z",
    });
    expect(snapshot.personalization).toBe("granted");
    expect(snapshot.marketing).toBe("granted");
    expect(snapshot.location).toBe("denied");
  });

  it("rejects personalization capture when withdrawn or denied", () => {
    expect(mayCapturePersonalizationForCustomer(consentState())).toBe(true);
    expect(
      mayCapturePersonalizationForCustomer(
        consentState({
          personalization: {
            purpose: "personalization",
            status: "withdrawn",
            withdrawnAt: "2026-07-20T00:00:00.000Z",
          },
        }),
      ),
    ).toBe(false);
    expect(
      mayCapturePersonalizationForCustomer(
        consentState({
          personalization: { purpose: "personalization", status: "denied" },
        }),
      ),
    ).toBe(false);
  });
});

describe("withdrawal and retention", () => {
  it("stops new use and anonymizes signals without erasing durable records", () => {
    expect(withdrawalEffect("personalization")).toEqual({
      stopNewUse: true,
      anonymizePersonalizationSignals: true,
      eraseDurableBusinessRecords: false,
    });
    expect(withdrawalEffect("marketing").anonymizePersonalizationSignals).toBe(
      false,
    );
  });

  it("computes retention expiry from occurredAt", () => {
    expect(
      retentionExpiresAt({
        occurredAt: "2026-01-01T00:00:00.000Z",
        retentionDays: 365,
      }),
    ).toBe("2027-01-01T00:00:00.000Z");
  });

  it("hides expired, anonymized, cross-tenant, or non-consented events from advisors", () => {
    expect(
      isAdvisorVisiblePersonalizationEvent({
        eventRetailerId: retailerId,
        advisorRetailerId: retailerId,
        customerId,
        retentionExpiresAt: "2027-01-01T00:00:00.000Z",
        now: "2026-07-30T00:00:00.000Z",
        personalizationConsent: "granted",
      }),
    ).toBe(true);

    expect(
      isAdvisorVisiblePersonalizationEvent({
        eventRetailerId: retailerId,
        advisorRetailerId: asId<"RetailerId">(
          "22222222-2222-2222-2222-222222222222",
        ),
        customerId,
        retentionExpiresAt: "2027-01-01T00:00:00.000Z",
        now: "2026-07-30T00:00:00.000Z",
        personalizationConsent: "granted",
      }),
    ).toBe(false);

    expect(
      isAdvisorVisiblePersonalizationEvent({
        eventRetailerId: retailerId,
        advisorRetailerId: retailerId,
        customerId,
        anonymizedAt: "2026-07-20T00:00:00.000Z",
        retentionExpiresAt: "2027-01-01T00:00:00.000Z",
        now: "2026-07-30T00:00:00.000Z",
        personalizationConsent: "granted",
      }),
    ).toBe(false);

    expect(
      isAdvisorVisiblePersonalizationEvent({
        eventRetailerId: retailerId,
        advisorRetailerId: retailerId,
        customerId,
        retentionExpiresAt: "2026-06-01T00:00:00.000Z",
        now: "2026-07-30T00:00:00.000Z",
        personalizationConsent: "granted",
      }),
    ).toBe(false);

    expect(
      isAdvisorVisiblePersonalizationEvent({
        eventRetailerId: retailerId,
        advisorRetailerId: retailerId,
        customerId,
        retentionExpiresAt: "2027-01-01T00:00:00.000Z",
        now: "2026-07-30T00:00:00.000Z",
        personalizationConsent: "withdrawn",
      }),
    ).toBe(false);
  });
});

describe("anonymous session rules", () => {
  it("blocks anonymous persistence until jurisdiction allows it", () => {
    expect(
      mayPersistAnonymousInteraction({
        jurisdictionAllowsAnonymous: false,
        basis: "legitimate_interest_anonymous",
      }),
    ).toBe(false);
    expect(
      mayPersistAnonymousInteraction({
        jurisdictionAllowsAnonymous: true,
        basis: "legitimate_interest_anonymous",
      }),
    ).toBe(true);
  });

  it("never allows retroactive anonymous-to-customer linking", () => {
    expect(mayLinkAnonymousSessionToCustomer()).toBe(false);
  });
});

describe("setCustomerConsentInputSchema", () => {
  it("accepts purpose-specific grant and withdrawal", () => {
    expect(
      setCustomerConsentInputSchema.parse({
        purpose: "personalization",
        status: "granted",
      }),
    ).toEqual({ purpose: "personalization", status: "granted" });
    expect(
      setCustomerConsentInputSchema.safeParse({
        purpose: "tracking",
        status: "granted",
      }).success,
    ).toBe(false);
  });
});

describe("validateCaptureInteractionEvent", () => {
  const baseSnapshot = buildConsentSnapshot({
    state: consentState(),
    basis: "explicit_opt_in",
    capturedAt: "2026-07-30T12:00:00.000Z",
  });

  function input(
    overrides: Partial<CaptureInteractionEventInput> = {},
  ): CaptureInteractionEventInput {
    return {
      retailerId,
      customerId,
      name: "product_viewed",
      properties: { productId: "p1" },
      occurredAt: "2026-07-30T12:00:00.000Z",
      source: "customer_portal",
      consentBasis: "explicit_opt_in",
      consentSnapshot: baseSnapshot,
      ...overrides,
    };
  }

  it("accepts a consented signed-in personalization event", () => {
    const result = validateCaptureInteractionEvent(input());
    expect(result.ok).toBe(true);
    expect(result.event?.purpose).toBe("personalization");
    expect(result.event?.retentionExpiresAt).toBe("2027-07-30T12:00:00.000Z");
  });

  it("fails closed without personalization consent", () => {
    const result = validateCaptureInteractionEvent(
      input({
        consentSnapshot: {
          ...baseSnapshot,
          personalization: "denied",
        },
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("consent_required");
  });

  it("denies anonymous persistence by default and blocks linking", () => {
    const result = validateCaptureInteractionEvent(
      input({
        anonymousSessionId,
        consentBasis: "legitimate_interest_anonymous",
        consentSnapshot: {
          ...baseSnapshot,
          basis: "legitimate_interest_anonymous",
          personalization: "denied",
        },
      }),
    );
    // Still has customerId from base input → linking denial
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("anonymous_and_customer_together");
    expect(result.errors).toContain("anonymous_linking_denied");

    const anonymousOnly = validateCaptureInteractionEvent({
      retailerId,
      anonymousSessionId,
      name: "product_viewed",
      properties: { productId: "p1" },
      occurredAt: "2026-07-30T12:00:00.000Z",
      source: "customer_portal",
      consentBasis: "legitimate_interest_anonymous",
      consentSnapshot: {
        ...baseSnapshot,
        basis: "legitimate_interest_anonymous",
        personalization: "denied",
      },
    });
    expect(anonymousOnly.ok).toBe(false);
    expect(anonymousOnly.errors).toContain("anonymous_persistence_blocked");
  });

  it("rejects durable-record duplication payloads", () => {
    const result = validateCaptureInteractionEvent(
      input({ properties: { orderPayload: { id: "o1" } } }),
    );
    expect(result.errors).toContain("durable_record_duplication");
  });

  it("types every CUST-001 named interaction", () => {
    const names = [
      "product_viewed",
      "search_performed",
      "filter_applied",
      "product_favorited",
      "cart_updated",
      "knowledge_opened",
      "advisor_question",
      "appointment_intent",
      "conversion_recorded",
      "product_skipped",
      "category_browsed",
    ] as const;
    for (const name of names) {
      expect(validateCaptureInteractionEvent(input({ name })).ok).toBe(true);
    }
  });
});
