import { describe, expect, it } from "vitest";

import type { MetadataConcept } from "../metadata/metadata";
import { asId } from "../shared/branded-id";

import { projectStorefrontCatalogueFacets } from "./catalogue-storefront";

function concept(
  partial: Pick<MetadataConcept, "id" | "kind" | "slug" | "canonicalName">,
): MetadataConcept {
  return {
    retailerId: null,
    attributes: {},
    active: true,
    createdAt: "2026-07-30T00:00:00.000Z",
    updatedAt: "2026-07-30T00:00:00.000Z",
    deletedAt: null,
    ...partial,
  };
}

describe("projectStorefrontCatalogueFacets", () => {
  it("maps accepted colour/pattern/season to founder filter values", () => {
    const projected = projectStorefrontCatalogueFacets(
      [
        concept({
          id: asId<"MetadataConceptId">("00000000-0000-4000-8000-000000000001"),
          kind: "colour",
          slug: "navy",
          canonicalName: "Navy",
        }),
        concept({
          id: asId<"MetadataConceptId">("00000000-0000-4000-8000-000000000002"),
          kind: "pattern",
          slug: "herringbone",
          canonicalName: "Herringbone",
        }),
        concept({
          id: asId<"MetadataConceptId">("00000000-0000-4000-8000-000000000003"),
          kind: "season",
          slug: "spring-summer",
          canonicalName: "Spring / Summer",
        }),
        concept({
          id: asId<"MetadataConceptId">("00000000-0000-4000-8000-000000000004"),
          kind: "mill",
          slug: "loro-piana",
          canonicalName: "Loro Piana",
        }),
      ],
      245,
    );

    expect(projected.color).toBe("navy");
    expect(projected.pattern).toBe("herringbone");
    expect(projected.season).toBe("spring-summer");
    expect(projected.mill).toBe("loro-piana");
    expect(projected.weightGsm).toBe(245);
  });

  it("omits founder fields when no accepted concept maps to the panel", () => {
    const projected = projectStorefrontCatalogueFacets([
      concept({
        id: asId<"MetadataConceptId">("00000000-0000-4000-8000-000000000005"),
        kind: "colour",
        slug: "oxblood",
        canonicalName: "Oxblood",
      }),
    ]);
    expect(projected.color).toBeUndefined();
    expect(projected.facets.colour).toEqual(["oxblood"]);
  });
});
