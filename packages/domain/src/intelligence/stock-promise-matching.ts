/**
 * Promise-matching on inbound stock news (ADV-105 / PHASE 17.5).
 *
 * A plain, published keyword-overlap match — never a semantic/AI black
 * box — between a staff-entered stock update ("new linen jackets
 * arrived") and the text of open advisor-commitment/follow-up
 * opportunities (17.1's own confirmed-follow-up object, reused here
 * rather than a second promise ledger). Every match names exactly which
 * words overlapped, so an advisor can see why a promise was surfaced,
 * not just that it was.
 */

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "for",
  "to",
  "of",
  "in",
  "on",
  "with",
  "new",
  "arrived",
  "just",
  "this",
  "that",
  "is",
  "are",
  "has",
  "have",
  "will",
  "was",
  "were",
  "be",
  "been",
  "at",
  "by",
  "from",
]);

function tokenize(text: string): ReadonlySet<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 2 && !STOPWORDS.has(word)),
  );
}

/** Only these two types are named in this item's own owner boundary — a
 * promise, not every opportunity kind. */
const MATCHABLE_TYPES = new Set(["advisor_commitment", "interest_follow_up"]);
/** Only a still-live promise can be matched — a dismissed or completed
 * one is not waiting on anything. */
const MATCHABLE_STATUSES = new Set(["draft", "accepted", "snoozed"]);

export interface StockPromiseCandidate {
  readonly id: string;
  readonly type: string;
  readonly status: string;
  readonly whyNow: string;
  readonly suggestedAction: string;
}

export interface StockPromiseMatch {
  readonly opportunityId: string;
  readonly overlappingWords: readonly string[];
}

/**
 * Returns every live, matchable opportunity that shares at least one
 * real word with the stock update text, ranked by how many words
 * overlapped — never a semantic guess, never a match with nothing
 * concrete behind it.
 */
export function matchStockNewsToPromises(args: {
  readonly stockUpdateText: string;
  readonly candidates: readonly StockPromiseCandidate[];
}): readonly StockPromiseMatch[] {
  const stockTokens = tokenize(args.stockUpdateText);
  if (stockTokens.size === 0) return [];

  const matches: StockPromiseMatch[] = [];
  for (const candidate of args.candidates) {
    if (
      !MATCHABLE_TYPES.has(candidate.type) ||
      !MATCHABLE_STATUSES.has(candidate.status)
    ) {
      continue;
    }
    const candidateTokens = tokenize(
      `${candidate.whyNow} ${candidate.suggestedAction}`,
    );
    const overlappingWords = [...stockTokens].filter((word) =>
      candidateTokens.has(word),
    );
    if (overlappingWords.length > 0) {
      matches.push({ opportunityId: candidate.id, overlappingWords });
    }
  }

  return matches.sort(
    (a, b) => b.overlappingWords.length - a.overlappingWords.length,
  );
}
