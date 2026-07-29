import { describe, expect, it } from "vitest";

import {
  isKnowledgeConceptJoinTenantCompatible,
  isKnowledgeObjectEligible,
  isKnowledgeRelationTenantCompatible,
  resolveKnowledgePresentation,
  type KnowledgeObject,
  type RetailerKnowledgeOverride,
} from "./knowledge";

const retailerA = "00000000-0000-4000-8000-0000000000a1" as never;
const retailerB = "00000000-0000-4000-8000-0000000000b2" as never;

const object: Pick<
  KnowledgeObject,
  "title" | "summary" | "imageUrl" | "priority"
> = {
  title: "Canonical title",
  summary: "Canonical summary",
  imageUrl: "https://example.com/canonical.jpg",
  priority: 10,
};

describe("knowledge tenancy guards", () => {
  it("allows canonical joins only for canonical concepts", () => {
    expect(
      isKnowledgeConceptJoinTenantCompatible({
        objectRetailerId: null,
        conceptRetailerId: null,
      }),
    ).toBe(true);
    expect(
      isKnowledgeConceptJoinTenantCompatible({
        objectRetailerId: null,
        conceptRetailerId: retailerA,
      }),
    ).toBe(false);
  });

  it("allows retailer joins for canonical or same-tenant concepts", () => {
    expect(
      isKnowledgeConceptJoinTenantCompatible({
        objectRetailerId: retailerA,
        conceptRetailerId: null,
      }),
    ).toBe(true);
    expect(
      isKnowledgeConceptJoinTenantCompatible({
        objectRetailerId: retailerA,
        conceptRetailerId: retailerA,
      }),
    ).toBe(true);
    expect(
      isKnowledgeConceptJoinTenantCompatible({
        objectRetailerId: retailerA,
        conceptRetailerId: retailerB,
      }),
    ).toBe(false);
  });

  it("rejects cross-tenant knowledge relations", () => {
    expect(
      isKnowledgeRelationTenantCompatible({
        sourceRetailerId: null,
        targetRetailerId: null,
      }),
    ).toBe(true);
    expect(
      isKnowledgeRelationTenantCompatible({
        sourceRetailerId: retailerA,
        targetRetailerId: null,
      }),
    ).toBe(true);
    expect(
      isKnowledgeRelationTenantCompatible({
        sourceRetailerId: retailerA,
        targetRetailerId: retailerA,
      }),
    ).toBe(true);
    expect(
      isKnowledgeRelationTenantCompatible({
        sourceRetailerId: retailerA,
        targetRetailerId: retailerB,
      }),
    ).toBe(false);
  });
});

describe("resolveKnowledgePresentation", () => {
  it("returns canonical presentation when no override exists", () => {
    expect(resolveKnowledgePresentation(object, null)).toEqual({
      title: "Canonical title",
      summary: "Canonical summary",
      imageUrl: "https://example.com/canonical.jpg",
      priority: 10,
      isPinned: false,
      isHidden: false,
    });
  });

  it("applies retailer rename, summary, image, priority, pin, and hide", () => {
    const override: RetailerKnowledgeOverride = {
      id: "00000000-0000-4000-8000-0000000000c3" as never,
      retailerId: retailerA,
      knowledgeObjectId: "00000000-0000-4000-8000-0000000000d4" as never,
      displayTitle: "Local title",
      summaryOverride: "Local summary",
      imageUrlOverride: "https://example.com/local.jpg",
      isHidden: true,
      isPinned: true,
      priorityOverride: 50,
      createdAt: "2026-07-30T00:00:00.000Z",
      updatedAt: "2026-07-30T00:00:00.000Z",
      deletedAt: null,
    };

    expect(resolveKnowledgePresentation(object, override)).toEqual({
      title: "Local title",
      summary: "Local summary",
      imageUrl: "https://example.com/local.jpg",
      priority: 50,
      isPinned: true,
      isHidden: true,
    });
  });

  it("keeps canonical fields when override only pins", () => {
    const override: RetailerKnowledgeOverride = {
      id: "00000000-0000-4000-8000-0000000000c3" as never,
      retailerId: retailerA,
      knowledgeObjectId: "00000000-0000-4000-8000-0000000000d4" as never,
      isHidden: false,
      isPinned: true,
      createdAt: "2026-07-30T00:00:00.000Z",
      updatedAt: "2026-07-30T00:00:00.000Z",
      deletedAt: null,
    };

    expect(resolveKnowledgePresentation(object, override)).toEqual({
      title: "Canonical title",
      summary: "Canonical summary",
      imageUrl: "https://example.com/canonical.jpg",
      priority: 10,
      isPinned: true,
      isHidden: false,
    });
  });
});

describe("isKnowledgeObjectEligible", () => {
  it("requires active objects and rejects hidden ones even when pinned", () => {
    expect(isKnowledgeObjectEligible({ active: true, isHidden: false })).toBe(
      true,
    );
    expect(isKnowledgeObjectEligible({ active: false, isHidden: false })).toBe(
      false,
    );
    expect(isKnowledgeObjectEligible({ active: true, isHidden: true })).toBe(
      false,
    );
  });
});
