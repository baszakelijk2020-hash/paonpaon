/**
 * Deterministic For You ranking (CLI-007 / PHASE 7.6 / ADR-066).
 * Reason codes + human copy only from eligible first-party evidence.
 * AI may not invent candidates.
 */

import type { ProductId, RetailerId } from "../shared/branded-id";

export const FOR_YOU_PROJECTOR_VERSION = "for-you-v1";

export const FOR_YOU_REASON_CODES = [
  "wishlist_saved",
  "recent_interest",
  "advisor_observed",
  "quiz_declared",
  "tie_mate_saved",
  "wardrobe_gap",
  "occasion_ready",
  "recent_behaviour",
] as const;

export type ForYouReasonCode = (typeof FOR_YOU_REASON_CODES)[number];

export const FOR_YOU_REASON_COPY: Record<ForYouReasonCode, string> = {
  wishlist_saved: "Because you saved this",
  recent_interest: "Because of your recent browsing",
  advisor_observed: "Because your advisor noted this interest",
  quiz_declared: "Because you told us this preference",
  tie_mate_saved: "Because you saved this in Tie-Mate",
  wardrobe_gap: "Because it fills a wardrobe gap",
  occasion_ready: "Because it suits an upcoming occasion",
  recent_behaviour: "Because of your recent activity",
};

export interface ForYouCandidateProduct {
  readonly productId: ProductId;
  readonly retailerId: RetailerId;
  readonly title: string;
  readonly conceptLabels: readonly string[];
  readonly inStock: boolean;
  readonly owned: boolean;
  readonly rejected: boolean;
  readonly onWishlist: boolean;
  readonly tieMateSaved: boolean;
  readonly advisorMatched: boolean;
  readonly declaredMatched: boolean;
  readonly interestMatched: boolean;
  readonly wardrobeGapMatched: boolean;
  readonly occasionMatched: boolean;
  readonly recentBehaviourMatched: boolean;
}

export interface ForYouRankedItem {
  readonly productId: ProductId;
  readonly retailerId: RetailerId;
  readonly title: string;
  readonly productSlug?: string;
  readonly score: number;
  readonly reasonCodes: readonly ForYouReasonCode[];
  readonly reasonCopy: readonly string[];
  readonly primaryReason: string;
}

export interface ForYouProjection {
  readonly projectorVersion: string;
  readonly items: readonly ForYouRankedItem[];
  readonly suppressedOwned: number;
  readonly suppressedRejected: number;
  readonly suppressedOutOfStock: number;
}

function scoreCandidate(candidate: ForYouCandidateProduct): {
  score: number;
  reasons: ForYouReasonCode[];
} {
  const reasons: ForYouReasonCode[] = [];
  let score = 0;
  if (candidate.onWishlist) {
    reasons.push("wishlist_saved");
    score += 5;
  }
  if (candidate.tieMateSaved) {
    reasons.push("tie_mate_saved");
    score += 4;
  }
  if (candidate.interestMatched) {
    reasons.push("recent_interest");
    score += 3;
  }
  if (candidate.advisorMatched) {
    reasons.push("advisor_observed");
    score += 3;
  }
  if (candidate.declaredMatched) {
    reasons.push("quiz_declared");
    score += 4;
  }
  if (candidate.wardrobeGapMatched) {
    reasons.push("wardrobe_gap");
    score += 2;
  }
  if (candidate.occasionMatched) {
    reasons.push("occasion_ready");
    score += 2;
  }
  if (candidate.recentBehaviourMatched) {
    reasons.push("recent_behaviour");
    score += 1;
  }
  return { score, reasons };
}

/**
 * Deterministic ranker: suppress owned/rejected/OOS, diversify by
 * primary reason, sort by score then productId.
 */
export function rankForYouCandidates(args: {
  readonly candidates: readonly ForYouCandidateProduct[];
  readonly limit?: number;
}): ForYouProjection {
  const limit = args.limit ?? 12;
  let suppressedOwned = 0;
  let suppressedRejected = 0;
  let suppressedOutOfStock = 0;

  const scored: ForYouRankedItem[] = [];
  for (const candidate of args.candidates) {
    if (candidate.owned) {
      suppressedOwned += 1;
      continue;
    }
    if (candidate.rejected) {
      suppressedRejected += 1;
      continue;
    }
    if (!candidate.inStock) {
      suppressedOutOfStock += 1;
      continue;
    }
    const { score, reasons } = scoreCandidate(candidate);
    if (score <= 0 || reasons.length === 0) continue;
    const reasonCopy = reasons.map((code) => FOR_YOU_REASON_COPY[code]);
    scored.push({
      productId: candidate.productId,
      retailerId: candidate.retailerId,
      title: candidate.title,
      score,
      reasonCodes: reasons,
      reasonCopy,
      primaryReason: reasonCopy[0] ?? FOR_YOU_REASON_COPY.recent_behaviour,
    });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0;
  });

  // Light diversity: prefer alternating primary reason codes.
  const diversified: ForYouRankedItem[] = [];
  const remaining = [...scored];
  let lastPrimary: string | null = null;
  while (diversified.length < limit && remaining.length > 0) {
    const idx = remaining.findIndex(
      (item) => item.primaryReason !== lastPrimary,
    );
    const pickAt = idx >= 0 ? idx : 0;
    const [picked] = remaining.splice(pickAt, 1);
    if (!picked) break;
    diversified.push(picked);
    lastPrimary = picked.primaryReason;
  }

  return {
    projectorVersion: FOR_YOU_PROJECTOR_VERSION,
    items: diversified,
    suppressedOwned,
    suppressedRejected,
    suppressedOutOfStock,
  };
}

export function forYouHumanCopy(args: {
  readonly reasonCodes: readonly ForYouReasonCode[];
  readonly conceptHint?: string;
}): string {
  const primary = args.reasonCodes[0];
  if (!primary) return "Selected for you from your house activity.";
  if (primary === "recent_interest" && args.conceptHint) {
    return `Because you have been exploring ${args.conceptHint}`;
  }
  if (primary === "wishlist_saved" && args.conceptHint) {
    return `Because you saved ${args.conceptHint}`;
  }
  return FOR_YOU_REASON_COPY[primary];
}
