/**
 * Maps consented interaction events to StyleProfile evidence hints.
 * Producers resolve product concept assignments when properties omit IDs.
 */

import type { MetadataConceptId } from "../shared/branded-id";

import type { InteractionEventName } from "./interaction-event";
import type { EvidencePolarity } from "./style-profile";

export interface InteractionStyleEvidenceHint {
  readonly conceptId: MetadataConceptId;
  readonly polarity: EvidencePolarity;
  readonly confidence: number;
}

const DEFAULT_CONFIDENCE: Partial<Record<InteractionEventName, number>> = {
  product_favorited: 0.9,
  product_skipped: 0.85,
  product_viewed: 0.35,
  filter_applied: 0.75,
  search_performed: 0.5,
  category_browsed: 0.55,
  knowledge_opened: 0.7,
  cart_updated: 0.65,
  advisor_question: 0.6,
  appointment_intent: 0.8,
  conversion_recorded: 0.95,
};

const DEFAULT_POLARITY: Partial<
  Record<InteractionEventName, EvidencePolarity>
> = {
  product_favorited: "positive",
  product_skipped: "negative",
  product_viewed: "neutral",
  filter_applied: "positive",
  search_performed: "neutral",
  category_browsed: "neutral",
  knowledge_opened: "positive",
  cart_updated: "positive",
  advisor_question: "neutral",
  appointment_intent: "positive",
  conversion_recorded: "positive",
};

function readConceptIds(
  properties: Readonly<Record<string, unknown>>,
): MetadataConceptId[] {
  const ids: MetadataConceptId[] = [];
  const single = properties["conceptId"];
  if (typeof single === "string") {
    ids.push(single as MetadataConceptId);
  }
  const many = properties["conceptIds"];
  if (Array.isArray(many)) {
    for (const value of many) {
      if (typeof value === "string") {
        ids.push(value as MetadataConceptId);
      }
    }
  }
  return ids;
}

export function interactionStyleEvidenceHints(args: {
  readonly name: InteractionEventName;
  readonly properties: Readonly<Record<string, unknown>>;
  readonly acceptedConceptIds?: readonly MetadataConceptId[];
}): readonly InteractionStyleEvidenceHint[] {
  const polarity = DEFAULT_POLARITY[args.name] ?? "neutral";
  const confidence = DEFAULT_CONFIDENCE[args.name] ?? 0.5;

  const fromProperties = readConceptIds(args.properties);
  const conceptIds =
    fromProperties.length > 0
      ? fromProperties
      : (args.acceptedConceptIds ?? []);

  return conceptIds.map((conceptId) => ({
    conceptId,
    polarity,
    confidence,
  }));
}
