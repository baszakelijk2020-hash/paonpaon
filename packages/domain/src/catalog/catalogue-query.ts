import type {
  MetadataConceptId,
  ProductId,
  RetailerId,
} from "../shared/branded-id";
import type { MetadataConcept, MetadataConceptKind } from "../metadata/metadata";

import {
  CATALOGUE_FACET_TO_CONCEPT_KIND,
  type CatalogueFacetKind,
  type CatalogueSearchRanges,
  type CatalogueSearchSort,
} from "./catalogue-query.schema";

export interface CatalogueSearchRequest {
  readonly retailerId: RetailerId;
  readonly query?: string;
  readonly conceptIds?: readonly MetadataConceptId[];
  readonly ranges?: CatalogueSearchRanges;
  readonly sort: CatalogueSearchSort;
  readonly page: number;
  readonly pageSize: number;
}

export interface CatalogueFacetOption {
  readonly conceptId: MetadataConceptId;
  readonly kind: MetadataConceptKind;
  readonly slug: string;
  readonly label: string;
  readonly productCount: number;
}

export interface CatalogueFacetGroup {
  readonly kind: CatalogueFacetKind;
  readonly options: readonly CatalogueFacetOption[];
}

export interface CatalogueSearchHit {
  readonly productId: ProductId;
  readonly relevanceScore: number;
}

export interface CatalogueIntentResolution {
  readonly status: "resolved" | "unresolved";
  readonly query: string;
  readonly matchedConceptIds: readonly MetadataConceptId[];
  readonly explanation: string;
  readonly fallbackReason?: string;
}

export interface CatalogueSearchResult {
  readonly hits: readonly CatalogueSearchHit[];
  readonly totalCount: number;
  readonly page: number;
  readonly pageSize: number;
  readonly facets: readonly CatalogueFacetGroup[];
  readonly intent: CatalogueIntentResolution | null;
}

/** Founder filter groups that metadata can drive when accepted assignments exist. */
export type StorefrontCatalogueFilterGroup =
  | "color"
  | "pattern"
  | "season"
  | "category";

export interface StorefrontCatalogueFilterValue {
  readonly group: StorefrontCatalogueFilterGroup;
  readonly value: string;
  readonly conceptId: MetadataConceptId;
  readonly label: string;
}

export interface StorefrontCatalogueProductMetadata {
  readonly conceptIds: readonly MetadataConceptId[];
  readonly filters: readonly StorefrontCatalogueFilterValue[];
  readonly fabricWeightGramsPerSquareMetre?: number;
}

export interface StorefrontCatalogueIntentConcept {
  readonly id: MetadataConceptId;
  readonly kind: MetadataConceptKind;
  readonly slug: string;
  readonly canonicalName: string;
}

interface IntentPattern {
  readonly triggers: readonly string[];
  readonly conceptSlugs: readonly string[];
  readonly conceptKinds?: readonly MetadataConceptKind[];
  readonly explanation: string;
}

const INTENT_PATTERNS: readonly IntentPattern[] = [
  {
    triggers: ["summer wedding", "wedding guest", "wedding suit"],
    conceptSlugs: ["spring-summer", "wedding", "semi-formal", "breathable"],
    conceptKinds: ["season", "occasion", "formality", "performance"],
    explanation:
      "Mapped to spring/summer season, wedding occasion, and breathable performance concepts.",
  },
  {
    triggers: ["travel suit", "travel jacket", "frequent travel"],
    conceptSlugs: [
      "wrinkle-resistant",
      "lightweight",
      "high-twist",
      "four-season",
    ],
    conceptKinds: ["performance", "weight_band", "weave", "climate"],
    explanation:
      "Mapped to wrinkle-resistant, lightweight, and travel-friendly weave/climate concepts.",
  },
  {
    triggers: ["humid", "humidity", "tropical"],
    conceptSlugs: ["breathable", "open-weave", "tropical", "linen-blend"],
    conceptKinds: ["performance", "weave", "climate", "fibre"],
    explanation:
      "Mapped to breathable performance and humid-climate weave/fibre concepts.",
  },
  {
    triggers: ["wrinkle", "wrinkles", "crease", "creases"],
    conceptSlugs: ["wrinkle-resistant", "high-twist", "merino-travel"],
    conceptKinds: ["performance", "weave", "fibre"],
    explanation:
      "Mapped to wrinkle-resistant performance and high-twist travel weave concepts.",
  },
  {
    triggers: ["formal", "formality", "black tie", "business formal"],
    conceptSlugs: ["formal", "black-tie", "business-formal", "worsted"],
    conceptKinds: ["formality", "occasion", "weave"],
    explanation: "Mapped to formal occasion and structured weave concepts.",
  },
  {
    triggers: ["soft", "softness", "soft fabric", "soft handle"],
    conceptSlugs: ["cashmere", "merino", "super-120s", "mellow-handle"],
    conceptKinds: ["fibre", "performance", "weave"],
    explanation:
      "Mapped to soft-handle fibre and mellow performance/weave concepts.",
  },
];

