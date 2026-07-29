/**
 * Grounded TableService answers and occasion guidance (ADV-001, ADV-002,
 * ENG-002 / ADR-060 / PHASE 3.4). AI may only cite approved knowledge
 * objects and catalogue shortlist products from an explicit allowlist.
 */

import type { CatalogueRelevanceFactor } from "../catalog/catalogue-query";
import type { ConversationIntent } from "../engagement/messaging";
import type {
  KnowledgeDiscoveryResult,
  KnowledgeDiscoveryScoreFactor,
} from "../knowledge/knowledge-discovery";
import type {
  KnowledgeObjectId,
  ProductId,
  ProductVariantId,
  RetailerId,
} from "../shared/branded-id";

export const GROUNDED_ANSWER_STATUSES = [
  "answered",
  "uncertain",
  "refused",
] as const;

export type GroundedAnswerStatus = (typeof GROUNDED_ANSWER_STATUSES)[number];

export const GROUNDED_CITATION_KINDS = ["knowledge", "product"] as const;

export type GroundedCitationKind = (typeof GROUNDED_CITATION_KINDS)[number];

export const GROUNDED_REFUSAL_REASONS = [
  "no_approved_basis",
  "citation_outside_allowlist",
  "unsupported_question",
  "provider_unavailable_without_basis",
] as const;

export type GroundedRefusalReason = (typeof GROUNDED_REFUSAL_REASONS)[number];

export interface GroundedCitation {
  readonly kind: GroundedCitationKind;
  readonly id: KnowledgeObjectId | ProductId;
  readonly title: string;
  readonly excerpt?: string;
}

export interface GroundedAnswerAllowlist {
  readonly knowledgeObjectIds: ReadonlySet<string>;
  readonly productIds: ReadonlySet<string>;
}

export interface GroundedAnswer {
  readonly status: GroundedAnswerStatus;
  readonly answerText: string;
  readonly uncertaintyNote?: string;
  readonly citations: readonly GroundedCitation[];
  readonly refusalReason?: GroundedRefusalReason;
  /** Advisor-first handoff must remain available even when AI answers. */
  readonly handoffRecommended: boolean;
}

export interface GroundedShortlistItem {
  readonly productId: ProductId;
  readonly productVariantId?: ProductVariantId;
  readonly name: string;
  readonly slug?: string;
  readonly explanation: string;
  readonly factors: readonly CatalogueRelevanceFactor[];
  readonly matchedConceptIds: readonly string[];
}

export interface GroundedKnowledgeCard {
  readonly knowledgeObjectId: KnowledgeObjectId;
  readonly title: string;
  readonly summary: string;
  readonly factors: readonly KnowledgeDiscoveryScoreFactor[];
  readonly matchedConceptIds: readonly string[];
}

export interface OccasionGuidancePlan {
  readonly retailerId: RetailerId;
  readonly occasionLabel: string;
  readonly occasionQuery: string;
  readonly intent?: ConversationIntent;
  readonly answer: GroundedAnswer;
  readonly shortlist: readonly GroundedShortlistItem[];
  readonly knowledgeCards: readonly GroundedKnowledgeCard[];
  readonly swipePath: string;
  readonly appointmentPath: string;
  readonly messagesPath: string;
  readonly handoffVisible: true;
}

export interface BuildOccasionGuidanceInput {
  readonly retailerId: RetailerId;
  readonly slug: string;
  readonly occasionQuery: string;
  readonly occasionLabel: string;
  readonly intent?: ConversationIntent;
  readonly question?: string;
  readonly knowledgeResults: readonly KnowledgeDiscoveryResult[];
  readonly knowledgeById: ReadonlyMap<
    string,
    { readonly title: string; readonly summary: string }
  >;
  readonly shortlist: readonly GroundedShortlistItem[];
  /** Optional AI-authored answer already citation-validated. */
  readonly aiAnswer?: GroundedAnswer;
}

