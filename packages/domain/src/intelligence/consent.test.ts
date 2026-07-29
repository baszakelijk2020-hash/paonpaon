import { describe, expect, it } from "vitest";

import { asId } from "../shared/branded-id";

import type { CustomerConsentRecord } from "./consent";
import {
  assessCaptureEligibility,
  buildConsentSnapshot,
  consentState,
  filterAdvisorVisibleEvents,
  isConsentGranted,
} from "./consent-rules";
import type { InteractionEvent } from "./interaction-event";
import {
  computeRetentionExpiresAt,
  computeWithdrawalRetentionDeadline,
  isRetentionExpired,
} from "./retention";

const retailerId = asId<"RetailerId">("11111111-1111-1111-1111-111111111111");
const customerId = asId<"CustomerId">("44444444-4444-4444-4444-444444444444");

function consentRecord(
  overrides: Partial<CustomerConsentRecord> = {},
): CustomerConsentRecord {
  return {
    retailerId,
    customerId,
    purpose: "personalization",
    grantedAt: "2026-07-01T00:00:00.000Z",
    withdrawnAt: null,
    retentionDeadlineAt: null,
    ...overrides,
  };
}

function interactionEvent(
  overrides: Partial<InteractionEvent> = {},
): InteractionEvent {
  return {
    retailerId,
    customerId,
    interactionType: "product_viewed",
    purpose: "personalization",
    consentSnapshot: {
      purpose: "personalization",
      granted: true,
      basis: "explicit_opt_in",
      recordedAt: "2026-07-01T00:00:00.000Z",
      version: 1,
    },
    retentionClass: "personalization_standard",
    retentionExpiresAt: "2028-07-01T00:00:00.000Z",
    properties: { productId: "p1" },
    occurredAt: "2026-07-15T00:00:00.000Z",
    source: "customer_portal",
    ...overrides,
  };
}

describe("consent state matrix", () => {
  it("treats missing records as never granted", () => {
    expect(consentState(null)).toBe("never_granted");
    expect(isConsentGranted(null)).toBe(false);
  });

  it("treats granted records without withdrawal as granted", () => {
    const record = consentRecord();
    expect(consentState(record)).toBe("granted");
    expect(isConsentGranted(record)).toBe(true);
  });

  it("treats withdrawn records as withdrawn even when granted_at remains", () => {
    const record = consentRecord({
      withdrawnAt: "2026-07-20T00:00:00.000Z",
      retentionDeadlineAt: "2026-10-18T00:00:00.000Z",
    });
    expect(consentState(record)).toBe("withdrawn");
    expect(isConsentGranted(record)).toBe(false);
  });

  it("builds snapshots that freeze capture-time consent", () => {
    const snapshot = buildConsentSnapshot(
      consentRecord(),
      "2026-07-15T12:00:00.000Z",
    );
    expect(snapshot).toEqual({
      purpose: "personalization",
      granted: true,
      basis: "explicit_opt_in",
      recordedAt: "2026-07-15T12:00:00.000Z",
      version: 1,
    });
  });
});

describe("capture eligibility", () => {
  it("allows capture when personalization consent is granted", () => {
    const result = assessCaptureEligibility({
      interactionType: "product_viewed",
      consentRecords: [consentRecord()],
      capturedAt: "2026-07-15T00:00:00.000Z",
    });
    expect(result.allowed).toBe(true);
    expect(result.consentSnapshot?.granted).toBe(true);
  });

  it("denies capture when consent was never granted", () => {
    const result = assessCaptureEligibility({
      interactionType: "search_performed",
      consentRecords: [],
      capturedAt: "2026-07-15T00:00:00.000Z",
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("required");
  });

  it("denies capture after withdrawal", () => {
    const result = assessCaptureEligibility({
      interactionType: "filter_applied",
      consentRecords: [
        consentRecord({
          withdrawnAt: "2026-07-14T00:00:00.000Z",
          retentionDeadlineAt: "2026-10-12T00:00:00.000Z",
        }),
      ],
      capturedAt: "2026-07-15T00:00:00.000Z",
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("withdrawn");
  });
});

describe("advisor visibility and retention", () => {
  it("hides anonymized or never-consented events", () => {
    const events = [
      interactionEvent(),
      interactionEvent({
        anonymizedAt: "2026-08-01T00:00:00.000Z",
      }),
      interactionEvent({
        consentSnapshot: {
          purpose: "personalization",
          granted: false,
          basis: "never_granted",
          recordedAt: "2026-07-01T00:00:00.000Z",
          version: 1,
        },
      }),
    ];
    const visible = filterAdvisorVisibleEvents(
      events,
      [consentRecord()],
      "2026-07-20T00:00:00.000Z",
    );
    expect(visible).toHaveLength(1);
    expect(visible[0]?.interactionType).toBe("product_viewed");
  });

  it("hides events after withdrawal retention deadline", () => {
    const withdrawnAt = "2026-07-01T00:00:00.000Z";
    const deadline = computeWithdrawalRetentionDeadline(withdrawnAt);
    const visible = filterAdvisorVisibleEvents(
      [interactionEvent()],
      [
        consentRecord({
          withdrawnAt,
          retentionDeadlineAt: deadline,
        }),
      ],
      new Date(new Date(deadline).getTime() + 1000).toISOString(),
    );
    expect(visible).toHaveLength(0);
  });

  it("expires retention on schedule", () => {
    const occurredAt = "2026-07-01T00:00:00.000Z";
    const expiresAt = computeRetentionExpiresAt(
      "personalization_standard",
      occurredAt,
    );
    expect(isRetentionExpired(expiresAt, "2026-06-01T00:00:00.000Z")).toBe(
      false,
    );
    expect(isRetentionExpired(expiresAt, "2028-08-01T00:00:00.000Z")).toBe(
      true,
    );
  });
});
