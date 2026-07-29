import type {
  KnowledgeObjectId,
  MetadataConceptId,
  RetailerId,
} from "../shared/branded-id";

import {
  isKnowledgeObjectEligible,
  resolveKnowledgePresentation,
  type KnowledgeCommercialIntent,
  type KnowledgeObject,
  type KnowledgeTopic,
  type ResolvedKnowledgePresentation,
  type RetailerKnowledgeOverride,
} from "./knowledge";

export type KnowledgeDiscoveryJourney =
  "browse" | "product_detail" | "advisor" | "appointment" | "cart";

export interface KnowledgeDiscoveryMatchedConcept {
  readonly conceptId: MetadataConceptId;
  readonly matchStrength: number;
  readonly topicAffinity?: KnowledgeTopic;
}

export interface KnowledgeDiscoveryCandidate {
  readonly object: KnowledgeObject;
  readonly matchedConcepts: readonly KnowledgeDiscoveryMatchedConcept[];
  readonly override: RetailerKnowledgeOverride | null;
}

export interface KnowledgeDiscoveryRequest {
  readonly retailerId: RetailerId;
  /** Accepted product-concept assignment IDs only; pending/rejected are excluded by the caller. */
  readonly acceptedProductConceptIds: readonly MetadataConceptId[];
  readonly journey: KnowledgeDiscoveryJourney;
  readonly viewedKnowledgeObjectIds?: readonly KnowledgeObjectId[];
  readonly preferredCommercialIntents?: readonly KnowledgeCommercialIntent[];
  /** 0–1 relationship proximity; higher favours advisor/appointment education. */
  readonly relationshipProximity?: number;
  /** Concepts the customer has already absorbed; used for novelty. */
  readonly customerSeenConceptIds?: readonly MetadataConceptId[];
  readonly minResults?: number;
  readonly maxResults?: number;
}

export interface KnowledgeDiscoveryScoreFactor {
  readonly code:
    | "accepted_concept_match"
    | "journey_relevance"
    | "retailer_pin"
    | "retailer_priority"
    | "commercial_intent"
    | "customer_novelty"
    | "relationship_proximity"
    | "already_viewed"
    | "topic_diversity";
  readonly delta: number;
  readonly detail: string;
}

export interface KnowledgeDiscoveryResult {
  readonly knowledgeObjectId: KnowledgeObjectId;
  readonly topic: KnowledgeTopic;
  readonly presentation: ResolvedKnowledgePresentation;
  readonly score: number;
  readonly factors: readonly KnowledgeDiscoveryScoreFactor[];
  readonly matchedConceptIds: readonly MetadataConceptId[];
}

export type KnowledgeDiversityBucket =
  | "mill"
  | "fibre_composition"
  | "weave_performance"
  | "construction_detail"
  | "style_occasion";

const DEFAULT_MIN_RESULTS = 3;
const DEFAULT_MAX_RESULTS = 6;

const JOURNEY_TOPIC_WEIGHTS: Record<
  KnowledgeDiscoveryJourney,
  Partial<Record<KnowledgeTopic, number>>
> = {
  browse: {
    mill: 0.4,
    fibre: 0.5,
    fabric: 0.5,
    weave: 0.4,
    value: 0.3,
  },
  product_detail: {
    fibre: 0.6,
    fabric: 0.6,
    weave: 0.5,
    construction: 0.5,
    care: 0.4,
    performance: 0.5,
    tradeoff: 0.4,
  },
  advisor: {
    styling: 0.7,
    occasion: 0.7,
    tradeoff: 0.6,
    value: 0.5,
    construction: 0.4,
  },
  appointment: {
    occasion: 0.8,
    styling: 0.6,
    construction: 0.5,
    collar: 0.4,
    value: 0.4,
  },
  cart: {
    care: 0.6,
    value: 0.7,
    tradeoff: 0.5,
    performance: 0.4,
  },
};

const JOURNEY_INTENT_WEIGHTS: Record<
  KnowledgeDiscoveryJourney,
  Partial<Record<KnowledgeCommercialIntent, number>>
> = {
  browse: { educate: 0.4, justify_premium: 0.3 },
  product_detail: { educate: 0.5, justify_premium: 0.4, upgrade: 0.3 },
  advisor: { educate: 0.4, cross_sell: 0.5, appointment: 0.6 },
  appointment: { appointment: 0.8, educate: 0.3, cross_sell: 0.4 },
  cart: { justify_premium: 0.5, upgrade: 0.4, educate: 0.2 },
};

