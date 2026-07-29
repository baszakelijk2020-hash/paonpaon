import type { MetadataConceptKind } from "../metadata/metadata";
import type {
  MetadataConceptId,
  ProductId,
  RetailerId,
} from "../shared/branded-id";

/**
 * SRCH-001 facet kinds driven by accepted metadata assignments.
 * Price is a variant money range, not a concept kind.
 */
export const CATALOGUE_FACET_KINDS = [
  "mill",
  "weave",
  "weight_band",
  "performance",
  "climate",
  "season",
  "pattern",
  "construction",
  "occasion",
  "formality",
  "colour",
] as const satisfies readonly MetadataConceptKind[];

export type CatalogueFacetKind = (typeof CATALOGUE_FACET_KINDS)[number];

export type CatalogueSearchSort =
  "newest" | "price_asc" | "price_desc" | "relevance";

export interface CatalogueSearchRanges {
  readonly minWeight?: number;
  readonly maxWeight?: number;
  readonly minPriceMinor?: number;
  readonly maxPriceMinor?: number;
}

/**
 * Repository-backed catalogue search contract (programme §6 / SRCH-001).
 * Natural-language `query` is resolved by `resolveCatalogueIntent` before
 * the repository executes structured filters.
 */
export interface CatalogueSearchRequest {
  readonly retailerId: RetailerId;
  readonly query?: string;
  readonly conceptIds?: readonly MetadataConceptId[];
  readonly ranges?: CatalogueSearchRanges;
  readonly sort: CatalogueSearchSort;
  readonly page: number;
  readonly pageSize: number;
}

export interface CatalogueSearchHitExplanation {
  readonly matchedConceptIds: readonly MetadataConceptId[];
  readonly factors: readonly CatalogueRelevanceFactor[];
}

export interface CatalogueRelevanceFactor {
  readonly code:
    | "accepted_concept_match"
    | "weight_in_range"
    | "price_in_range"
    | "intent_match"
    | "name_token_fallback";
  readonly delta: number;
  readonly detail: string;
}

export interface CatalogueSearchHit {
  readonly productId: ProductId;
  readonly score: number;
  readonly explanation: CatalogueSearchHitExplanation;
}

