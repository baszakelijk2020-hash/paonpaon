import { describe, expect, it } from "vitest";

import { asId } from "../shared/branded-id";

import {
  buildStorefrontCatalogueProductMetadata,
  mapMetadataConceptToStorefrontFilter,
  mergeCatalogueConceptFilters,
  pickStorefrontFilterValue,
  resolveCatalogueSearchIntent,
  type StorefrontCatalogueIntentConcept,
} from "./catalogue-query";

const conceptNavy = asId<"MetadataConceptId">(
  "00000000-0000-4000-8000-0000000000a1",
);
const conceptSummer = asId<"MetadataConceptId">(
  "00000000-0000-4000-8000-0000000000a2",
);
const conceptWedding = asId<"MetadataConceptId">(
  "00000000-0000-4000-8000-0000000000a3",
);
const conceptWrinkle = asId<"MetadataConceptId">(
  "00000000-0000-4000-8000-0000000000a4",
);

function intentConcept(
  partial: StorefrontCatalogueIntentConcept,
): StorefrontCatalogueIntentConcept {
  return partial;
}

describe("resolveCatalogueSearchIntent", () => {
  const catalogueConcepts: StorefrontCatalogueIntentConcept[] = [
    intentConcept({
      id: conceptSummer,
      kind: "season",
      slug: "spring-summer",
      canonicalName: "Spring / Summer",
    }),
    intentConcept({
      id: conceptWedding,
      kind: "occasion",
      slug: "wedding",
      canonicalName: "Wedding",
    }),
    intentConcept({
      id: conceptWrinkle,
      kind: "performance",
      slug: "wrinkle-resistant",
      canonicalName: "Wrinkle resistant",
    }),
  ];

  it("resolves a known summer wedding intent to explainable concepts", () => {
    const resolution = resolveCatalogueSearchIntent(
      "summer wedding suit",
      catalogueConcepts,
    );

    expect(resolution).toEqual(
      expect.objectContaining({
        status: "resolved",
        query: "summer wedding suit",
        explanation: expect.stringContaining("spring/summer"),
      }),
    );
    expect(resolution?.matchedConceptIds).toEqual(
      expect.arrayContaining([conceptSummer, conceptWedding]),
    );
  });

  it("reports transparent fallback for unresolved language", () => {
    const resolution = resolveCatalogueSearchIntent(
      "something completely unknown",
      catalogueConcepts,
    );

    expect(resolution).toEqual({
      status: "unresolved",
      query: "something completely unknown",
      matchedConceptIds: [],
      explanation: "No approved intent mapping matched this language.",
      fallbackReason:
        "Falling back to product name and description keyword matching only.",
    });
  });

  it("reports unresolved when intent is known but catalogue lacks concepts", () => {
    const resolution = resolveCatalogueSearchIntent("travel suit", []);

    expect(resolution?.status).toBe("unresolved");
    expect(resolution?.fallbackReason).toContain(
      "no matching accepted concepts",
    );
  });

  it("returns null for empty query", () => {
    expect(
      resolveCatalogueSearchIntent(undefined, catalogueConcepts),
    ).toBeNull();
    expect(resolveCatalogueSearchIntent("   ", catalogueConcepts)).toBeNull();
  });
});

describe("mapMetadataConceptToStorefrontFilter", () => {
  it("maps accepted colour concepts to founder colour filters", () => {
    expect(
      mapMetadataConceptToStorefrontFilter({
        id: conceptNavy,
        kind: "colour",
        slug: "navy",
        canonicalName: "Navy",
      }),
    ).toEqual({
      group: "color",
      value: "navy",
      conceptId: conceptNavy,
      label: "Navy",
    });
  });

  it("returns null for unsupported concept kinds", () => {
    expect(
      mapMetadataConceptToStorefrontFilter({
        id: conceptWrinkle,
        kind: "mill",
        slug: "loro-piana",
        canonicalName: "Loro Piana",
      }),
    ).toBeNull();
  });
});

describe("buildStorefrontCatalogueProductMetadata", () => {
  it("derives storefront filter values from accepted concept assignments", () => {
    const conceptsById = new Map([
      [
        conceptNavy,
        {
          id: conceptNavy,
          retailerId: null,
          kind: "colour" as const,
          slug: "navy",
          canonicalName: "Navy",
          attributes: {},
          active: true,
          createdAt: "2026-07-30T00:00:00.000Z",
          updatedAt: "2026-07-30T00:00:00.000Z",
          deletedAt: null,
        },
      ],
    ]);

    const metadata = buildStorefrontCatalogueProductMetadata(
      [conceptNavy],
      conceptsById,
      280,
    );

    expect(metadata.filters).toEqual([
      {
        group: "color",
        value: "navy",
        conceptId: conceptNavy,
        label: "Navy",
      },
    ]);
    expect(metadata.fabricWeightGramsPerSquareMetre).toBe(280);
  });
});

describe("pickStorefrontFilterValue", () => {
  it("prefers metadata-derived values over heuristics", () => {
    const metadata = buildStorefrontCatalogueProductMetadata(
      [conceptNavy],
      new Map([
        [
          conceptNavy,
          {
            id: conceptNavy,
            retailerId: null,
            kind: "colour",
            slug: "navy",
            canonicalName: "Navy",
            attributes: {},
            active: true,
            createdAt: "2026-07-30T00:00:00.000Z",
            updatedAt: "2026-07-30T00:00:00.000Z",
            deletedAt: null,
          },
        ],
      ]),
    );

    expect(pickStorefrontFilterValue(metadata, "color", "grey")).toBe("navy");
    expect(pickStorefrontFilterValue(undefined, "color", "grey")).toBe("grey");
  });
});

describe("mergeCatalogueConceptFilters", () => {
  it("merges explicit and intent concept filters without duplicates", () => {
    const explicit = [conceptNavy];
    const intent = [conceptNavy, conceptSummer];
    expect(mergeCatalogueConceptFilters(explicit, intent)).toEqual([
      conceptNavy,
      conceptSummer,
    ]);
  });
});

describe("catalogueSearchRequestSchema", () => {
  it("rejects invalid weight and price ranges", async () => {
    const { catalogueSearchRequestSchema } =
      await import("./catalogue-query.schema");

    expect(() =>
      catalogueSearchRequestSchema.parse({
        retailerId: "00000000-0000-4000-8000-000000000099",
        ranges: { minWeight: 400, maxWeight: 200 },
      }),
    ).toThrow();
  });
});