export function knowledgeDiversityBucket(
  topic: KnowledgeTopic,
): KnowledgeDiversityBucket {
  switch (topic) {
    case "mill":
      return "mill";
    case "fibre":
    case "fabric":
      return "fibre_composition";
    case "weave":
    case "performance":
      return "weave_performance";
    case "construction":
    case "collar":
      return "construction_detail";
    case "styling":
    case "care":
    case "occasion":
    case "value":
    case "tradeoff":
      return "style_occasion";
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hasAcceptedConceptOverlap(
  candidate: KnowledgeDiscoveryCandidate,
  acceptedProductConceptIds: ReadonlySet<string>,
): boolean {
  return candidate.matchedConcepts.some((match) =>
    acceptedProductConceptIds.has(match.conceptId),
  );
}

function scoreCandidate(
  candidate: KnowledgeDiscoveryCandidate,
  request: KnowledgeDiscoveryRequest,
  acceptedProductConceptIds: ReadonlySet<string>,
  viewedIds: ReadonlySet<string>,
  seenConceptIds: ReadonlySet<string>,
): {
  score: number;
  factors: KnowledgeDiscoveryScoreFactor[];
  presentation: ResolvedKnowledgePresentation;
  matchedConceptIds: MetadataConceptId[];
} {
  const presentation = resolveKnowledgePresentation(
    candidate.object,
    candidate.override,
  );
  const factors: KnowledgeDiscoveryScoreFactor[] = [];
  let score = 0;

  const overlapping = candidate.matchedConcepts.filter((match) =>
    acceptedProductConceptIds.has(match.conceptId),
  );
  const matchScore = clamp(
    overlapping.reduce((sum, match) => sum + match.matchStrength, 0),
    0,
    3,
  );
  score += matchScore;
  factors.push({
    code: "accepted_concept_match",
    delta: matchScore,
    detail: `${overlapping.length} accepted concept match(es)`,
  });

  const journeyTopic =
    JOURNEY_TOPIC_WEIGHTS[request.journey][candidate.object.topic] ?? 0;
  if (journeyTopic > 0) {
    score += journeyTopic;
    factors.push({
      code: "journey_relevance",
      delta: journeyTopic,
      detail: `Topic ${candidate.object.topic} suits ${request.journey}`,
    });
  }

  if (presentation.isPinned) {
    score += 2;
    factors.push({
      code: "retailer_pin",
      delta: 2,
      detail: "Retailer pin",
    });
  }

  const priorityDelta = presentation.priority / 100;
  if (priorityDelta !== 0) {
    score += priorityDelta;
    factors.push({
      code: "retailer_priority",
      delta: priorityDelta,
      detail: `Effective priority ${presentation.priority}`,
    });
  }

  const intentWeight =
    JOURNEY_INTENT_WEIGHTS[request.journey][
      candidate.object.commercialIntent
    ] ?? 0;
  const preferredIntentBonus =
    request.preferredCommercialIntents?.includes(
      candidate.object.commercialIntent,
    ) === true
      ? 0.25
      : 0;
  const commercialDelta = intentWeight + preferredIntentBonus;
  if (commercialDelta > 0) {
    score += commercialDelta;
    factors.push({
      code: "commercial_intent",
      delta: commercialDelta,
      detail: `Intent ${candidate.object.commercialIntent}`,
    });
  }

  const novelMatches = overlapping.filter(
    (match) => !seenConceptIds.has(match.conceptId),
  ).length;
  if (novelMatches > 0) {
    const novelty = clamp(novelMatches * 0.25, 0, 1);
    score += novelty;
    factors.push({
      code: "customer_novelty",
      delta: novelty,
      detail: `${novelMatches} novel matched concept(s)`,
    });
  }

  const proximity = clamp(request.relationshipProximity ?? 0, 0, 1);
  if (proximity > 0) {
    const proximityDelta =
      proximity *
      (candidate.object.commercialIntent === "appointment" ||
      candidate.object.topic === "occasion" ||
      candidate.object.topic === "styling"
        ? 0.6
        : 0.2);
    score += proximityDelta;
    factors.push({
      code: "relationship_proximity",
      delta: proximityDelta,
      detail: `Relationship proximity ${proximity.toFixed(2)}`,
    });
  }

  if (viewedIds.has(candidate.object.id)) {
    score -= 1.5;
    factors.push({
      code: "already_viewed",
      delta: -1.5,
      detail: "Already viewed",
    });
  }

  return {
    score,
    factors,
    presentation,
    matchedConceptIds: overlapping.map((match) => match.conceptId),
  };
}

/**
 * ADR-060 deterministic discovery: eligibility from accepted concept overlap
 * plus active/hide gates, then scored ranking with topic diversity.
 */
export function rankKnowledgeDiscovery(
  request: KnowledgeDiscoveryRequest,
  candidates: readonly KnowledgeDiscoveryCandidate[],
): KnowledgeDiscoveryResult[] {
  const minResults = request.minResults ?? DEFAULT_MIN_RESULTS;
  const maxResults = request.maxResults ?? DEFAULT_MAX_RESULTS;
  if (minResults < 1 || maxResults < minResults || maxResults > 6) {
    throw new Error("Discovery must return between one and six cards");
  }

  const acceptedProductConceptIds = new Set(
    request.acceptedProductConceptIds.map(String),
  );
  const viewedIds = new Set(
    (request.viewedKnowledgeObjectIds ?? []).map(String),
  );
  const seenConceptIds = new Set(
    (request.customerSeenConceptIds ?? []).map(String),
  );

  const scored = candidates
    .filter((candidate) => {
      const presentation = resolveKnowledgePresentation(
        candidate.object,
        candidate.override,
      );
      return (
        isKnowledgeObjectEligible({
          active: candidate.object.active,
          isHidden: presentation.isHidden,
        }) && hasAcceptedConceptOverlap(candidate, acceptedProductConceptIds)
      );
    })
    .map((candidate) => {
      const scoredCandidate = scoreCandidate(
        candidate,
        request,
        acceptedProductConceptIds,
        viewedIds,
        seenConceptIds,
      );
      return {
        candidate,
        ...scoredCandidate,
      };
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      if (right.presentation.priority !== left.presentation.priority) {
        return right.presentation.priority - left.presentation.priority;
      }
      return left.candidate.object.slug.localeCompare(
        right.candidate.object.slug,
      );
    });

  const selected: Array<{
    candidate: KnowledgeDiscoveryCandidate;
    score: number;
    factors: KnowledgeDiscoveryScoreFactor[];
    presentation: ResolvedKnowledgePresentation;
    matchedConceptIds: MetadataConceptId[];
  }> = [];
  const usedBuckets = new Set<KnowledgeDiversityBucket>();

  for (const entry of scored) {
    if (selected.length >= maxResults) {
      break;
    }
    const bucket = knowledgeDiversityBucket(entry.candidate.object.topic);
    if (usedBuckets.has(bucket) && selected.length >= minResults) {
      continue;
    }
    if (usedBuckets.has(bucket)) {
      selected.push({
        ...entry,
        score: entry.score - 0.75,
        factors: [
          ...entry.factors,
          {
            code: "topic_diversity",
            delta: -0.75,
            detail: `Repeated ${bucket} bucket before diversity floor`,
          },
        ],
      });
    } else {
      selected.push(entry);
    }
    usedBuckets.add(bucket);
  }

  // Fill remaining slots by pure score if diversity left gaps under max.
  if (selected.length < minResults) {
    for (const entry of scored) {
      if (selected.length >= minResults) {
        break;
      }
      if (
        selected.some(
          (row) => row.candidate.object.id === entry.candidate.object.id,
        )
      ) {
        continue;
      }
      selected.push(entry);
    }
  } else if (selected.length < maxResults) {
    for (const entry of scored) {
      if (selected.length >= maxResults) {
        break;
      }
      if (
        selected.some(
          (row) => row.candidate.object.id === entry.candidate.object.id,
        )
      ) {
        continue;
      }
      const bucket = knowledgeDiversityBucket(entry.candidate.object.topic);
      if (usedBuckets.has(bucket)) {
        continue;
      }
      selected.push(entry);
      usedBuckets.add(bucket);
    }
  }

  return selected
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.candidate.object.slug.localeCompare(
        right.candidate.object.slug,
      );
    })
    .map((entry) => ({
      knowledgeObjectId: entry.candidate.object.id,
      topic: entry.candidate.object.topic,
      presentation: entry.presentation,
      score: entry.score,
      factors: entry.factors,
      matchedConceptIds: entry.matchedConceptIds,
    }));
}