export interface CatalogueSearchResult {
  readonly hits: readonly CatalogueSearchHit[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly unresolvedQueryTokens: readonly string[];
}

export interface CatalogueFacetValue {
  readonly conceptId: MetadataConceptId;
  readonly kind: CatalogueFacetKind;
  readonly slug: string;
  readonly label: string;
  readonly productCount: number;
}

export interface CatalogueFacets {
  readonly retailerId: RetailerId;
  readonly byKind: Readonly<
    Partial<Record<CatalogueFacetKind, readonly CatalogueFacetValue[]>>
  >;
  readonly priceMinor: {
    readonly min: number | null;
    readonly max: number | null;
  };
  readonly weightGramsPerSquareMetre: {
    readonly min: number | null;
    readonly max: number | null;
  };
}

/** Indexed projection row used for pure relevance scoring and pagination. */
export interface CatalogueQueryCandidate {
  readonly productId: ProductId;
  readonly name: string;
  readonly slug: string;
  readonly createdAt: string;
  readonly status: "draft" | "active" | "archived";
  readonly acceptedConceptIds: readonly MetadataConceptId[];
  readonly minPriceMinor: number | null;
  readonly maxPriceMinor: number | null;
  readonly fabricWeightGramsPerSquareMetre: number | null;
}

export function isCatalogueFacetKind(
  kind: MetadataConceptKind,
): kind is CatalogueFacetKind {
  return (CATALOGUE_FACET_KINDS as readonly string[]).includes(kind);
}

/**
 * Deterministic relevance over accepted-metadata candidates.
 * Pending/rejected concepts must already be excluded by the caller.
 */
export function scoreCatalogueCandidate(
  candidate: CatalogueQueryCandidate,
  request: Pick<CatalogueSearchRequest, "conceptIds" | "ranges">,
  intentMatchedConceptIds: readonly MetadataConceptId[] = [],
): CatalogueSearchHit | null {
  if (candidate.status !== "active") {
    return null;
  }

  const factors: CatalogueRelevanceFactor[] = [];
  const matched = new Set<MetadataConceptId>();
  let score = 0;

  const requiredConcepts = request.conceptIds ?? [];
  if (requiredConcepts.length > 0) {
    const accepted = new Set(candidate.acceptedConceptIds);
    const allPresent = requiredConcepts.every((id) => accepted.has(id));
    if (!allPresent) {
      return null;
    }
    for (const id of requiredConcepts) {
      matched.add(id);
    }
    factors.push({
      code: "accepted_concept_match",
      delta: requiredConcepts.length,
      detail: `Matched ${requiredConcepts.length} accepted concept filter(s)`,
    });
    score += requiredConcepts.length;
  }

  const ranges = request.ranges;
  if (ranges !== undefined) {
    const weight = candidate.fabricWeightGramsPerSquareMetre;
    if (ranges.minWeight !== undefined || ranges.maxWeight !== undefined) {
      if (weight === null) {
        return null;
      }
      if (ranges.minWeight !== undefined && weight < ranges.minWeight) {
        return null;
      }
      if (ranges.maxWeight !== undefined && weight > ranges.maxWeight) {
        return null;
      }
      factors.push({
        code: "weight_in_range",
        delta: 1,
        detail: `Fabric weight ${weight} g/m² within requested range`,
      });
      score += 1;
    }

    const price = candidate.minPriceMinor;
    if (
      ranges.minPriceMinor !== undefined ||
      ranges.maxPriceMinor !== undefined
    ) {
      if (price === null) {
        return null;
      }
      if (ranges.minPriceMinor !== undefined && price < ranges.minPriceMinor) {
        return null;
      }
      if (ranges.maxPriceMinor !== undefined && price > ranges.maxPriceMinor) {
        return null;
      }
      factors.push({
        code: "price_in_range",
        delta: 1,
        detail: `Price ${price} minor units within requested range`,
      });
      score += 1;
    }
  }

  if (intentMatchedConceptIds.length > 0) {
    const accepted = new Set(candidate.acceptedConceptIds);
    let intentHits = 0;
    for (const id of intentMatchedConceptIds) {
      if (accepted.has(id)) {
        intentHits += 1;
        matched.add(id);
      }
    }
    if (intentHits === 0 && requiredConcepts.length === 0) {
      // Intent-only search: require at least one intent concept on the product.
      return null;
    }
    if (intentHits > 0) {
      factors.push({
        code: "intent_match",
        delta: intentHits,
        detail: `Matched ${intentHits} intent-derived concept(s)`,
      });
      score += intentHits;
    }
  }

  if (factors.length === 0) {
    // Unfiltered browse: every active candidate is eligible with baseline score.
    score = 0;
  }

  return {
    productId: candidate.productId,
    score,
    explanation: {
      matchedConceptIds: [...matched],
      factors,
    },
  };
}

export function paginateCatalogueHits(
  hits: readonly CatalogueSearchHit[],
  page: number,
  pageSize: number,
): CatalogueSearchResult {
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(100, Math.max(1, pageSize));
  const start = (safePage - 1) * safePageSize;
  return {
    hits: hits.slice(start, start + safePageSize),
    total: hits.length,
    page: safePage,
    pageSize: safePageSize,
    unresolvedQueryTokens: [],
  };
}

export function sortCatalogueHits(
  hits: readonly CatalogueSearchHit[],
  candidatesById: ReadonlyMap<ProductId, CatalogueQueryCandidate>,
  sort: CatalogueSearchSort,
): CatalogueSearchHit[] {
  const copy = [...hits];
  copy.sort((a, b) => {
    const ca = candidatesById.get(a.productId);
    const cb = candidatesById.get(b.productId);
    if (sort === "price_asc") {
      return (ca?.minPriceMinor ?? 0) - (cb?.minPriceMinor ?? 0);
    }
    if (sort === "price_desc") {
      return (cb?.minPriceMinor ?? 0) - (ca?.minPriceMinor ?? 0);
    }
    if (sort === "newest") {
      return (cb?.createdAt ?? "").localeCompare(ca?.createdAt ?? "");
    }
    // relevance: higher score first, then newer, then slug
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    const created = (cb?.createdAt ?? "").localeCompare(ca?.createdAt ?? "");
    if (created !== 0) {
      return created;
    }
    return (ca?.slug ?? "").localeCompare(cb?.slug ?? "");
  });
  return copy;
}