export function buildGroundedAllowlist(args: {
  readonly knowledgeObjectIds: readonly string[];
  readonly productIds: readonly string[];
}): GroundedAnswerAllowlist {
  return {
    knowledgeObjectIds: new Set(args.knowledgeObjectIds),
    productIds: new Set(args.productIds),
  };
}

export function citationsWithinAllowlist(
  citations: readonly GroundedCitation[],
  allowlist: GroundedAnswerAllowlist,
): boolean {
  return citations.every((citation) => {
    if (citation.kind === "knowledge") {
      return allowlist.knowledgeObjectIds.has(citation.id);
    }
    return allowlist.productIds.has(citation.id);
  });
}

/**
 * Fail closed: any citation outside the approved retrieval set refuses
 * the answer. Empty citations with an "answered" status also refuse.
 */
export function validateGroundedAnswer(
  answer: GroundedAnswer,
  allowlist: GroundedAnswerAllowlist,
): GroundedAnswer {
  if (answer.status === "refused") {
    return {
      ...answer,
      handoffRecommended: true,
    };
  }

  if (answer.citations.length === 0) {
    return refuseGroundedAnswer("no_approved_basis");
  }

  if (!citationsWithinAllowlist(answer.citations, allowlist)) {
    return refuseGroundedAnswer("citation_outside_allowlist");
  }

  return {
    ...answer,
    handoffRecommended: true,
  };
}

export function refuseGroundedAnswer(
  reason: GroundedRefusalReason,
  detail?: string,
): GroundedAnswer {
  const base =
    "I don't have approved knowledge to answer that confidently yet. An advisor can help in person or over message.";
  return {
    status: "refused",
    answerText: detail && detail.trim().length > 0 ? detail.trim() : base,
    citations: [],
    refusalReason: reason,
    handoffRecommended: true,
  };
}

/**
 * Deterministic grounded reply from ranked knowledge + explainable
 * shortlist when no AI provider is configured (PHASE 3.4 hard-blocker note).
 */
export function buildDeterministicGroundedAnswer(args: {
  readonly occasionLabel: string;
  readonly question?: string;
  readonly knowledgeCards: readonly GroundedKnowledgeCard[];
  readonly shortlist: readonly GroundedShortlistItem[];
}): GroundedAnswer {
  const { occasionLabel, knowledgeCards, shortlist } = args;

  if (knowledgeCards.length === 0 && shortlist.length === 0) {
    return refuseGroundedAnswer("no_approved_basis");
  }

  const citations: GroundedCitation[] = [
    ...knowledgeCards.map((card) => ({
      kind: "knowledge" as const,
      id: card.knowledgeObjectId,
      title: card.title,
      excerpt: card.summary.slice(0, 180),
    })),
    ...shortlist.map((item) => ({
      kind: "product" as const,
      id: item.productId,
      title: item.name,
      excerpt: item.explanation,
    })),
  ];

  const knowledgeLine =
    knowledgeCards.length > 0
      ? `From approved PAON knowledge: ${knowledgeCards
          .slice(0, 3)
          .map((card) => card.title)
          .join("; ")}.`
      : "";

  const shortlistLine =
    shortlist.length > 0
      ? `Preliminary shortlist: ${shortlist
          .slice(0, 4)
          .map((item) => item.name)
          .join(", ")}.`
      : "";

  const uncertainty =
    "In-store fabric books and advisor expertise refine the final choice — this is a starting point, not a final recommendation.";

  const answerText = [
    `For ${occasionLabel}, here is a grounded starting point.`,
    knowledgeLine,
    shortlistLine,
    uncertainty,
  ]
    .filter((line) => line.length > 0)
    .join(" ");

  return {
    status: knowledgeCards.length === 0 ? "uncertain" : "answered",
    answerText,
    uncertaintyNote: uncertainty,
    citations,
    handoffRecommended: true,
  };
}

