import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import { StyleProfileRepository } from "./style-profile-repository";
import { fakeQueryBuilder } from "./test-helpers/fake-query-builder";

type StyleProfileRow =
  Database["public"]["Tables"]["customer_style_profiles"]["Row"];
type StyleEvidenceRow =
  Database["public"]["Tables"]["customer_style_preference_evidence"]["Row"];

const profileRow: StyleProfileRow = {
  id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
  retailer_id: "11111111-1111-1111-1111-111111111111",
  customer_id: "44444444-4444-4444-4444-444444444444",
  explicit_preferences: [
    {
      conceptId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
      polarity: "positive",
      updatedAt: "2026-07-30T00:00:00.000Z",
    },
  ],
  inferred_preferences: [
    {
      conceptId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
      polarity: "positive",
      confidence: 0.8,
      evidenceIds: ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1"],
      lastEvidenceAt: "2026-07-30T00:00:00.000Z",
      score: 0.8,
      factors: [
        {
          code: "evidence_weight",
          delta: 0.8,
          detail: "product_favorited positive confidence=1",
        },
      ],
    },
  ],
  confidence: {
    overall: 0.8,
    inferredCount: 1,
    explicitCount: 1,
    activeEvidenceCount: 1,
  },
  recomputed_at: "2026-07-30T00:00:00.000Z",
  created_at: "2026-07-30T00:00:00.000Z",
  updated_at: "2026-07-30T00:00:00.000Z",
};

const evidenceRow: StyleEvidenceRow = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
  retailer_id: profileRow.retailer_id,
  customer_id: profileRow.customer_id,
  concept_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
  source_event_id: null,
  source: "product_favorited",
  polarity: "positive",
  confidence: 1,
  created_at: "2026-07-30T00:00:00.000Z",
  suppressed_at: null,
  suppressed_by: null,
  suppression_reason: null,
};

describe("StyleProfileRepository", () => {
  it("maps profile rows with separate explicit and inferred preferences", async () => {
    const repo = new StyleProfileRepository({
      from: () => fakeQueryBuilder({ data: profileRow, error: null }),
    } as unknown as PaonSupabaseClient);

    const profile = await repo.findByCustomer(
      profileRow.retailer_id as never,
      profileRow.customer_id as never,
    );

    expect(profile?.explicitPreferences).toHaveLength(1);
    expect(profile?.inferredPreferences).toHaveLength(1);
    expect(profile?.explicitPreferences[0]?.conceptId).toBe(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    );
    expect(profile?.inferredPreferences[0]?.confidence).toBe(0.8);
    expect(profile?.confidence.explicitCount).toBe(1);
  });

  it("lists active evidence and maps soft-suppression fields", async () => {
    const repo = new StyleProfileRepository({
      from: () => fakeQueryBuilder({ data: [evidenceRow], error: null }),
    } as unknown as PaonSupabaseClient);

    const rows = await repo.listEvidence(profileRow.customer_id as never);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.source).toBe("product_favorited");
    expect(rows[0]?.suppressedAt).toBeUndefined();
  });

  it("removes inferred preferences through the RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        ...profileRow,
        inferred_preferences: [],
        confidence: {
          overall: 0,
          inferredCount: 0,
          explicitCount: 1,
          activeEvidenceCount: 0,
        },
      },
      error: null,
    });
    const repo = new StyleProfileRepository({
      rpc,
    } as unknown as PaonSupabaseClient);

    const updated = await repo.removeInferred(profileRow.customer_id as never, {
      conceptId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
      reason: "Not my taste",
    });

    expect(rpc).toHaveBeenCalledWith("remove_inferred_style_preference", {
      p_customer_id: profileRow.customer_id,
      p_concept_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
      p_reason: "Not my taste",
    });
    expect(updated.inferredPreferences).toEqual([]);
  });

  it("recomputes deterministically and persists without touching explicit", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        ...profileRow,
        inferred_preferences: [
          {
            conceptId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
            polarity: "positive",
            confidence: 1,
            evidenceIds: [evidenceRow.id],
            lastEvidenceAt: evidenceRow.created_at,
            score: 1,
            factors: [
              {
                code: "evidence_weight",
                delta: 1,
                detail: "product_favorited positive confidence=1",
              },
            ],
          },
        ],
        confidence: {
          overall: 1,
          inferredCount: 1,
          explicitCount: 1,
          activeEvidenceCount: 1,
        },
        recomputed_at: "2026-07-30T12:00:00.000Z",
      },
      error: null,
    });

    const from = vi.fn((table: string) => {
      if (table === "customer_style_profiles") {
        return fakeQueryBuilder({ data: profileRow, error: null });
      }
      return fakeQueryBuilder({ data: [evidenceRow], error: null });
    });

    const repo = new StyleProfileRepository({
      from,
      rpc,
    } as unknown as PaonSupabaseClient);

    const profile = await repo.recompute(
      profileRow.retailer_id as never,
      profileRow.customer_id as never,
      "2026-07-30T12:00:00.000Z",
    );

    expect(rpc).toHaveBeenCalledWith(
      "persist_style_profile_recompute",
      expect.objectContaining({
        p_customer_id: profileRow.customer_id,
        p_recomputed_at: "2026-07-30T12:00:00.000Z",
      }),
    );
    const persistArgs = rpc.mock.calls[0]?.[1] as {
      p_inferred_preferences: unknown[];
      p_confidence: { explicitCount: number };
    };
    expect(persistArgs.p_confidence.explicitCount).toBe(1);
    expect(profile.explicitPreferences).toHaveLength(1);
    expect(profile.inferredPreferences[0]?.polarity).toBe("positive");
  });
});
