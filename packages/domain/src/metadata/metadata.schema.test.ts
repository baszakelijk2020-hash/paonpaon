import { describe, expect, it } from "vitest";

import {
  createEntityMetadataAssignmentInputSchema,
  createMetadataConceptEdgeInputSchema,
  createMetadataConceptInputSchema,
  createRetailerConceptOverrideInputSchema,
  METADATA_CONCEPT_KINDS,
  metadataTargetSchema,
  productFabricProfileSchema,
} from "./metadata.schema";

const retailerId = "00000000-0000-4000-8000-000000000001";
const conceptId = "00000000-0000-4000-8000-000000000002";
const secondConceptId = "00000000-0000-4000-8000-000000000003";
const targetId = "00000000-0000-4000-8000-000000000004";
const staffId = "00000000-0000-4000-8000-000000000005";

describe("metadata concept contracts", () => {
  it("contains every authorised catalogue concept kind", () => {
    expect(METADATA_CONCEPT_KINDS).toEqual(
      expect.arrayContaining([
        "mill",
        "fabric_collection",
        "fibre",
        "weave",
        "weight_band",
        "pattern",
        "colour",
        "season",
        "garment_type",
        "construction",
        "fit",
        "formality",
        "climate",
        "performance",
        "care",
        "style",
        "occasion",
        "compatibility",
        "collar",
        "silhouette",
      ]),
    );
  });

  it("normalizes a canonical concept and defaults safe fields", () => {
    expect(
      createMetadataConceptInputSchema.parse({
        kind: "weave",
        slug: "  Tropical-Weave  ",
        canonicalName: " Tropical weave ",
      }),
    ).toEqual({
      retailerId: null,
      kind: "weave",
      slug: "tropical-weave",
      canonicalName: "Tropical weave",
      attributes: {},
      active: true,
    });
  });

  it("rejects an unsupported kind, bad UUID, or invalid slug", () => {
    expect(
      createMetadataConceptInputSchema.safeParse({
        retailerId: "not-a-uuid",
        kind: "brand",
        slug: "Not a slug!",
        canonicalName: "Example",
      }).success,
    ).toBe(false);
  });

  it("rejects self-edges and excessive weight precision", () => {
    expect(
      createMetadataConceptEdgeInputSchema.safeParse({
        sourceConceptId: conceptId,
        targetConceptId: conceptId,
        kind: "related",
      }).success,
    ).toBe(false);
    expect(
      createMetadataConceptEdgeInputSchema.safeParse({
        sourceConceptId: conceptId,
        targetConceptId: secondConceptId,
        kind: "related",
        weight: 0.12345,
      }).success,
    ).toBe(false);
  });

  it("validates retailer override bounds", () => {
    expect(
      createRetailerConceptOverrideInputSchema.safeParse({
        retailerId,
        conceptId,
        priorityOverride: 1001,
      }).success,
    ).toBe(false);
  });
});

