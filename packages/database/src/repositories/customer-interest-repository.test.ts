import { asId, type CustomerInterestProjection } from "@paon/domain";
import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import { CustomerInterestRepository } from "./customer-interest-repository";
import { fakeQueryBuilder } from "./test-helpers/fake-query-builder";

type AssignmentRow =
  Database["public"]["Tables"]["entity_metadata_assignments"]["Row"];
type ConceptRow = Database["public"]["Tables"]["metadata_concepts"]["Row"];

const retailerId = asId<"RetailerId">("11111111-1111-4111-8111-111111111111");
const otherRetailerId = asId<"RetailerId">(
  "22222222-2222-4222-8222-222222222222",
);
const customerId = asId<"CustomerId">("33333333-3333-4333-8333-333333333333");
const suitId = "44444444-4444-4444-8444-444444444444";
const brownId = "55555555-5555-4555-8555-555555555555";
const pendingColourId = "66666666-6666-4666-8666-666666666666";
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

function productId(n: number): string {
  return `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, "0")}`;
}

function eventId(n: number): string {
  return `bbbbbbbb-bbbb-4bbb-8bbb-${String(n).padStart(12, "0")}`;
}

function viewEvent(n: number) {
  return {
    id: asId<"BehavioralEventId">(eventId(n)),
    retailerId,
    customerId,
    name: "product_viewed" as const,
    properties: { productId: productId(n) },
    occurredAt: `2026-07-${String(n).padStart(2, "0")}T10:00:00.000Z`,
    source: "customer_portal" as const,
    purpose: "personalization" as const,
    consentBasis: "explicit_opt_in" as const,
    consentSnapshot: {
      personalization: "granted" as const,
      marketing: "denied" as const,
      location: "denied" as const,
      capturedAt: now,
      basis: "explicit_opt_in" as const,
    },
    retentionClass: "personalization_signal" as const,
    retentionExpiresAt: "2027-07-30T12:00:00.000Z",
  };
}

function assignment(
  id: string,
  product: string,
  conceptId: string,
  reviewStatus: AssignmentRow["review_status"],
): AssignmentRow {
  return {
    id,
    retailer_id: retailerId,
    target_type: "product",
    target_id: product,
    concept_id: conceptId,
    source: "retailer",
    confidence: 1,
    evidence: { summary: "fixture" },
    review_status: reviewStatus,
    supplier_value: null,
    reviewed_by_staff_id: null,
    reviewed_at: now,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
}

function concept(
  id: string,
  kind: ConceptRow["kind"],
  name: string,
): ConceptRow {
  return {
    id,
    retailer_id: null,
    kind,
    slug: name.toLowerCase(),
    canonical_name: name,
    attributes: {},
    image_url: null,
    active: true,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
}

function clientWith(tables: Record<string, unknown>): PaonSupabaseClient {
  return {
    from: (table: string) =>
      fakeQueryBuilder({
        data: tables[table] ?? [],
        error: null,
      }),
  } as unknown as PaonSupabaseClient;
}

describe("CustomerInterestRepository", () => {
  it("projects cited interests from tenant events and accepted metadata only", async () => {
    const assignments: AssignmentRow[] = [];
    for (let n = 1; n <= 10; n += 1) {
      assignments.push(
        assignment(
          `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
          productId(n),
          suitId,
          "accepted",
        ),
        assignment(
          `30000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
          productId(n),
          n <= 8 ? brownId : pendingColourId,
          n <= 8 ? "accepted" : "pending",
        ),
      );
    }

    const deps = {
      consent: { getState: vi.fn().mockResolvedValue(grantedConsent()) },
      analytics: {
        findRecentByCustomer: vi
          .fn()
          .mockResolvedValue(
            Array.from({ length: 10 }, (_, i) => viewEvent(i + 1)),
          ),
      },
    };

    const repo = new CustomerInterestRepository(
      clientWith({
        entity_metadata_assignments: assignments,
        product_variants: [],
        metadata_concepts: [
          concept(suitId, "garment_type", "Suit"),
          concept(brownId, "colour", "Brown"),
          concept(pendingColourId, "colour", "Pending Colour"),
        ],
      }),
      deps as never,
    );

    const projection: CustomerInterestProjection =
      await repo.projectForCustomer({
        retailerId,
        customerId,
        viewerRetailerId: retailerId,
        now,
      });

    expect(deps.analytics.findRecentByCustomer).toHaveBeenCalledWith(
      retailerId,
      customerId,
      200,
    );
    expect(projection.visibility).toBe("usable");
    expect(projection.insights[0]).toMatchObject({
      statement: "8 of 10 suit views were brown",
      numerator: 8,
      denominator: 10,
      sessionCount: null,
    });
    expect(JSON.stringify(projection.insights)).not.toContain("Pending Colour");
  });

  it("fails closed when consent is withdrawn", async () => {
    const repo = new CustomerInterestRepository(
      clientWith({
        entity_metadata_assignments: [],
        product_variants: [],
        metadata_concepts: [],
      }),
      {
        consent: {
          getState: vi.fn().mockResolvedValue({
            ...grantedConsent(),
            personalization: {
              purpose: "personalization",
              status: "withdrawn",
              withdrawnAt: "2026-07-01T00:00:00.000Z",
            },
          }),
        },
        analytics: {
          findRecentByCustomer: vi.fn().mockResolvedValue([viewEvent(1)]),
        },
      } as never,
    );

    const projection = await repo.projectForCustomer({
      retailerId,
      customerId,
      viewerRetailerId: retailerId,
      now,
    });

    expect(projection.visibility).toBe("consent_withdrawn");
    expect(projection.insights).toEqual([]);
  });

  it("fails closed for cross-tenant viewers", async () => {
    const repo = new CustomerInterestRepository(
      clientWith({
        entity_metadata_assignments: [],
        product_variants: [],
        metadata_concepts: [],
      }),
      {
        consent: { getState: vi.fn().mockResolvedValue(grantedConsent()) },
        analytics: {
          findRecentByCustomer: vi.fn().mockResolvedValue([viewEvent(1)]),
        },
      } as never,
    );

    const projection = await repo.projectForCustomer({
      retailerId,
      customerId,
      viewerRetailerId: otherRetailerId,
      now,
    });

    expect(projection.visibility).toBe("consent_denied");
    expect(projection.insights).toEqual([]);
  });

  it("scopes assignment reads to the retailer", async () => {
    const eq = vi.fn();
    const builder = fakeQueryBuilder({ data: [], error: null });
    builder.eq = (...args: Parameters<typeof eq>) => {
      eq(...args);
      return builder;
    };
    const from = vi.fn(() => builder);
    const repo = new CustomerInterestRepository(
      { from } as unknown as PaonSupabaseClient,
      {
        consent: { getState: vi.fn().mockResolvedValue(grantedConsent()) },
        analytics: {
          findRecentByCustomer: vi.fn().mockResolvedValue([viewEvent(1)]),
        },
      } as never,
    );

    await repo.projectForCustomer({
      retailerId,
      customerId,
      viewerRetailerId: retailerId,
      now,
    });

    expect(eq).toHaveBeenCalledWith("retailer_id", retailerId);
    expect(eq).not.toHaveBeenCalledWith("retailer_id", otherRetailerId);
  });
});
