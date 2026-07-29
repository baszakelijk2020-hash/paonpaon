import { asId } from "@paon/domain";
import { describe, expect, it } from "vitest";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import { StyleProfileRepository } from "./style-profile-repository";
import { fakeQueryBuilder } from "./test-helpers/fake-query-builder";

type ProfileRow =
  Database["public"]["Tables"]["customer_style_profiles"]["Row"];

const retailerId = asId<"RetailerId">("11111111-1111-1111-1111-111111111111");
const customerId = asId<"CustomerId">("44444444-4444-4444-4444-444444444444");
const conceptId = asId<"MetadataConceptId">(
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
);

const profileRow: ProfileRow = {
  id: "55555555-5555-5555-5555-555555555555",
  retailer_id: retailerId,
  customer_id: customerId,
  explicit_preferences: [
    {
      conceptId,
      polarity: "positive",
      declaredAt: "2026-07-01T00:00:00.000Z",
    },
  ],
  inferred_preferences: [
    {
      conceptId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      score: 0.8,
      confidence: 0.75,
      polarity: "positive",
      evidenceCount: 2,
      lastEvidenceAt: "2026-07-20T00:00:00.000Z",
      factors: [
        {
          code: "evidence_contribution",
          delta: 0.8,
          detail: "positive evidence",
        },
      ],
    },
  ],
  recomputed_at: "2026-07-29T00:00:00.000Z",
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-29T00:00:00.000Z",
};

function clientReturning(result: {
  data: unknown;
  error: unknown;
}): PaonSupabaseClient {
  return {
    from: () => fakeQueryBuilder(result as never),
  } as unknown as PaonSupabaseClient;
}

describe("StyleProfileRepository", () => {
  it("maps explicit and inferred preferences separately", async () => {
    const repo = new StyleProfileRepository(
      clientReturning({ data: profileRow, error: null }),
    );
    const profile = await repo.findByCustomer(retailerId, customerId);
    expect(profile?.explicitPreferences).toHaveLength(1);
    expect(profile?.explicitPreferences[0]?.conceptId).toBe(conceptId);
    expect(profile?.inferredPreferences).toHaveLength(1);
    expect(profile?.inferredPreferences[0]?.factors[0]?.code).toBe(
      "evidence_contribution",
    );
  });

  it("returns null when no profile exists yet", async () => {
    const repo = new StyleProfileRepository(
      clientReturning({ data: null, error: null }),
    );
    expect(await repo.findByCustomer(retailerId, customerId)).toBeNull();
  });
});
