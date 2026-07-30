/**
 * Unified For You deterministic ranking (CLI-007 / PHASE 7.6 / ADR-066).
 * Combines StyleProfile, wishlist, behaviour, wardrobe gaps, advisor facts,
 * and occasions into explainable catalogue recommendations. No black-box prose
 * is persisted as authority.
 */

import type { GarmentCategoryCode } from "../production/production";
import type {
  CustomerId,
  MetadataConceptId,
  ProductId,
  ProductVariantId,
  RetailerId,
} from "../shared/branded-id";

import type { CustomerConsentState } from "./consent";
import {
  isPurposeGranted,
  mayCapturePersonalizationForCustomer,
} from "./consent";
import {
  productIdFromEventProperties,
  type BehavioralEvent,
} from "./interaction-event";

export const FOR_YOU_PROJECTOR_VERSION = "for-you-v1";

export const DEFAULT_FOR_YOU_MAX_RECOMMENDATIONS = 8;

export const FOR_YOU_VISIBILITIES = [
  "usable",
  "consent_denied",
  "consent_withdrawn",
  "consent_missing",
  "empty",
] as const;

export type ForYouVisibility = (typeof FOR_YOU_VISIBILITIES)[number];

export const FOR_YOU_SCORE_FACTOR_CODES = [
  "style_declared_match",
  "style_inferred_match",
  "style_inferred_avoid",
  "wishlist_affinity",
  "recent_view",
  "wardrobe_gap_fill",
  "advisor_fact",
  "occasion_upcoming",
  "tie_mate_concept",
  "inventory_available",
  "category_diversity",
  "consent_fallback",
] as const;

export type ForYouScoreFactorCode = (typeof FOR_YOU_SCORE_FACTOR_CODES)[number];

export interface ForYouCandidate {
  readonly productId: ProductId;
  readonly productVariantId?: ProductVariantId;
  readonly displayName: string;
  readonly productSlug: string;
  readonly primaryImageUrl?: string;
  readonly acceptedConceptIds: readonly MetadataConceptId[];
  readonly garmentTypeConceptId?: MetadataConceptId;
  readonly categoryCode?: GarmentCategoryCode;
  readonly available: boolean;
}

export interface ForYouStyleSignals {
  readonly declaredConceptIds: readonly string[];
  readonly inferredPositiveConceptIds: readonly string[];
  readonly inferredNegativeConceptIds: readonly string[];
}

export interface ForYouWardrobeGap {
  readonly gapId: string;
  readonly title: string;
  readonly rank: number;
  readonly categoryCode?: GarmentCategoryCode;
  readonly slotKind?: string;
}

export interface ForYouRankingInput {
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly viewerCustomerId: CustomerId;
  readonly now: string;
  readonly consent: CustomerConsentState;
  readonly ownedProductIds: ReadonlySet<string>;
  readonly purchasedProductIds: ReadonlySet<string>;
  readonly wishlistProductIds: ReadonlySet<string>;
  readonly skippedProductIds: ReadonlySet<string>;
  readonly dismissedProductIds: ReadonlySet<string>;
  readonly rejectedConceptIds: ReadonlySet<string>;
  readonly recentViewedProductIds: ReadonlySet<string>;
  readonly tieMateSavedConceptIds: ReadonlySet<string>;
  readonly styleProfile?: ForYouStyleSignals | null;
  readonly wardrobeGaps: readonly ForYouWardrobeGap[];
  readonly upcomingOccasions: readonly string[];
  readonly advisorFactConceptIds: ReadonlySet<string>;
  readonly maxRecommendations?: number;
}

export interface ForYouScoreFactor {
  readonly code: ForYouScoreFactorCode;
  readonly delta: number;
  readonly detail: string;
}

export interface ForYouRecommendation {
  readonly rank: number;
  readonly productId: ProductId;
  readonly productVariantId?: ProductVariantId;
  readonly displayName: string;
  readonly productSlug: string;
  readonly primaryImageUrl?: string;
  readonly score: number;
  readonly factors: readonly ForYouScoreFactor[];
  readonly statement: string;
  readonly evidenceRefs: readonly string[];
}

export interface ForYouRankingResult {
  readonly version: typeof FOR_YOU_PROJECTOR_VERSION;
  readonly visibility: ForYouVisibility;
  readonly recommendations: readonly ForYouRecommendation[];
  readonly suppressedCount: number;
  readonly provenance: {
    readonly personalizationAllowed: boolean;
    readonly candidateCount: number;
    readonly signalsUsed: readonly string[];
  };
}

