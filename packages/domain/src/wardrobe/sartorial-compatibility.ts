/**
 * Explainable sartorial compatibility rules (ROAD-002, ADR-060 / PHASE 4.2).
 * Every outfit suggestion cites approved knowledge and owned/catalogue facts.
 */

import type { MetadataEdgeKind } from "../metadata/metadata";
import type {
  KnowledgeObjectId,
  MetadataConceptId,
  ProductId,
  WardrobeItemId,
} from "../shared/branded-id";

import type { OutfitSlotKind } from "./outfit";

export const SARTORIAL_COMPATIBILITY_FACTOR_CODES = [
  "approved_rule",
  "concept_compatible",
  "concept_incompatible",
  "slot_missing",
  "item_unavailable",
  "occasion_match",
] as const;

export type SartorialCompatibilityFactorCode =
  (typeof SARTORIAL_COMPATIBILITY_FACTOR_CODES)[number];

export interface SartorialCompatibilityFactor {
  readonly code: SartorialCompatibilityFactorCode;
  readonly label: string;
  readonly weight: number;
  readonly conceptId?: MetadataConceptId;
  readonly knowledgeObjectId?: KnowledgeObjectId;
  readonly slotKind?: OutfitSlotKind;
}

export interface SartorialRuleCitation {
  readonly knowledgeObjectId: KnowledgeObjectId;
  readonly title: string;
  readonly explanation: string;
  readonly slotKindA?: OutfitSlotKind;
  readonly slotKindB?: OutfitSlotKind;
}

export interface SartorialSlotFact {
  readonly slotKind: OutfitSlotKind;
  readonly displayLabel: string;
  readonly wardrobeItemId?: WardrobeItemId;
  readonly productId?: ProductId;
  readonly conceptIds: readonly MetadataConceptId[];
  readonly available: boolean;
}

export interface SartorialConceptEdge {
  readonly sourceConceptId: MetadataConceptId;
  readonly targetConceptId: MetadataConceptId;
  readonly kind: MetadataEdgeKind;
}

export interface SartorialApprovedRule {
  readonly knowledgeObjectId: KnowledgeObjectId;
  readonly title: string;
  readonly summary: string;
  readonly conceptIds: readonly MetadataConceptId[];
}

export interface EvaluateOutfitCompatibilityInput {
  readonly slots: readonly SartorialSlotFact[];
  readonly rules: readonly SartorialApprovedRule[];
  readonly conceptEdges: readonly SartorialConceptEdge[];
  readonly occasionConceptIds?: readonly MetadataConceptId[];
}

export interface SartorialCompatibilityConflict {
  readonly code: "incompatible_concepts" | "missing_slot" | "unavailable_item";
  readonly message: string;
  readonly slotKind?: OutfitSlotKind;
  readonly conceptIdA?: MetadataConceptId;
  readonly conceptIdB?: MetadataConceptId;
}

export interface EvaluateOutfitCompatibilityResult {
  readonly compatible: boolean;
  readonly score: number;
  readonly factors: readonly SartorialCompatibilityFactor[];
  readonly citations: readonly SartorialRuleCitation[];
  readonly conflicts: readonly SartorialCompatibilityConflict[];
}

function uniqueConceptIds(
  slots: readonly SartorialSlotFact[],
): MetadataConceptId[] {
  const seen = new Set<string>();
  const result: MetadataConceptId[] = [];
  for (const slot of slots) {
    for (const conceptId of slot.conceptIds) {
      if (!seen.has(conceptId)) {
        seen.add(conceptId);
        result.push(conceptId);
      }
    }
  }
  return result;
}

function findEdge(
  edges: readonly SartorialConceptEdge[],
  a: MetadataConceptId,
  b: MetadataConceptId,
): SartorialConceptEdge | undefined {
  return edges.find(
    (edge) =>
      (edge.sourceConceptId === a && edge.targetConceptId === b) ||
      (edge.sourceConceptId === b && edge.targetConceptId === a),
  );
}

function matchingRules(
  rules: readonly SartorialApprovedRule[],
  conceptIds: readonly MetadataConceptId[],
): SartorialApprovedRule[] {
  const conceptSet = new Set(conceptIds);
  return rules.filter((rule) =>
    rule.conceptIds.some((id) => conceptSet.has(id)),
  );
}

