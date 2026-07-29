/**
 * Grounded TableService orchestration (ADV-001, ADV-002, ADR-060 / PHASE 3.4).
 * Approved knowledge and catalogue facts only — AI output is validated here.
 */

import type { KnowledgeDiscoveryResult } from "../knowledge/knowledge-discovery";
import type {
  KnowledgeObjectId,
  MetadataConceptId,
  ProductId,
  RetailerId,
} from "../shared/branded-id";
import type { CatalogueSearchHit } from "../catalog/catalogue-query";

export const TABLE_SERVICE_UNCERTAINTY_LEVELS = [
  "low",
  "medium",
  "high",
] as const;

export type TableServiceUncertainty =
  (typeof TABLE_SERVICE_UNCERTAINTY_LEVELS)[number];

export const TABLE_SERVICE_OCCASION_PHRASES = [
  "summer wedding",
  "wedding",
  "style help",
] as const;

export type TableServiceOccasionPhrase =
  (typeof TABLE_SERVICE_OCCASION_PHRASES)[number];

export interface TableServiceKnowledgeCitation {
  readonly knowledgeObjectId: KnowledgeObjectId;
  readonly title: string;
  readonly summary: string;
  readonly score: number;
}

export interface TableServiceShortlistItem {
  readonly productId: ProductId;
  readonly name: string;
  readonly score: number;
  readonly explanation: string;
}

export interface TableServiceOccasionBundle {
  readonly retailerId: RetailerId;
  readonly occasionPhrase: string;
  readonly intentExplanation: string;
  readonly resolvedConceptIds: readonly MetadataConceptId[];
  readonly knowledge: readonly TableServiceKnowledgeCitation[];
  readonly shortlist: readonly TableServiceShortlistItem[];
  readonly allowedKnowledgeIds: readonly KnowledgeObjectId[];
  readonly allowedProductIds: readonly ProductId[];
}

export interface TableServiceGroundedAnswer {
  readonly body: string;
  readonly citations: readonly KnowledgeObjectId[];
  readonly citedProductIds: readonly ProductId[];
  readonly uncertainty: TableServiceUncertainty;
  readonly refused: boolean;
  readonly handoffRecommended: boolean;
}

export interface TableServiceGroundedAnswerValidation {
  readonly ok: boolean;
  readonly answer?: TableServiceGroundedAnswer;
  readonly reason?: string;
}

export interface TableServiceRawGroundedAnswerOutput {
  readonly body?: unknown;
  readonly citations?: unknown;
  readonly citedProductIds?: unknown;
  readonly uncertainty?: unknown;
  readonly refused?: unknown;
  readonly handoffRecommended?: unknown;
}