function resolveForYouVisibility(
  consent: CustomerConsentState,
): ForYouVisibility {
  const status = consent.personalization.status;
  if (status === "granted") return "usable";
  if (status === "withdrawn") return "consent_withdrawn";
  if (status === "denied") return "consent_denied";
  return "consent_missing";
}

function conceptOverlap(
  candidateConcepts: readonly MetadataConceptId[],
  targetIds: ReadonlySet<string>,
): readonly MetadataConceptId[] {
  return candidateConcepts.filter((id) => targetIds.has(String(id)));
}

function hasRejectedConcept(
  candidateConcepts: readonly MetadataConceptId[],
  rejectedConceptIds: ReadonlySet<string>,
): boolean {
  return candidateConcepts.some((id) => rejectedConceptIds.has(String(id)));
}

function scoreCandidate(args: {
  readonly candidate: ForYouCandidate;
  readonly input: ForYouRankingInput;
  readonly personalizationAllowed: boolean;
}): { score: number; factors: ForYouScoreFactor[]; evidenceRefs: string[] } {
  const { candidate, input, personalizationAllowed } = args;
  const factors: ForYouScoreFactor[] = [];
  const evidenceRefs: string[] = [];
  let score = 0;

  if (candidate.available) {
    score += 5;
    factors.push({
      code: "inventory_available",
      delta: 5,
      detail: "In stock at your house.",
    });
  }

  if (input.wishlistProductIds.has(String(candidate.productId))) {
    score += 25;
    factors.push({
      code: "wishlist_affinity",
      delta: 25,
      detail: "Already on your saved list.",
    });
    evidenceRefs.push(`wishlist:${candidate.productId}`);
  }

  if (input.recentViewedProductIds.has(String(candidate.productId))) {
    score += 12;
    factors.push({
      code: "recent_view",
      delta: 12,
      detail: "You recently viewed this piece.",
    });
    evidenceRefs.push(`view:${candidate.productId}`);
  }

  if (personalizationAllowed && input.styleProfile) {
    const conceptIds = new Set(
      candidate.acceptedConceptIds.map((id) => String(id)),
    );
    const declaredHits = input.styleProfile.declaredConceptIds.filter((id) =>
      conceptIds.has(id),
    );
    if (declaredHits.length > 0) {
      score += 20;
      factors.push({
        code: "style_declared_match",
        delta: 20,
        detail: "Matches a preference you declared.",
      });
      evidenceRefs.push(`declared:${declaredHits[0]}`);
    }

    const inferredHits = input.styleProfile.inferredPositiveConceptIds.filter(
      (id) => conceptIds.has(id),
    );
    if (inferredHits.length > 0) {
      score += 14;
      factors.push({
        code: "style_inferred_match",
        delta: 14,
        detail: "Aligns with consented inferred preferences.",
      });
      evidenceRefs.push(`inferred:${inferredHits[0]}`);
    }

    const negativeHits = input.styleProfile.inferredNegativeConceptIds.filter(
      (id) => conceptIds.has(id),
    );
    if (negativeHits.length > 0) {
      score -= 30;
      factors.push({
        code: "style_inferred_avoid",
        delta: -30,
        detail: "Conflicts with a negative inferred preference.",
      });
      evidenceRefs.push(`avoid:${negativeHits[0]}`);
    }
  } else if (!personalizationAllowed) {
    factors.push({
      code: "consent_fallback",
      delta: 0,
      detail:
        "StyleProfile and behavioural boosts omitted — personalization consent is not granted.",
    });
  }

  const advisorHits = conceptOverlap(
    candidate.acceptedConceptIds,
    input.advisorFactConceptIds,
  );
  if (advisorHits.length > 0) {
    score += 16;
    factors.push({
      code: "advisor_fact",
      delta: 16,
      detail: "Your advisor noted related preferences.",
    });
    evidenceRefs.push(`advisor:${advisorHits[0]}`);
  }

  const tieMateHits = conceptOverlap(
    candidate.acceptedConceptIds,
    input.tieMateSavedConceptIds,
  );
  if (tieMateHits.length > 0) {
    score += 18;
    factors.push({
      code: "tie_mate_concept",
      delta: 18,
      detail: "Related to fabrics you saved in Tie-Mate.",
    });
    evidenceRefs.push(`tie-mate:${tieMateHits[0]}`);
  }

  for (const gap of input.wardrobeGaps) {
    const categoryMatch =
      gap.categoryCode !== undefined &&
      candidate.categoryCode !== undefined &&
      gap.categoryCode === candidate.categoryCode;
    if (categoryMatch) {
      const gapBoost = Math.max(8, 22 - gap.rank * 2);
      score += gapBoost;
      factors.push({
        code: "wardrobe_gap_fill",
        delta: gapBoost,
        detail: `Helps fill wardrobe gap “${gap.title}”.`,
      });
      evidenceRefs.push(`gap:${gap.gapId}`);
      break;
    }
  }

  if (input.upcomingOccasions.length > 0) {
    const occasion = input.upcomingOccasions[0];
    if (occasion) {
      score += 6;
      factors.push({
        code: "occasion_upcoming",
        delta: 6,
        detail: `Considered alongside upcoming “${occasion}”.`,
      });
      evidenceRefs.push(`occasion:${occasion}`);
    }
  }

  return { score, factors, evidenceRefs };
}

