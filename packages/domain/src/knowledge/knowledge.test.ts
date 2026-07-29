import { describe, expect, expectTypeOf, it } from "vitest";

import {
  asId,
  type KnowledgeObjectId,
  type MetadataConceptId,
} from "../shared/branded-id";

import {
  isKnowledgeObjectConceptTenantCompatible,
  isKnowledgeObjectEligible,
  isKnowledgeObjectRelationTenantCompatible,
  isKnowledgeOverrideTenantCompatible,
  resolveEffectiveKnowledgePresentation,
  type KnowledgeObject,
  type RetailerKnowledgeOverride,
} from "./knowledge";

const retailerA = asId<"RetailerId">("00000000-0000-4000-8000-000000000001");
const retailerB = asId<"RetailerId">("00000000-0000-4000-8000-000000000002");
const knowledgeObjectId = asId<"KnowledgeObjectId">(
  "00000000-0000-4000-8000-000000000010",
);

const canonicalObject: KnowledgeObject = {
  id: knowledgeObjectId,
  retailerId: null,
  title: "Understanding Hopsack",
  slug: "understanding-hopsack",
  summary: "Why hopsack weave breathes in warm weather.",
  body: "Hopsack is an open basket weave that improves airflow.",
  imageUrl: "https://example.com/hopsack.jpg",
  displayTypes: ["information_card"],
  commercialIntent: "educate",
  educationTopic: "weaves",
  priority: 10,
  active: true,
  createdAt: "2026-07-30T00:00:00.000Z",
  updatedAt: "2026-07-30T00:00:00.000Z",
};

const override: RetailerKnowledgeOverride = {
  id: asId<"RetailerKnowledgeOverrideId">(
    "00000000-0000-4000-8000-000000000020",
  ),
  retailerId: retailerA,
  knowledgeObjectId,
  titleOverride: "Our take on hopsack",
  summaryOverride: "A lighter local summary for summer clients.",
  isHidden: false,
  isPinned: true,
  priorityOverride: 50,
  createdAt: "2026-07-30T00:00:00.000Z",
  updatedAt: "2026-07-30T00:00:00.000Z",
};

describe("knowledge branded IDs", () => {
  it("keeps knowledge and concept IDs nominally distinct", () => {
    expectTypeOf<KnowledgeObjectId>().not.toEqualTypeOf<MetadataConceptId>();
  });
});

describe("resolveEffectiveKnowledgePresentation", () => {
  it("applies retailer presentation overrides without mutating canonical fields", () => {
    expect(
      resolveEffectiveKnowledgePresentation(canonicalObject, override),
    ).toEqual({
      title: "Our take on hopsack",
      summary: "A lighter local summary for summer clients.",
      imageUrl: "https://example.com/hopsack.jpg",
      priority: 50,
      isPinned: true,
    });
    expect(canonicalObject.title).toBe("Understanding Hopsack");
  });

  it("falls back to canonical presentation when no override exists", () => {
    expect(
      resolveEffectiveKnowledgePresentation(canonicalObject, null),
    ).toEqual({
      title: "Understanding Hopsack",
      summary: "Why hopsack weave breathes in warm weather.",
      imageUrl: "https://example.com/hopsack.jpg",
      priority: 10,
      isPinned: false,
    });
  });
});

describe("isKnowledgeObjectEligible", () => {
  it("rejects inactive, deleted, or hidden knowledge", () => {
    expect(isKnowledgeObjectEligible(canonicalObject, null)).toBe(true);
    expect(
      isKnowledgeObjectEligible({ ...canonicalObject, active: false }, null),
    ).toBe(false);
    expect(
      isKnowledgeObjectEligible(
        { ...canonicalObject, deletedAt: "2026-07-30T01:00:00.000Z" },
        null,
      ),
    ).toBe(false);
    expect(
      isKnowledgeObjectEligible(canonicalObject, {
        ...override,
        isHidden: true,
      }),
    ).toBe(false);
  });
});

describe("isKnowledgeObjectConceptTenantCompatible", () => {
  it("allows canonical knowledge to link canonical concepts only", () => {
    expect(
      isKnowledgeObjectConceptTenantCompatible({
        knowledgeObjectRetailerId: null,
        conceptRetailerId: null,
      }),
    ).toBe(true);
    expect(
      isKnowledgeObjectConceptTenantCompatible({
        knowledgeObjectRetailerId: null,
        conceptRetailerId: retailerA,
      }),
    ).toBe(false);
  });

  it("allows retailer knowledge to link canonical or same-retailer concepts", () => {
    expect(
      isKnowledgeObjectConceptTenantCompatible({
        knowledgeObjectRetailerId: retailerA,
        conceptRetailerId: null,
      }),
    ).toBe(true);
    expect(
      isKnowledgeObjectConceptTenantCompatible({
        knowledgeObjectRetailerId: retailerA,
        conceptRetailerId: retailerA,
      }),
    ).toBe(true);
    expect(
      isKnowledgeObjectConceptTenantCompatible({
        knowledgeObjectRetailerId: retailerA,
        conceptRetailerId: retailerB,
      }),
    ).toBe(false);
  });
});

describe("isKnowledgeObjectRelationTenantCompatible", () => {
  it("keeps canonical relations between canonical objects", () => {
    expect(
      isKnowledgeObjectRelationTenantCompatible({
        relationRetailerId: null,
        sourceKnowledgeObjectRetailerId: null,
        targetKnowledgeObjectRetailerId: null,
      }),
    ).toBe(true);
  });

  it("rejects cross-retailer relation endpoints", () => {
    expect(
      isKnowledgeObjectRelationTenantCompatible({
        relationRetailerId: retailerA,
        sourceKnowledgeObjectRetailerId: null,
        targetKnowledgeObjectRetailerId: retailerB,
      }),
    ).toBe(false);
  });
});

describe("isKnowledgeOverrideTenantCompatible", () => {
  it("allows overrides for canonical or same-retailer knowledge", () => {
    expect(
      isKnowledgeOverrideTenantCompatible({
        overrideRetailerId: retailerA,
        knowledgeObjectRetailerId: null,
      }),
    ).toBe(true);
    expect(
      isKnowledgeOverrideTenantCompatible({
        overrideRetailerId: retailerA,
        knowledgeObjectRetailerId: retailerA,
      }),
    ).toBe(true);
    expect(
      isKnowledgeOverrideTenantCompatible({
        overrideRetailerId: retailerA,
        knowledgeObjectRetailerId: retailerB,
      }),
    ).toBe(false);
  });
});
