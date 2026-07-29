import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";

import { AdvisorBriefRepository } from "./advisor-brief-repository";

const retailerId = "11111111-1111-1111-1111-111111111111";
const customerId = "44444444-4444-4444-4444-444444444444";

describe("AdvisorBriefRepository", () => {
  it("returns a consent-gated brief with durable conversation context", async () => {
    const consentState = {
      retailerId,
      customerId,
      personalization: { purpose: "personalization", status: "granted" },
      marketing: { purpose: "marketing", status: "denied" },
      location: { purpose: "location", status: "denied" },
      updatedAt: "2026-07-01T00:00:00.000Z",
    };

    const client = {} as PaonSupabaseClient;
    const repository = new AdvisorBriefRepository(client);

    vi.spyOn(
      (
        await import("./customer-consent-repository")
      ).CustomerConsentRepository.prototype,
      "getState",
    ).mockResolvedValue(consentState as never);

    vi.spyOn(
      (
        await import("./analytics-repository")
      ).AnalyticsRepository.prototype,
      "findRecentByCustomer",
    ).mockResolvedValue([
      {
        retailerId,
        customerId,
        name: "product_viewed",
        properties: { productId: "product-1" },
        occurredAt: "2026-07-28T12:00:00.000Z",
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
      },
    ] as never);

    vi.spyOn(
      (
        await import("./style-profile-repository")
      ).StyleProfileRepository.prototype,
      "findByCustomer",
    ).mockResolvedValue(null);

    vi.spyOn(
      (
        await import("./style-profile-repository")
      ).StyleProfileRepository.prototype,
      "listEvidence",
    ).mockResolvedValue([]);

    vi.spyOn(
      (
        await import("./customer-preferences-repository")
      ).CustomerPreferencesRepository.prototype,
      "findByCustomer",
    ).mockResolvedValue(null);

    vi.spyOn(
      (
        await import("./messaging-repository")
      ).MessagingRepository.prototype,
      "findByCustomer",
    ).mockResolvedValue({
      id: "conv-1",
      retailerId,
      customerId,
      intent: "wedding",
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
      deletedAt: null,
    } as never);

    vi.spyOn(
      (
        await import("./messaging-repository")
      ).MessagingRepository.prototype,
      "findMessages",
    ).mockResolvedValue([
      {
        id: "msg-1",
        conversationId: "conv-1",
        senderType: "customer",
        body: "Looking for wedding attire guidance.",
        createdAt: "2026-07-25T10:00:00.000Z",
        updatedAt: "2026-07-25T10:00:00.000Z",
        deletedAt: null,
      },
    ] as never);

    vi.spyOn(
      (
        await import("./wishlist-repository")
      ).WishlistRepository.prototype,
      "findByCustomer",
    ).mockResolvedValue(null);

    vi.spyOn(
      (
        await import("./product-repository")
      ).ProductRepository.prototype,
      "findById",
    ).mockResolvedValue({
      id: "product-1",
      name: "Blue chalk stripe suit",
    } as never);

    const brief = await repository.loadForCustomer({
      retailerId: retailerId as never,
      customerId: customerId as never,
      now: "2026-07-29T12:00:00.000Z",
    });

    expect(brief.personalizationStatus).toBe("available");
    expect(brief.occasion?.label).toBe("Wedding");
    expect(brief.interests[0]?.detail).toBe("Blue chalk stripe suit");
    expect(brief.conversationContinuity[0]?.sender).toBe("customer");
  });
});