const GARMENT_TYPE_TO_CATEGORY: Readonly<Record<string, string>> = {
  suit: "Suits",
  "sport-coat": "Jackets",
  blazer: "Jackets",
  jacket: "Jackets",
  trouser: "Pants",
  pant: "Pants",
  chino: "Pants",
  knit: "Knits",
  sweater: "Knits",
  shoe: "Shoes",
  loafer: "Shoes",
  shirt: "Shirts",
  overcoat: "Outerwear",
  topcoat: "Outerwear",
  tuxedo: "Evening",
  "evening-jacket": "Evening",
  "wedding-suit": "Wedding",
};

const COLOUR_SLUG_TO_FILTER: Readonly<Record<string, string>> = {
  navy: "navy",
  midnight: "navy",
  grey: "grey",
  gray: "grey",
  charcoal: "grey",
  brown: "brown",
  chocolate: "brown",
  beige: "beige",
  cream: "beige",
  ivory: "beige",
  khaki: "beige",
  sand: "beige",
  blue: "blue",
  black: "black",
  green: "green",
  olive: "green",
  sage: "green",
};

const PATTERN_SLUG_TO_FILTER: Readonly<Record<string, string>> = {
  herringbone: "herringbone",
  glencheck: "glencheck",
  houndstooth: "houndstooth",
  sharkskin: "sharkskin",
  basketweave: "basketweave",
  windowpane: "windowpane",
  twill: "twill",
  melange: "melange",
  cable: "cable",
  plain: "plain",
};

const SEASON_SLUG_TO_FILTER: Readonly<Record<string, string>> = {
  "spring-summer": "spring-summer",
  summer: "spring-summer",
  spring: "spring-summer",
  "autumn-winter": "autumn-winter",
  autumn: "autumn-winter",
  winter: "autumn-winter",
  fall: "autumn-winter",
};

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function conceptMatchesPattern(
  concept: StorefrontCatalogueIntentConcept,
  pattern: IntentPattern,
): boolean {
  if (pattern.conceptSlugs.includes(concept.slug)) {
    return true;
  }
  if (
    pattern.conceptKinds !== undefined &&
    pattern.conceptKinds.includes(concept.kind)
  ) {
    const haystack =
      `${concept.slug} ${concept.canonicalName}`.toLowerCase();
    return pattern.triggers.some((trigger) => haystack.includes(trigger));
  }
  return false;
}

/**
 * SRCH-002: map known natural-language intents to explainable concept filters.
 * Unresolved language returns a transparent fallback descriptor — never
 * fabricated matches.
 */
export function resolveCatalogueSearchIntent(
  query: string | undefined,
  availableConcepts: readonly StorefrontCatalogueIntentConcept[],
): CatalogueIntentResolution | null {
  if (query === undefined || query.trim().length === 0) {
    return null;
  }

  const normalized = normalizeQuery(query);
  const pattern = INTENT_PATTERNS.find((candidate) =>
    candidate.triggers.some(
      (trigger) =>
        normalized.includes(trigger) || trigger.includes(normalized),
    ),
  );

  if (pattern === undefined) {
    return {
      status: "unresolved",
      query: normalized,
      matchedConceptIds: [],
      explanation: "No approved intent mapping matched this language.",
      fallbackReason:
        "Falling back to product name and description keyword matching only.",
    };
  }

  const matched = availableConcepts.filter((concept) =>
    conceptMatchesPattern(concept, pattern),
  );

  if (matched.length === 0) {
    return {
      status: "unresolved",
      query: normalized,
      matchedConceptIds: [],
      explanation: pattern.explanation,
      fallbackReason:
        "Intent is recognised but no matching accepted concepts exist in this catalogue.",
    };
  }

  return {
    status: "resolved",
    query: normalized,
    matchedConceptIds: matched.map((concept) => concept.id),
    explanation: pattern.explanation,
  };
}