function isUncertainty(value: unknown): value is TableServiceUncertainty {
  return (
    typeof value === "string" &&
    (TABLE_SERVICE_UNCERTAINTY_LEVELS as readonly string[]).includes(value)
  );
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

/**
 * Fail closed when the model cites knowledge or products outside the
 * approved retrieval bundle (ADR-060 §5).
 */
export function validateTableServiceGroundedAnswer(
  raw: TableServiceRawGroundedAnswerOutput,
  allowed: {
    readonly knowledgeIds: ReadonlySet<string>;
    readonly productIds: ReadonlySet<string>;
  },
): TableServiceGroundedAnswerValidation {
  const body = typeof raw.body === "string" ? raw.body.trim() : "";
  const refused = raw.refused === true;
  const handoffRecommended = raw.handoffRecommended === true;
  const uncertainty = isUncertainty(raw.uncertainty) ? raw.uncertainty : "high";

  const citationIds = readStringArray(raw.citations);
  const productIds = readStringArray(raw.citedProductIds);

  for (const id of citationIds) {
    if (!allowed.knowledgeIds.has(id)) {
      return {
        ok: false,
        reason: `Citation ${id} is not in the approved knowledge allowlist`,
      };
    }
  }
  for (const id of productIds) {
    if (!allowed.productIds.has(id)) {
      return {
        ok: false,
        reason: `Product ${id} is not in the approved shortlist allowlist`,
      };
    }
  }

  if (!refused && body.length === 0) {
    return { ok: false, reason: "Answer body is required when not refusing" };
  }

  if (!refused && citationIds.length === 0 && productIds.length === 0) {
    return {
      ok: false,
      reason: "Grounded answers must cite approved knowledge or shortlist items",
    };
  }

  return {
    ok: true,
    answer: {
      body,
      citations: citationIds as KnowledgeObjectId[],
      citedProductIds: productIds as ProductId[],
      uncertainty,
      refused,
      handoffRecommended,
    },
  };
}

export function mapDiscoveryToCitations(
  results: readonly KnowledgeDiscoveryResult[],
): TableServiceKnowledgeCitation[] {
  return results.map((result) => ({
    knowledgeObjectId: result.knowledgeObjectId,
    title: result.presentation.title,
    summary: result.presentation.summary,
    score: result.score,
  }));
}

export function mapHitsToShortlist(
  hits: readonly CatalogueSearchHit[],
  productNames: ReadonlyMap<string, string>,
): TableServiceShortlistItem[] {
  return hits.map((hit) => {
    const factorSummary = hit.explanation.factors
      .slice(0, 2)
      .map((factor) => factor.detail)
      .join("; ");
    return {
      productId: hit.productId,
      name: productNames.get(hit.productId) ?? "Catalogue item",
      score: hit.score,
      explanation: factorSummary || "Matched accepted metadata for this occasion",
    };
  });
}

/**
 * Deterministic fallback when no provider is configured or validation fails.
 * Summarizes approved knowledge and shortlist without inventing facts.
 */
export function buildDeterministicGroundedAnswer(args: {
  readonly bundle: TableServiceOccasionBundle;
  readonly question?: string;
}): TableServiceGroundedAnswer {
  const { bundle } = args;
  const hasKnowledge = bundle.knowledge.length > 0;
  const hasShortlist = bundle.shortlist.length > 0;

  if (!hasKnowledge && !hasShortlist) {
    return {
      body:
        "I do not have enough approved guidance to answer that confidently. An advisor can help in store or by message.",
      citations: [],
      citedProductIds: [],
      uncertainty: "high",
      refused: true,
      handoffRecommended: true,
    };
  }

  const knowledgeLines = bundle.knowledge
    .slice(0, 3)
    .map((item) => `• ${item.title}: ${item.summary}`);
  const shortlistLines = bundle.shortlist
    .slice(0, 4)
    .map((item) => `• ${item.name} — ${item.explanation}`);

  const intro = bundle.intentExplanation
    ? `${bundle.intentExplanation}. `
    : "";
  const knowledgeBlock =
    knowledgeLines.length > 0
      ? `From our approved guides:\n${knowledgeLines.join("\n")}`
      : "";
  const shortlistBlock =
    shortlistLines.length > 0
      ? `Pieces that match this occasion:\n${shortlistLines.join("\n")}`
      : "";
  const body = [intro + "Here is what we can share with confidence:", knowledgeBlock, shortlistBlock]
    .filter((part) => part.length > 0)
    .join("\n\n");

  return {
    body,
    citations: bundle.knowledge.slice(0, 3).map((item) => item.knowledgeObjectId),
    citedProductIds: bundle.shortlist.slice(0, 4).map((item) => item.productId),
    uncertainty: hasKnowledge && hasShortlist ? "low" : "medium",
    refused: false,
    handoffRecommended: true,
  };
}

export function buildOccasionWelcomeLines(
  bundle: TableServiceOccasionBundle,
): readonly string[] {
  const lines: string[] = [];
  if (bundle.occasionPhrase) {
    lines.push(`Let us explore ${bundle.occasionPhrase} together.`);
  }
  if (bundle.intentExplanation) {
    lines.push(bundle.intentExplanation);
  }
  for (const item of bundle.knowledge.slice(0, 2)) {
    lines.push(`${item.title}: ${item.summary}`);
  }
  if (bundle.shortlist.length > 0) {
    const names = bundle.shortlist
      .slice(0, 3)
      .map((item) => item.name)
      .join(", ");
    lines.push(
      `We shortlisted ${bundle.shortlist.length} piece${bundle.shortlist.length === 1 ? "" : "s"} for you${names ? ` — including ${names}` : ""}.`,
    );
    lines.push(
      "Swipe through the shortlist to save favourites, then book an appointment to continue with an advisor.",
    );
  } else {
    lines.push(
      "An advisor can refine this with you — message us any time using Talk to an advisor.",
    );
  }
  return lines;
}