function buildForYouStatement(
  recommendation: Pick<ForYouRecommendation, "displayName" | "factors">,
): string {
  const positive = recommendation.factors
    .filter((factor) => factor.delta > 0)
    .sort((left, right) => right.delta - left.delta);
  if (positive.length === 0) {
    return `Worth exploring: ${recommendation.displayName}.`;
  }
  const lead = positive[0];
  if (!lead) {
    return `Worth exploring: ${recommendation.displayName}.`;
  }
  return `${recommendation.displayName} — ${lead.detail}`;
}

function diversityBucket(candidate: ForYouCandidate): string {
  if (candidate.garmentTypeConceptId) {
    return `garment:${candidate.garmentTypeConceptId}`;
  }
  if (candidate.categoryCode) {
    return `category:${candidate.categoryCode}`;
  }
  return `product:${candidate.productId}`;
}

/**
 * Deterministic For You ranking with hard suppression for owned, purchased,
 * rejected concepts, dismissed items, and out-of-stock catalogue rows.
 */
export function rankForYouRecommendations(
  input: ForYouRankingInput,
  candidates: readonly ForYouCandidate[],
): ForYouRankingResult {
  if (String(input.viewerCustomerId) !== String(input.customerId)) {
    return {
      version: FOR_YOU_PROJECTOR_VERSION,
      visibility: "empty",
      recommendations: [],
      suppressedCount: 0,
      provenance: {
        personalizationAllowed: false,
        candidateCount: candidates.length,
        signalsUsed: [],
      },
    };
  }

  const visibility = resolveForYouVisibility(input.consent);
  const personalizationAllowed = mayCapturePersonalizationForCustomer(
    input.consent,
  );
  const maxResults = input.maxRecommendations ?? DEFAULT_FOR_YOU_MAX_RECOMMENDATIONS;

  const signalsUsed: string[] = [];
  if (personalizationAllowed) signalsUsed.push("style_profile");
  if (input.wishlistProductIds.size > 0) signalsUsed.push("wishlist");
  if (input.recentViewedProductIds.size > 0) signalsUsed.push("recent_views");
  if (input.wardrobeGaps.length > 0) signalsUsed.push("wardrobe_gaps");
  if (input.advisorFactConceptIds.size > 0) signalsUsed.push("advisor_facts");
  if (input.tieMateSavedConceptIds.size > 0) signalsUsed.push("tie_mate");
  if (input.upcomingOccasions.length > 0) signalsUsed.push("occasions");

  let suppressedCount = 0;
  const eligible = candidates.filter((candidate) => {
    const productKey = String(candidate.productId);
    if (input.ownedProductIds.has(productKey)) {
      suppressedCount += 1;
      return false;
    }
    if (input.purchasedProductIds.has(productKey)) {
      suppressedCount += 1;
      return false;
    }
    if (input.dismissedProductIds.has(productKey)) {
      suppressedCount += 1;
      return false;
    }
    if (input.skippedProductIds.has(productKey)) {
      suppressedCount += 1;
      return false;
    }
    if (
      hasRejectedConcept(candidate.acceptedConceptIds, input.rejectedConceptIds)
    ) {
      suppressedCount += 1;
      return false;
    }
    if (!candidate.available) {
      suppressedCount += 1;
      return false;
    }
    return true;
  });

  if (visibility !== "usable") {
    return {
      version: FOR_YOU_PROJECTOR_VERSION,
      visibility,
      recommendations: [],
      suppressedCount,
      provenance: {
        personalizationAllowed,
        candidateCount: candidates.length,
        signalsUsed,
      },
    };
  }

  const scored = eligible
    .map((candidate) => {
      const scoredCandidate = scoreCandidate({
        candidate,
        input,
        personalizationAllowed,
      });
      return { candidate, ...scoredCandidate };
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.candidate.productSlug.localeCompare(
        right.candidate.productSlug,
      );
    });

  const selected: ForYouRecommendation[] = [];
  const bucketCounts = new Map<string, number>();

  for (const entry of scored) {
    if (selected.length >= maxResults) break;

    const bucket = diversityBucket(entry.candidate);
    const bucketCount = bucketCounts.get(bucket) ?? 0;
    const factors = [...entry.factors];
    let score = entry.score;

    if (bucketCount >= 1 && selected.length >= 3) {
      score -= 4;
      factors.push({
        code: "category_diversity",
        delta: -4,
        detail: "Diversity — another piece from this category is already shown.",
      });
    }

    if (bucketCount >= 2) {
      continue;
    }

    const baseRecommendation = {
      rank: selected.length + 1,
      productId: entry.candidate.productId,
      ...(entry.candidate.productVariantId
        ? { productVariantId: entry.candidate.productVariantId }
        : {}),
      displayName: entry.candidate.displayName,
      productSlug: entry.candidate.productSlug,
      ...(entry.candidate.primaryImageUrl
        ? { primaryImageUrl: entry.candidate.primaryImageUrl }
        : {}),
      score,
      factors,
      evidenceRefs: entry.evidenceRefs,
    } satisfies Omit<ForYouRecommendation, "statement">;

    const recommendation: ForYouRecommendation = {
      ...baseRecommendation,
      statement: buildForYouStatement({
        displayName: baseRecommendation.displayName,
        factors: baseRecommendation.factors,
      }),
    };

    selected.push(recommendation);
    bucketCounts.set(bucket, bucketCount + 1);
  }

  return {
    version: FOR_YOU_PROJECTOR_VERSION,
    visibility: selected.length > 0 ? "usable" : "empty",
    recommendations: selected,
    suppressedCount,
    provenance: {
      personalizationAllowed,
      candidateCount: candidates.length,
      signalsUsed,
    },
  };
}