export function resolveOccasionQuery(args: {
  readonly intent?: ConversationIntent;
  readonly caption?: string;
  readonly freeText?: string;
}): { readonly query: string; readonly label: string } {
  const text = `${args.caption ?? ""} ${args.freeText ?? ""}`.toLowerCase();

  if (
    text.includes("summer") &&
    (text.includes("wedding") || text.includes("married"))
  ) {
    return { query: "summer wedding", label: "a summer wedding" };
  }
  if (
    args.intent === "wedding" ||
    text.includes("wedding") ||
    text.includes("married") ||
    text.includes("guest")
  ) {
    return { query: "summer wedding", label: "a wedding occasion" };
  }
  if (args.intent === "shirts" || text.includes("shirt")) {
    return { query: "shirts formality", label: "new shirts" };
  }
  if (args.intent === "style_help" || text.includes("style")) {
    return { query: "formality", label: "finding your style" };
  }
  if (args.freeText && args.freeText.trim().length > 0) {
    return {
      query: args.freeText.trim().slice(0, 120),
      label: "your request",
    };
  }
  return { query: "wedding", label: "your occasion" };
}

export function buildOccasionGuidancePlan(
  input: BuildOccasionGuidanceInput,
): OccasionGuidancePlan {
  const knowledgeCards: GroundedKnowledgeCard[] = input.knowledgeResults.map(
    (result) => {
      const meta = input.knowledgeById.get(result.knowledgeObjectId);
      return {
        knowledgeObjectId: result.knowledgeObjectId,
        title: meta?.title ?? result.presentation.title,
        summary: meta?.summary ?? result.presentation.summary,
        factors: result.factors,
        matchedConceptIds: result.matchedConceptIds.map(String),
      };
    },
  );

  const allowlist = buildGroundedAllowlist({
    knowledgeObjectIds: knowledgeCards.map((card) => card.knowledgeObjectId),
    productIds: input.shortlist.map((item) => item.productId),
  });

  const rawAnswer =
    input.aiAnswer ??
    buildDeterministicGroundedAnswer({
      occasionLabel: input.occasionLabel,
      ...(input.question ? { question: input.question } : {}),
      knowledgeCards,
      shortlist: input.shortlist,
    });

  const answer = validateGroundedAnswer(rawAnswer, allowlist);

  const productIdsParam = input.shortlist
    .map((item) => item.productId)
    .join(",");
  const swipeQuery = new URLSearchParams({
    occasion: input.occasionQuery,
    ...(productIdsParam.length > 0 ? { products: productIdsParam } : {}),
  });
  const appointmentQuery = new URLSearchParams({
    occasion: input.occasionLabel,
    ...(productIdsParam.length > 0 ? { shortlist: productIdsParam } : {}),
  });

  return {
    retailerId: input.retailerId,
    occasionLabel: input.occasionLabel,
    occasionQuery: input.occasionQuery,
    ...(input.intent ? { intent: input.intent } : {}),
    answer,
    shortlist: input.shortlist,
    knowledgeCards,
    swipePath: `/r/${input.slug}/swipe?${swipeQuery.toString()}`,
    appointmentPath: `/r/${input.slug}/appointments?${appointmentQuery.toString()}`,
    messagesPath: `/messages`,
    handoffVisible: true,
  };
}

/**
 * Human-readable chat lines including CTAs for the TableService widget.
 */
export function formatGuidanceWidgetLines(
  plan: OccasionGuidancePlan,
): readonly string[] {
  const lines: string[] = [plan.answer.answerText];

  if (plan.answer.citations.length > 0) {
    lines.push(
      `Cited: ${plan.answer.citations
        .slice(0, 4)
        .map((citation) => citation.title)
        .join("; ")}.`,
    );
  }

  lines.push(
    "Advisor handoff stays open — message us or book an appointment. Fabric books and advisor expertise refine this shortlist in store.",
  );

  if (plan.shortlist.length > 0) {
    lines.push(`Explore & swipe: ${plan.swipePath}`);
  }

  lines.push(`Book advisor: ${plan.appointmentPath}`);
  lines.push(`Message advisor: ${plan.messagesPath}`);

  return lines;
}
