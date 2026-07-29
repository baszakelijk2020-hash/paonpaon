import type {
  MetadataConcept,
  MetadataConceptKind,
} from "../metadata/metadata";
import type { MetadataConceptId } from "../shared/branded-id";

import {
  isCatalogueFacetKind,
  type CatalogueSearchRanges,
  type CatalogueSearchSort,
} from "./catalogue-query";

/**
 * Known natural-language intents (SRCH-002). Each maps to explainable
 * concept kind/slug hints and optional weight ranges — never fabricated IDs.
 */
export const CATALOGUE_INTENT_PHRASES = [
  "travel",
  "humidity",
  "wrinkles",
  "wrinkle",
  "formality",
  "formal",
  "wedding",
  "weddings",
  "softness",
  "soft",
  "summer wedding",
  "travel suit",
] as const;

export type CatalogueIntentPhrase = (typeof CATALOGUE_INTENT_PHRASES)[number];

export interface CatalogueIntentConceptHint {
  readonly kind: MetadataConceptKind;
  readonly slugIncludes?: readonly string[];
  readonly nameIncludes?: readonly string[];
}

export interface CatalogueIntentDefinition {
  readonly phrase: CatalogueIntentPhrase;
  readonly explanation: string;
  readonly conceptHints: readonly CatalogueIntentConceptHint[];
  readonly ranges?: CatalogueSearchRanges;
}

export interface CatalogueIntentMatch {
  /** Known intent phrase or approved-concept token that resolved. */
  readonly phrase: string;
  readonly explanation: string;
  readonly conceptIds: readonly MetadataConceptId[];
  readonly ranges: CatalogueSearchRanges;
}

/**
 * Transparent resolution of free-text into structured filters.
 * Unresolved tokens are reported; they never invent matches.
 */
export interface CatalogueIntentResolution {
  readonly matches: readonly CatalogueIntentMatch[];
  readonly resolvedConceptIds: readonly MetadataConceptId[];
  readonly ranges: CatalogueSearchRanges;
  readonly unresolvedTokens: readonly string[];
  readonly sortHint: CatalogueSearchSort;
}

const INTENT_DEFINITIONS: readonly CatalogueIntentDefinition[] = [
  {
    phrase: "summer wedding",
    explanation:
      "Maps to warm-climate / spring-summer season and wedding occasion concepts",
    conceptHints: [
      {
        kind: "occasion",
        slugIncludes: ["wedding"],
        nameIncludes: ["wedding"],
      },
      {
        kind: "climate",
        slugIncludes: ["warm", "hot", "humid"],
        nameIncludes: ["warm", "hot", "humid", "summer"],
      },
      {
        kind: "season",
        slugIncludes: ["spring-summer", "summer"],
        nameIncludes: ["spring", "summer"],
      },
    ],
    ranges: { maxWeight: 280 },
  },
  {
    phrase: "travel suit",
    explanation:
      "Maps to travel/wrinkle-resistant performance and lighter weights",
    conceptHints: [
      {
        kind: "performance",
        slugIncludes: ["travel", "wrinkle"],
        nameIncludes: ["travel", "wrinkle"],
      },
      {
        kind: "garment_type",
        slugIncludes: ["suit"],
        nameIncludes: ["suit"],
      },
    ],
    ranges: { maxWeight: 300 },
  },
  {
    phrase: "travel",
    explanation: "Maps to travel-ready performance concepts",
    conceptHints: [
      {
        kind: "performance",
        slugIncludes: ["travel", "packable"],
        nameIncludes: ["travel", "pack"],
      },
    ],
  },
  {
    phrase: "humidity",
    explanation: "Maps to humid-climate and breathable performance concepts",
    conceptHints: [
      {
        kind: "climate",
        slugIncludes: ["humid", "tropical"],
        nameIncludes: ["humid", "tropical", "moisture"],
      },
      {
        kind: "performance",
        slugIncludes: ["breathable", "moisture"],
        nameIncludes: ["breathable", "moisture"],
      },
    ],
  },
  {
    phrase: "wrinkles",
    explanation: "Maps to wrinkle-resistant performance concepts",
    conceptHints: [
      {
        kind: "performance",
        slugIncludes: ["wrinkle"],
        nameIncludes: ["wrinkle"],
      },
    ],
  },
  {
    phrase: "wrinkle",
    explanation: "Maps to wrinkle-resistant performance concepts",
    conceptHints: [
      {
        kind: "performance",
        slugIncludes: ["wrinkle"],
        nameIncludes: ["wrinkle"],
      },
    ],
  },
  {
    phrase: "formality",
    explanation: "Maps to formality concepts",
    conceptHints: [{ kind: "formality" }],
  },
  {
    phrase: "formal",
    explanation: "Maps to formal formality concepts",
    conceptHints: [
      {
        kind: "formality",
        slugIncludes: ["formal", "black-tie", "business"],
        nameIncludes: ["formal", "black tie", "business"],
      },
    ],
  },
  {
    phrase: "weddings",
    explanation: "Maps to wedding occasion concepts",
    conceptHints: [
      {
        kind: "occasion",
        slugIncludes: ["wedding"],
        nameIncludes: ["wedding"],
      },
    ],
  },
  {
    phrase: "wedding",
    explanation: "Maps to wedding occasion concepts",
    conceptHints: [
      {
        kind: "occasion",
        slugIncludes: ["wedding"],
        nameIncludes: ["wedding"],
      },
    ],
  },
  {
    phrase: "softness",
    explanation: "Maps to soft-hand fibre/performance/construction concepts",
    conceptHints: [
      {
        kind: "fibre",
        slugIncludes: ["cashmere", "vicuna", "silk"],
        nameIncludes: ["cashmere", "soft", "silk"],
      },
      {
        kind: "performance",
        slugIncludes: ["soft"],
        nameIncludes: ["soft"],
      },
      {
        kind: "construction",
        slugIncludes: ["soft"],
        nameIncludes: ["soft"],
      },
    ],
  },
  {
    phrase: "soft",
    explanation: "Maps to soft-hand fibre/performance/construction concepts",
    conceptHints: [
      {
        kind: "fibre",
        slugIncludes: ["cashmere", "vicuna", "silk"],
        nameIncludes: ["cashmere", "soft", "silk"],
      },
      {
        kind: "performance",
        slugIncludes: ["soft"],
        nameIncludes: ["soft"],
      },
    ],
  },
];