describe("metadata target and assignment contracts", () => {
  it.each(["product", "product_variant", "wardrobe_item"] as const)(
    "accepts a %s target with a UUID",
    (targetType) => {
      expect(
        metadataTargetSchema.parse({ targetType, targetId }),
      ).toStrictEqual({ targetType, targetId });
    },
  );

  it("rejects invalid target types and IDs", () => {
    expect(
      metadataTargetSchema.safeParse({
        targetType: "order",
        targetId: "not-a-uuid",
      }).success,
    ).toBe(false);
  });

  it("defaults a retailer proposal to pending", () => {
    const result = createEntityMetadataAssignmentInputSchema.parse({
      retailerId,
      target: { targetType: "product", targetId },
      conceptId,
      source: "retailer",
    });
    expect(result.reviewStatus).toBe("pending");
  });

  it("requires confidence and evidence for AI proposals", () => {
    const base = {
      retailerId,
      target: { targetType: "product", targetId },
      conceptId,
      source: "ai",
    };
    expect(
      createEntityMetadataAssignmentInputSchema.safeParse(base).success,
    ).toBe(false);
    expect(
      createEntityMetadataAssignmentInputSchema.safeParse({
        ...base,
        confidence: 0.875,
        evidence: {
          summary: "The supplier description says tropical weave.",
          sourceReference: "row-12",
        },
      }).success,
    ).toBe(true);
  });

  it("limits confidence precision", () => {
    expect(
      createEntityMetadataAssignmentInputSchema.safeParse({
        retailerId,
        target: { targetType: "product", targetId },
        conceptId,
        source: "ai",
        confidence: 0.12345,
        evidence: { summary: "Evidence" },
      }).success,
    ).toBe(false);
  });

  it("preserves a supplier assignment's raw value", () => {
    expect(
      createEntityMetadataAssignmentInputSchema.safeParse({
        retailerId,
        target: { targetType: "product", targetId },
        conceptId,
        source: "supplier",
      }).success,
    ).toBe(false);
    expect(
      createEntityMetadataAssignmentInputSchema.safeParse({
        retailerId,
        target: { targetType: "product", targetId },
        conceptId,
        source: "supplier",
        supplierValue: "Loro Piana Summertime",
      }).success,
    ).toBe(true);
  });

  it("forbids review data while pending", () => {
    expect(
      createEntityMetadataAssignmentInputSchema.safeParse({
        retailerId,
        target: { targetType: "product", targetId },
        conceptId,
        source: "retailer",
        reviewStatus: "pending",
        reviewedByStaffId: staffId,
        reviewedAt: "2026-07-30T10:00:00.000Z",
      }).success,
    ).toBe(false);
  });

  it.each(["accepted", "rejected"] as const)(
    "requires complete review provenance when %s",
    (reviewStatus) => {
      const base = {
        retailerId,
        target: { targetType: "product", targetId },
        conceptId,
        source: "retailer",
        reviewStatus,
      };
      expect(
        createEntityMetadataAssignmentInputSchema.safeParse(base).success,
      ).toBe(false);
      expect(
        createEntityMetadataAssignmentInputSchema.safeParse({
          ...base,
          reviewedByStaffId: staffId,
          reviewedAt: "2026-07-30T10:00:00.000Z",
        }).success,
      ).toBe(true);
    },
  );
});

describe("productFabricProfileSchema", () => {
  it("accepts exact composition totalling 100", () => {
    expect(
      productFabricProfileSchema.parse({
        fabricWeightGramsPerSquareMetre: 245.5,
        composition: [
          { fibreConceptId: conceptId, percentage: 52.5 },
          { fibreConceptId: secondConceptId, percentage: 47.5 },
        ],
        supplierReference: "SUMMERTIME-245",
      }),
    ).toEqual({
      fabricWeightGramsPerSquareMetre: 245.5,
      composition: [
        { fibreConceptId: conceptId, percentage: 52.5 },
        { fibreConceptId: secondConceptId, percentage: 47.5 },
      ],
      supplierReference: "SUMMERTIME-245",
    });
  });

  it("allows an unknown composition without pretending it totals 100", () => {
    expect(productFabricProfileSchema.parse({})).toEqual({
      composition: [],
    });
  });

  it("rejects totals below or above 100", () => {
    for (const percentage of [99.9999, 100.0001]) {
      expect(
        productFabricProfileSchema.safeParse({
          composition: [{ fibreConceptId: conceptId, percentage }],
        }).success,
      ).toBe(false);
    }
  });

  it("rejects duplicate fibres", () => {
    expect(
      productFabricProfileSchema.safeParse({
        composition: [
          { fibreConceptId: conceptId, percentage: 60 },
          { fibreConceptId: conceptId, percentage: 40 },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects excessive composition and weight precision", () => {
    expect(
      productFabricProfileSchema.safeParse({
        composition: [
          { fibreConceptId: conceptId, percentage: 50.00001 },
          { fibreConceptId: secondConceptId, percentage: 49.99999 },
        ],
      }).success,
    ).toBe(false);
    expect(
      productFabricProfileSchema.safeParse({
        fabricWeightGramsPerSquareMetre: 245.555,
      }).success,
    ).toBe(false);
  });
});
