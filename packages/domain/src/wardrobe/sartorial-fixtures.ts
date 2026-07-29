/**
 * Neutral reviewed sartorial rule fixtures for PHASE 4.2.
 * These enable explainable claims without inventing founder-only judgement.
 * Claims that require missing founder-authored rules remain unfounded.
 */

import { asId } from "../shared/branded-id";

import type { SartorialRule } from "./sartorial";

const now = "2026-07-30T00:00:00.000Z";

function rule(
  partial: Omit<SartorialRule, "createdAt" | "updatedAt" | "reviewStatus"> & {
    readonly reviewStatus?: SartorialRule["reviewStatus"];
  },
): SartorialRule {
  return {
    ...partial,
    reviewStatus: partial.reviewStatus ?? "accepted",
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Seeded canonical slot-compatibility rules covering ROAD-002 complete-look
 * pairs. Fabric/colour/formality founder nuance remains proposal-only until
 * authored; those claims fail closed without accepted rules.
 */
export const NEUTRAL_SARTORIAL_RULE_FIXTURES: readonly SartorialRule[] = [
  rule({
    id: asId<"SartorialRuleId">("00000000-0000-4000-8000-00000000a001"),
    ownershipKind: "canonical",
    slug: "jacket-trousers-foundation",
    title: "Jacket and trousers form the tailored foundation",
    summary:
      "A complete look pairs jacket and trousers under approved guidance.",
    ruleKind: "slot_compatibility",
    relation: "requires",
    subjectSlotKind: "jacket",
    objectSlotKind: "trousers",
    explanation:
      "Approved rule: a complete tailored look requires jacket and trousers together.",
  }),
  rule({
    id: asId<"SartorialRuleId">("00000000-0000-4000-8000-00000000a002"),
    ownershipKind: "canonical",
    slug: "jacket-shirt-layer",
    title: "Jacket sits over a shirt",
    summary: "Shirt completes the jacket layer of a look.",
    ruleKind: "slot_compatibility",
    relation: "requires",
    subjectSlotKind: "jacket",
    objectSlotKind: "shirt",
    explanation:
      "Approved rule: jacket looks cite a shirt layer for a complete outfit.",
  }),
  rule({
    id: asId<"SartorialRuleId">("00000000-0000-4000-8000-00000000a003"),
    ownershipKind: "canonical",
    slug: "trousers-shirt-balance",
    title: "Trousers and shirt balance the mid-layer",
    summary: "Shirt and trousers must both be present for completeness.",
    ruleKind: "slot_compatibility",
    relation: "compatible",
    subjectSlotKind: "trousers",
    objectSlotKind: "shirt",
    explanation:
      "Approved rule: trousers and shirt are compatible partners in a complete look.",
  }),
  rule({
    id: asId<"SartorialRuleId">("00000000-0000-4000-8000-00000000a004"),
    ownershipKind: "canonical",
    slug: "jacket-shoes-grounding",
    title: "Shoes ground the jacket look",
    summary: "Complete looks include shoes with the jacket.",
    ruleKind: "slot_compatibility",
    relation: "requires",
    subjectSlotKind: "jacket",
    objectSlotKind: "shoes",
    explanation:
      "Approved rule: a complete look includes shoes grounding the jacket outfit.",
  }),
  rule({
    id: asId<"SartorialRuleId">("00000000-0000-4000-8000-00000000a005"),
    ownershipKind: "canonical",
    slug: "shirt-accessories-finish",
    title: "Accessories finish the shirt layer",
    summary: "Accessories complete the shirt-facing details of a look.",
    ruleKind: "slot_compatibility",
    relation: "prefers",
    subjectSlotKind: "shirt",
    objectSlotKind: "accessories",
    explanation:
      "Approved rule: accessories finish the shirt layer of a complete look.",
  }),
  rule({
    id: asId<"SartorialRuleId">("00000000-0000-4000-8000-00000000a006"),
    ownershipKind: "canonical",
    slug: "jacket-pocket-square",
    title: "Pocket square accompanies the jacket",
    summary: "Pocket squares belong with the jacket breast pocket.",
    ruleKind: "slot_compatibility",
    relation: "compatible",
    subjectSlotKind: "jacket",
    objectSlotKind: "pocket_square",
    explanation:
      "Approved rule: pocket squares are compatible with jacket breast-pocket placement.",
  }),
  rule({
    id: asId<"SartorialRuleId">("00000000-0000-4000-8000-00000000a007"),
    ownershipKind: "canonical",
    slug: "shirt-pocket-square-harmony",
    title: "Pocket square relates to the shirt",
    summary: "Pocket square colour/formality references the shirt.",
    ruleKind: "slot_compatibility",
    relation: "prefers",
    subjectSlotKind: "shirt",
    objectSlotKind: "pocket_square",
    explanation:
      "Approved rule: pocket-square choices prefer harmony with the shirt.",
  }),
];
