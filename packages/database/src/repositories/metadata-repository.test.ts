import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import { MetadataRepository } from "./metadata-repository";
import { fakeQueryBuilder } from "./test-helpers/fake-query-builder";

type MetadataConceptRow =
  Database["public"]["Tables"]["metadata_concepts"]["Row"];
type EntityMetadataAssignmentRow =
  Database["public"]["Tables"]["entity_metadata_assignments"]["Row"];

const retailerId = "11111111-1111-1111-1111-111111111111";
const conceptId = "22222222-2222-2222-2222-222222222222";
const productId = "33333333-3333-3333-3333-333333333333";
const staffId = "44444444-4444-4444-4444-444444444444";

const conceptRow: MetadataConceptRow = {
  id: conceptId,
  retailer_id: null,
  kind: "fibre",
  slug: "super-120s-wool",
  canonical_name: "Super 120s wool",
  attributes: { origin: "Australia" },
  image_url: "https://example.com/wool.jpg",
  active: true,
  created_at: "2026-07-29T00:00:00.000Z",
  updated_at: "2026-07-29T00:00:00.000Z",
  deleted_at: null,
};

const assignmentRow: EntityMetadataAssignmentRow = {
  id: "55555555-5555-5555-5555-555555555555",
  retailer_id: retailerId,
  target_type: "product",
  target_id: productId,
  concept_id: conceptId,
  source: "ai",
  confidence: 0.92,
  review_status: "accepted",
  supplier_value: null,
  evidence: {
    summary: "Supplier composition and product copy agree",
    sourceReference: "supplier-feed:42",
  },
  reviewed_by_staff_id: staffId,
  reviewed_at: "2026-07-29T01:00:00.000Z",
  created_at: "2026-07-29T00:00:00.000Z",
  updated_at: "2026-07-29T01:00:00.000Z",
  deleted_at: null,
};

describe("MetadataRepository", () => {
  it("maps canonical concepts and keeps an explicit tenant visibility filter", async () => {
    const or = vi.fn();
    const builder = fakeQueryBuilder({
      data: [conceptRow],
      error: null,
    });
    builder.or = (...args: Parameters<typeof or>) => {
      or(...args);
      return builder;
    };
    const repository = new MetadataRepository({
      from: () => builder,
    } as unknown as PaonSupabaseClient);

    const concepts = await repository.findVisibleConcepts(
      retailerId as never,
      "fibre",
    );

    expect(or).toHaveBeenCalledWith(
      `retailer_id.is.null,retailer_id.eq.${retailerId}`,
    );
    expect(concepts).toEqual([
      expect.objectContaining({
        id: conceptId,
        retailerId: null,
        canonicalName: "Super 120s wool",
        attributes: { origin: "Australia" },
      }),
    ]);
  });

  it("maps discriminated assignment targets and structured evidence", async () => {
    const repository = new MetadataRepository({
      from: () =>
        fakeQueryBuilder({
          data: [assignmentRow],
          error: null,
        }),
    } as unknown as PaonSupabaseClient);

    const assignments = await repository.findAssignmentsForTarget(
      retailerId as never,
      { targetType: "product", targetId: productId as never },
    );

    expect(assignments).toEqual([
      expect.objectContaining({
        target: { targetType: "product", targetId: productId },
        source: "ai",
        confidence: 0.92,
        reviewStatus: "accepted",
        evidence: {
          summary: "Supplier composition and product copy agree",
          sourceReference: "supplier-feed:42",
        },
        reviewedByStaffId: staffId,
      }),
    ]);
  });

  it("serializes assignment evidence to database JSON without widening types", async () => {
    const insert = vi.fn();
    const builder = fakeQueryBuilder({
      data: assignmentRow,
      error: null,
    });
    builder.insert = (...args: Parameters<typeof insert>) => {
      insert(...args);
      return builder;
    };
    const repository = new MetadataRepository({
      from: () => builder,
    } as unknown as PaonSupabaseClient);

    await repository.createAssignment({
      retailerId: retailerId as never,
      target: { targetType: "product", targetId: productId as never },
      conceptId: conceptId as never,
      source: "ai",
      confidence: 0.92,
      evidence: {
        summary: "Supplier composition and product copy agree",
        sourceReference: "supplier-feed:42",
      },
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        retailer_id: retailerId,
        target_type: "product",
        target_id: productId,
        concept_id: conceptId,
        evidence: {
          summary: "Supplier composition and product copy agree",
          sourceReference: "supplier-feed:42",
        },
      }),
    );
  });

  it("rejects malformed persisted evidence instead of leaking invalid domain data", async () => {
    const repository = new MetadataRepository({
      from: () =>
        fakeQueryBuilder({
          data: [{ ...assignmentRow, evidence: { summary: "" } }],
          error: null,
        }),
    } as unknown as PaonSupabaseClient);

    await expect(
      repository.findAssignmentsForTarget(retailerId as never, {
        targetType: "product",
        targetId: productId as never,
      }),
    ).rejects.toThrow();
  });
});