/** Extract product ids from recent interaction events for ranking input. */
export function forYouRecentProductIdsFromEvents(
  events: readonly BehavioralEvent[],
  args?: {
    readonly viewedLimit?: number;
    readonly skippedLimit?: number;
    readonly dismissedLimit?: number;
  },
): {
  readonly viewed: ReadonlySet<string>;
  readonly skipped: ReadonlySet<string>;
  readonly dismissed: ReadonlySet<string>;
  readonly tieMateConceptIds: ReadonlySet<string>;
} {
  const viewedLimit = args?.viewedLimit ?? 20;
  const skippedLimit = args?.skippedLimit ?? 20;
  const dismissedLimit = args?.dismissedLimit ?? 20;

  const viewed: string[] = [];
  const skipped: string[] = [];
  const dismissed: string[] = [];
  const tieMateConceptIds = new Set<string>();

  for (const event of events) {
    const productId = productIdFromEventProperties(event.properties);
    if (event.name === "product_viewed" && productId && viewed.length < viewedLimit) {
      viewed.push(productId);
    }
    if (event.name === "product_skipped" && productId && skipped.length < skippedLimit) {
      skipped.push(productId);
    }
    if (
      event.name === "for_you_dismissed" &&
      productId &&
      dismissed.length < dismissedLimit
    ) {
      dismissed.push(productId);
    }
    if (
      event.name === "product_favorited" &&
      event.properties.via === "tie_mate" &&
      typeof event.properties.conceptId === "string"
    ) {
      tieMateConceptIds.add(event.properties.conceptId);
    }
  }

  return {
    viewed: new Set(viewed),
    skipped: new Set(skipped),
    dismissed: new Set(dismissed),
    tieMateConceptIds,
  };
}

export function isPurposeGrantedForForYou(
  consent: CustomerConsentState,
): boolean {
  return isPurposeGranted(consent, "personalization");
}