// Longer phrases first so "summer wedding" wins over "wedding".
const SORTED_INTENT_DEFINITIONS = [...INTENT_DEFINITIONS].sort(
  (a, b) => b.phrase.length - a.phrase.length,
);

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function conceptMatchesHint(
  concept: MetadataConcept,
  hint: CatalogueIntentConceptHint,
): boolean {
  if (concept.kind !== hint.kind || !concept.active) {
    return false;
  }
  const slug = concept.slug.toLowerCase();
  const name = concept.canonicalName.toLowerCase();
  const slugIncludes = hint.slugIncludes ?? [];
  const nameIncludes = hint.nameIncludes ?? [];
  if (slugIncludes.length === 0 && nameIncludes.length === 0) {
    return true;
  }
  return (
    slugIncludes.some((needle) => slug.includes(needle)) ||
    nameIncludes.some((needle) => name.includes(needle))
  );
}

function mergeRanges(
  base: CatalogueSearchRanges,
  next: CatalogueSearchRanges | undefined,
): CatalogueSearchRanges {
  if (next === undefined) {
    return base;
  }
  return {
    ...(base.minWeight !== undefined || next.minWeight !== undefined
      ? {
          minWeight: Math.max(
            base.minWeight ?? Number.NEGATIVE_INFINITY,
            next.minWeight ?? Number.NEGATIVE_INFINITY,
          ),
        }
      : {}),
    ...(base.maxWeight !== undefined || next.maxWeight !== undefined
      ? {
          maxWeight: Math.min(
            base.maxWeight ?? Number.POSITIVE_INFINITY,
            next.maxWeight ?? Number.POSITIVE_INFINITY,
          ),
        }
      : {}),
    ...(base.minPriceMinor !== undefined || next.minPriceMinor !== undefined
      ? {
          minPriceMinor: Math.max(
            base.minPriceMinor ?? Number.NEGATIVE_INFINITY,
            next.minPriceMinor ?? Number.NEGATIVE_INFINITY,
          ),
        }
      : {}),
    ...(base.maxPriceMinor !== undefined || next.maxPriceMinor !== undefined
      ? {
          maxPriceMinor: Math.min(
            base.maxPriceMinor ?? Number.POSITIVE_INFINITY,
            next.maxPriceMinor ?? Number.POSITIVE_INFINITY,
          ),
        }
      : {}),
  };
}