const CORE_SLOTS: readonly OutfitSlotKind[] = [
  "jacket",
  "trousers",
  "shirt",
  "shoes",
];

/**
 * Deterministic outfit compatibility check. Conflicts fail closed; every
 * positive factor must cite an approved rule or concept edge.
 */
export function evaluateOutfitCompatibility(
  input: EvaluateOutfitCompatibilityInput,
): EvaluateOutfitCompatibilityResult {
  const factors: SartorialCompatibilityFactor[] = [];
  const citations: SartorialRuleCitation[] = [];
  const conflicts: SartorialCompatibilityConflict[] = [];
  let score = 0;

  const slotsByKind = new Map(
    input.slots.map((slot) => [slot.slotKind, slot] as const),
  );

  for (const coreSlot of CORE_SLOTS) {
    const slot = slotsByKind.get(coreSlot);
    if (!slot) {
      conflicts.push({
        code: "missing_slot",
        message: `Complete look is missing ${coreSlot.replace("_", " ")}.`,
        slotKind: coreSlot,
      });
      factors.push({
        code: "slot_missing",
        label: `Missing ${coreSlot}`,
        weight: -1,
        slotKind: coreSlot,
      });
      continue;
    }
    if (!slot.available) {
      conflicts.push({
        code: "unavailable_item",
        message: `${slot.displayLabel} is unavailable for this look.`,
        slotKind: coreSlot,
      });
      factors.push({
        code: "item_unavailable",
        label: `${slot.displayLabel} unavailable`,
        weight: -0.5,
        slotKind: coreSlot,
      });
    }
  }

  const allConceptIds = uniqueConceptIds(input.slots);
  for (let i = 0; i < allConceptIds.length; i += 1) {
    for (let j = i + 1; j < allConceptIds.length; j += 1) {
      const a = allConceptIds[i]!;
      const b = allConceptIds[j]!;
      const edge = findEdge(input.conceptEdges, a, b);
      if (edge?.kind === "incompatible_with") {
        conflicts.push({
          code: "incompatible_concepts",
          message: "Two pieces cite incompatible metadata concepts.",
          conceptIdA: a,
          conceptIdB: b,
        });
        factors.push({
          code: "concept_incompatible",
          label: "Incompatible concept pairing",
          weight: -1,
          conceptId: a,
        });
      } else if (edge?.kind === "compatible_with") {
        score += 0.25;
        factors.push({
          code: "concept_compatible",
          label: "Compatible concept pairing",
          weight: 0.25,
          conceptId: a,
        });
      }
    }
  }

  const matchedRules = matchingRules(input.rules, allConceptIds);
  for (const rule of matchedRules) {
    score += 0.5;
    factors.push({
      code: "approved_rule",
      label: rule.title,
      weight: 0.5,
      knowledgeObjectId: rule.knowledgeObjectId,
    });
    citations.push({
      knowledgeObjectId: rule.knowledgeObjectId,
      title: rule.title,
      explanation: rule.summary,
    });
  }

  if (input.occasionConceptIds && input.occasionConceptIds.length > 0) {
    const occasionSet = new Set(input.occasionConceptIds);
    const overlap = allConceptIds.filter((id) => occasionSet.has(id));
    if (overlap.length > 0) {
      score += 0.25;
      const firstOverlap = overlap[0];
      if (firstOverlap) {
        factors.push({
          code: "occasion_match",
          label: "Occasion concept overlap",
          weight: 0.25,
          conceptId: firstOverlap,
        });
      }
    }
  }

  const compatible = conflicts.length === 0 && citations.length > 0;

  return {
    compatible,
    score,
    factors,
    citations,
    conflicts,
  };
}

export function buildOutfitRuleCitations(
  result: EvaluateOutfitCompatibilityResult,
): readonly SartorialRuleCitation[] {
  return result.citations;
}

export function isExplanationComplete(
  result: EvaluateOutfitCompatibilityResult,
): boolean {
  if (result.conflicts.length > 0) {
    return result.conflicts.every((c) => c.message.trim().length > 0);
  }
  return (
    result.citations.length > 0 &&
    result.citations.every(
      (c) => c.title.trim().length > 0 && c.explanation.trim().length > 0,
    )
  );
}