export function mapMetadataConceptToStorefrontFilter(
  concept: Pick<MetadataConcept, "id" | "kind" | "slug" | "canonicalName">,
): StorefrontCatalogueFilterValue | null {
  switch (concept.kind) {
    case "colour": {
      const value =
        COLOUR_SLUG_TO_FILTER[concept.slug] ??
        COLOUR_SLUG_TO_FILTER[
          concept.slug.replace(/-/g, "") as keyof typeof COLOUR_SLUG_TO_FILTER
        ];
      if (value === undefined) return null;
      return {
        group: "color",
        value,
        conceptId: concept.id,
        label: concept.canonicalName,
      };
    }
    case "pattern": {
      const value = PATTERN_SLUG_TO_FILTER[concept.slug];
      if (value === undefined) return null;
      return {
        group: "pattern",
        value,
        conceptId: concept.id,
        label: concept.canonicalName,
      };
    }
    case "season": {
      const value = SEASON_SLUG_TO_FILTER[concept.slug];
      if (value === undefined) return null;
      return {
        group: "season",
        value,
        conceptId: concept.id,
        label: concept.canonicalName,
      };
    }
    case "garment_type": {
      const value =
        GARMENT_TYPE_TO_CATEGORY[concept.slug] ??
        GARMENT_TYPE_TO_CATEGORY[concept.slug.split("-")[0] ?? ""];
      if (value === undefined) return null;
      return {
        group: "category",
        value,
        conceptId: concept.id,
        label: concept.canonicalName,
      };
    }
    default:
      return null;
  }
}

export function buildStorefrontCatalogueProductMetadata(
  conceptIds: readonly MetadataConceptId[],
  conceptsById: ReadonlyMap<string, MetadataConcept>,
  fabricWeightGramsPerSquareMetre?: number,
): StorefrontCatalogueProductMetadata {
  const filters: StorefrontCatalogueFilterValue[] = [];
  for (const conceptId of conceptIds) {
    const concept = conceptsById.get(conceptId);
    if (concept === undefined || !concept.active) continue;
    const mapped = mapMetadataConceptToStorefrontFilter(concept);
    if (mapped !== null) {
      filters.push(mapped);
    }
  }
  return {
    conceptIds,
    filters,
    ...(fabricWeightGramsPerSquareMetre === undefined
      ? {}
      : { fabricWeightGramsPerSquareMetre }),
  };
}

export function pickStorefrontFilterValue(
  metadata: StorefrontCatalogueProductMetadata | undefined,
  group: StorefrontCatalogueFilterGroup,
  heuristicValue: string,
): string {
  const fromMetadata = metadata?.filters.find(
    (filter) => filter.group === group,
  )?.value;
  return fromMetadata ?? heuristicValue;
}

export function metadataConceptKindForFacet(
  facetKind: Exclude<CatalogueFacetKind, "weight" | "price">,
): MetadataConceptKind {
  return CATALOGUE_FACET_TO_CONCEPT_KIND[facetKind];
}

export function mergeCatalogueConceptFilters(
  explicitConceptIds: readonly MetadataConceptId[] | undefined,
  intentConceptIds: readonly MetadataConceptId[] | undefined,
): readonly MetadataConceptId[] {
  const merged = new Set<string>();
  for (const id of explicitConceptIds ?? []) {
    merged.add(id);
  }
  for (const id of intentConceptIds ?? []) {
    merged.add(id);
  }
  return [...merged].map((id) => id as MetadataConceptId);
}