function sanitizeRanges(ranges: CatalogueSearchRanges): CatalogueSearchRanges {
  const result: CatalogueSearchRanges = {
    ...(ranges.minWeight !== undefined &&
    Number.isFinite(ranges.minWeight) &&
    ranges.minWeight !== Number.NEGATIVE_INFINITY
      ? { minWeight: ranges.minWeight }
      : {}),
    ...(ranges.maxWeight !== undefined &&
    Number.isFinite(ranges.maxWeight) &&
    ranges.maxWeight !== Number.POSITIVE_INFINITY
      ? { maxWeight: ranges.maxWeight }
      : {}),
    ...(ranges.minPriceMinor !== undefined &&
    Number.isFinite(ranges.minPriceMinor) &&
    ranges.minPriceMinor !== Number.NEGATIVE_INFINITY
      ? { minPriceMinor: ranges.minPriceMinor }
      : {}),
    ...(ranges.maxPriceMinor !== undefined &&
    Number.isFinite(ranges.maxPriceMinor) &&
    ranges.maxPriceMinor !== Number.POSITIVE_INFINITY
      ? { maxPriceMinor: ranges.maxPriceMinor }
      : {}),
  };
  return result;
}

/**
 * Resolve free-text against approved concepts only.
 * Unknown language becomes `unresolvedTokens` — never fabricated hits.
 */
export function resolveCatalogueIntent(
  query: string | undefined,
  visibleConcepts: readonly MetadataConcept[],
): CatalogueIntentResolution {
  const normalized = normalizeToken(query ?? "");
  if (normalized.length === 0) {
    return {
      matches: [],
      resolvedConceptIds: [],
      ranges: {},
      unresolvedTokens: [],
      sortHint: "newest",
    };
  }

  let remaining = ` ${normalized} `;
  const matches: CatalogueIntentMatch[] = [];
  const resolved = new Set<MetadataConceptId>();
  let ranges: CatalogueSearchRanges = {};

  for (const definition of SORTED_INTENT_DEFINITIONS) {
    const needle = ` ${definition.phrase} `;
    if (!remaining.includes(needle)) {
      continue;
    }
    remaining = remaining.split(needle).join(" ");
    const conceptIds: MetadataConceptId[] = [];
    for (const hint of definition.conceptHints) {
      for (const concept of visibleConcepts) {
        if (conceptMatchesHint(concept, hint)) {
          conceptIds.push(concept.id);
          resolved.add(concept.id);
        }
      }
    }
    ranges = mergeRanges(ranges, definition.ranges);
    matches.push({
      phrase: definition.phrase,
      explanation: definition.explanation,
      conceptIds: [...new Set(conceptIds)],
      ranges: sanitizeRanges(definition.ranges ?? {}),
    });
  }

  // Match remaining tokens to approved concept slugs/names (any facet kind).
  const leftoverTokens = remaining
    .split(/[^a-z0-9-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);

  const stopWords = new Set([
    "a",
    "an",
    "the",
    "for",
    "and",
    "or",
    "to",
    "in",
    "of",
    "i",
    "my",
    "me",
    "dislike",
    "like",
    "want",
    "need",
    "suit",
    "with",
    "without",
  ]);

  const unresolved: string[] = [];
  for (const token of leftoverTokens) {
    if (stopWords.has(token)) {
      continue;
    }
    const conceptHits = visibleConcepts.filter((concept) => {
      if (!concept.active) {
        return false;
      }
      const slug = concept.slug.toLowerCase();
      const name = concept.canonicalName.toLowerCase();
      return (
        slug === token ||
        slug.includes(token) ||
        name.split(/\s+/).includes(token) ||
        name.includes(token)
      );
    });
    if (conceptHits.length === 0) {
      unresolved.push(token);
      continue;
    }
    for (const concept of conceptHits) {
      resolved.add(concept.id);
    }
    // Prefer facet-kind concepts when explaining approved-concept matches.
    const facetHits = conceptHits.filter((c) => isCatalogueFacetKind(c.kind));
    matches.push({
      phrase: token,
      explanation: `Matched approved concept(s) for “${token}”`,
      conceptIds: (facetHits.length > 0 ? facetHits : conceptHits).map(
        (c) => c.id,
      ),
      ranges: {},
    });
  }

  return {
    matches,
    resolvedConceptIds: [...resolved],
    ranges: sanitizeRanges(ranges),
    unresolvedTokens: [...new Set(unresolved)],
    sortHint: resolved.size > 0 ? "relevance" : "newest",
  };
}
