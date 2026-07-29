/**
 * Approved sartorial rules and explainable outfit compatibility
 * (ROAD-002, ENG-002 / ADR-060 / ADR-063 / PHASE 4.2).
 *
 * Every compatibility claim must cite an accepted founder/retailer rule and
 * owned or catalogue facts. Unreviewed generic menswear assertions fail closed.
 */

import type { GarmentCategoryCode } from "../production/production";
import type {
  KnowledgeObjectId,
  MetadataConceptId,
  ProductId,
  RetailerId,
  SartorialRuleId,
  StaffId,
  WardrobeItemId,
} from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";

export const OUTFIT_SLOT_KINDS = [
  "jacket",
  "trousers",
  "shirt",
  "shoes",
  "accessories",
  "pocket_square",
] as const;

export type OutfitSlotKind = (typeof OUTFIT_SLOT_KINDS)[number];

export const SARTORIAL_OWNERSHIP_KINDS = ["canonical", "retailer"] as const;

export type SartorialOwnershipKind = (typeof SARTORIAL_OWNERSHIP_KINDS)[number];

export const SARTORIAL_RULE_KINDS = [
  "slot_compatibility",
  "fabric",
  "colour",
  "formality",
  "occasion",
  "complete_look",
] as const;

export type SartorialRuleKind = (typeof SARTORIAL_RULE_KINDS)[number];

export const SARTORIAL_RELATIONS = [
  "compatible",
  "incompatible",
  "requires",
  "prefers",
] as const;

export type SartorialRelation = (typeof SARTORIAL_RELATIONS)[number];

export const SARTORIAL_REVIEW_STATUSES = [
  "pending",
  "accepted",
  "rejected",
] as const;

export type SartorialReviewStatus = (typeof SARTORIAL_REVIEW_STATUSES)[number];

export interface SartorialRule extends Timestamps {
  readonly id: SartorialRuleId;
  readonly ownershipKind: SartorialOwnershipKind;
  readonly retailerId?: RetailerId;
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly ruleKind: SartorialRuleKind;
  readonly relation: SartorialRelation;
  readonly reviewStatus: SartorialReviewStatus;
  readonly subjectSlotKind?: OutfitSlotKind;
  readonly objectSlotKind?: OutfitSlotKind;
  readonly subjectConceptId?: MetadataConceptId;
  readonly objectConceptId?: MetadataConceptId;
  readonly knowledgeObjectId?: KnowledgeObjectId;
  readonly explanation: string;
  readonly createdByStaffId?: StaffId;
  readonly reviewedByStaffId?: StaffId;
  readonly reviewedAt?: string;
  readonly deletedAt?: string;
}

export type CompatibilityFactSourceKind =
  "wardrobe_item" | "catalogue_product" | "accepted_concept";

export interface CompatibilityFactCitation {
  readonly sourceKind: CompatibilityFactSourceKind;
  readonly sourceId: WardrobeItemId | ProductId | MetadataConceptId | string;
  readonly label: string;
  readonly detail: string;
}

export interface CompatibilityRuleCitation {
  readonly ruleId: SartorialRuleId;
  readonly ruleTitle: string;
  readonly relation: SartorialRelation;
  readonly explanation: string;
}

export const COMPATIBILITY_CLAIM_STATUSES = [
  "compatible",
  "conflict",
  "unavailable",
  "unfounded",
] as const;

export type CompatibilityClaimStatus =
  (typeof COMPATIBILITY_CLAIM_STATUSES)[number];

export interface CompatibilityClaim {
  readonly status: CompatibilityClaimStatus;
  readonly subjectSlotKind: OutfitSlotKind;
  readonly objectSlotKind: OutfitSlotKind;
  readonly summary: string;
  readonly facts: readonly CompatibilityFactCitation[];
  readonly rules: readonly CompatibilityRuleCitation[];
}

export interface OutfitSlotFact {
  readonly slotKind: OutfitSlotKind;
  readonly label: string;
  readonly available: boolean;
  readonly wardrobeItemId?: WardrobeItemId;
  readonly productId?: ProductId;
  readonly categoryCode?: GarmentCategoryCode;
  readonly conceptIds: readonly MetadataConceptId[];
}

/**
 * Map wardrobe/production garment categories onto complete-look slots.
 * Categories without a dedicated ROAD-002 slot return null.
 */
export function garmentCategoryToOutfitSlot(
  category: GarmentCategoryCode,
): OutfitSlotKind | null {
  switch (category) {
    case "jacket":
    case "suit":
    case "overcoat":
    case "coat":
    case "formalwear":
      return "jacket";
    case "trousers":
    case "denim":
      return "trousers";
    case "shirt":
    case "knitwear":
      return "shirt";
    case "shoes":
      return "shoes";
    case "pocket_square":
      return "pocket_square";
    case "accessories":
    case "leather":
    case "waistcoat":
      return "accessories";
    case "other":
      return null;
  }
}

export function isApprovedSartorialRule(rule: {
  readonly reviewStatus: SartorialReviewStatus;
  readonly deletedAt?: string | null;
}): boolean {
  return rule.reviewStatus === "accepted" && !rule.deletedAt;
}

export function isSartorialRuleTenantCompatible(rule: {
  readonly ownershipKind: SartorialOwnershipKind;
  readonly retailerId?: RetailerId | string | null;
}): boolean {
  if (rule.ownershipKind === "canonical") {
    return rule.retailerId === undefined || rule.retailerId === null;
  }
  return (
    rule.retailerId !== undefined &&
    rule.retailerId !== null &&
    rule.retailerId !== ""
  );
}

export function canUseSartorialRuleForRetailer(params: {
  readonly rule: {
    readonly ownershipKind: SartorialOwnershipKind;
    readonly retailerId?: RetailerId | string | null;
    readonly reviewStatus: SartorialReviewStatus;
    readonly deletedAt?: string | null;
  };
  readonly retailerId: RetailerId | string;
}): boolean {
  if (!isApprovedSartorialRule(params.rule)) {
    return false;
  }
  if (params.rule.ownershipKind === "canonical") {
    return true;
  }
  return params.rule.retailerId === params.retailerId;
}

export type SartorialReviewTransitionIssue =
  | "already_terminal"
  | "invalid_decision"
  | "canonical_requires_platform"
  | "retailer_requires_staff";

/**
 * Terminal review only from pending. Accepted/rejected are terminal.
 */
export function sartorialReviewTransitionIssues(params: {
  readonly currentStatus: SartorialReviewStatus;
  readonly decision: "accepted" | "rejected";
}): readonly SartorialReviewTransitionIssue[] {
  if (params.currentStatus !== "pending") {
    return ["already_terminal"];
  }
  if (params.decision !== "accepted" && params.decision !== "rejected") {
    return ["invalid_decision"];
  }
  return [];
}

function findSlotRules(
  rules: readonly SartorialRule[],
  subject: OutfitSlotKind,
  object: OutfitSlotKind,
): readonly SartorialRule[] {
  return rules.filter(
    (rule) =>
      (rule.ruleKind === "slot_compatibility" ||
        rule.ruleKind === "complete_look") &&
      rule.subjectSlotKind === subject &&
      rule.objectSlotKind === object,
  );
}

function findConceptRules(
  rules: readonly SartorialRule[],
  subjectConcepts: readonly string[],
  objectConcepts: readonly string[],
): readonly SartorialRule[] {
  const subjectSet = new Set(subjectConcepts);
  const objectSet = new Set(objectConcepts);
  return rules.filter((rule) => {
    if (
      rule.ruleKind !== "fabric" &&
      rule.ruleKind !== "colour" &&
      rule.ruleKind !== "formality" &&
      rule.ruleKind !== "occasion"
    ) {
      return false;
    }
    if (!rule.subjectConceptId || !rule.objectConceptId) {
      return false;
    }
    return (
      subjectSet.has(rule.subjectConceptId) &&
      objectSet.has(rule.objectConceptId)
    );
  });
}

function factCitationsForSlot(
  slot: OutfitSlotFact,
): readonly CompatibilityFactCitation[] {
  const facts: CompatibilityFactCitation[] = [];
  if (slot.wardrobeItemId) {
    facts.push({
      sourceKind: "wardrobe_item",
      sourceId: slot.wardrobeItemId,
      label: slot.label,
      detail: `Owned ${slot.slotKind}`,
    });
  }
  if (slot.productId) {
    facts.push({
      sourceKind: "catalogue_product",
      sourceId: slot.productId,
      label: slot.label,
      detail: `Catalogue ${slot.slotKind}`,
    });
  }
  for (const conceptId of slot.conceptIds) {
    facts.push({
      sourceKind: "accepted_concept",
      sourceId: conceptId,
      label: conceptId,
      detail: `Accepted metadata on ${slot.slotKind}`,
    });
  }
  return facts;
}

function toRuleCitation(rule: SartorialRule): CompatibilityRuleCitation {
  return {
    ruleId: rule.id,
    ruleTitle: rule.title,
    relation: rule.relation,
    explanation: rule.explanation,
  };
}

/**
 * Evaluate pairwise slot compatibility for a complete look.
 * Claims without an approved applicable rule are `unfounded` (fail closed).
 * Missing or unavailable items are `unavailable` and never invent compatibility.
 */
export function evaluateOutfitCompatibility(params: {
  readonly retailerId: RetailerId | string;
  readonly slots: readonly OutfitSlotFact[];
  readonly approvedRules: readonly SartorialRule[];
}): readonly CompatibilityClaim[] {
  const usableRules = params.approvedRules.filter((rule) =>
    canUseSartorialRuleForRetailer({
      rule,
      retailerId: params.retailerId,
    }),
  );

  const byKind = new Map<OutfitSlotKind, OutfitSlotFact>();
  for (const slot of params.slots) {
    byKind.set(slot.slotKind, slot);
  }

  const pairs: readonly (readonly [OutfitSlotKind, OutfitSlotKind])[] = [
    ["jacket", "trousers"],
    ["jacket", "shirt"],
    ["trousers", "shirt"],
    ["jacket", "shoes"],
    ["shirt", "accessories"],
    ["jacket", "pocket_square"],
    ["shirt", "pocket_square"],
  ];

  const claims: CompatibilityClaim[] = [];

  for (const [subjectKind, objectKind] of pairs) {
    const subject = byKind.get(subjectKind);
    const object = byKind.get(objectKind);

    if (!subject || !object) {
      claims.push({
        status: "unavailable",
        subjectSlotKind: subjectKind,
        objectSlotKind: objectKind,
        summary: `Complete look is missing ${!subject ? subjectKind : objectKind}.`,
        facts: [],
        rules: [],
      });
      continue;
    }

    if (!subject.available || !object.available) {
      claims.push({
        status: "unavailable",
        subjectSlotKind: subjectKind,
        objectSlotKind: objectKind,
        summary: `${!subject.available ? subject.label : object.label} is unavailable.`,
        facts: [
          ...factCitationsForSlot(subject),
          ...factCitationsForSlot(object),
        ],
        rules: [],
      });
      continue;
    }

    const slotRules = findSlotRules(usableRules, subjectKind, objectKind);
    const conceptRules = findConceptRules(
      usableRules,
      subject.conceptIds,
      object.conceptIds,
    );
    const applicable = [...slotRules, ...conceptRules];

    if (applicable.length === 0) {
      claims.push({
        status: "unfounded",
        subjectSlotKind: subjectKind,
        objectSlotKind: objectKind,
        summary:
          "No approved sartorial rule covers this pairing; compatibility is not asserted.",
        facts: [
          ...factCitationsForSlot(subject),
          ...factCitationsForSlot(object),
        ],
        rules: [],
      });
      continue;
    }

    const conflicts = applicable.filter(
      (rule) => rule.relation === "incompatible",
    );
    const supports = applicable.filter(
      (rule) => rule.relation !== "incompatible",
    );
    const facts = [
      ...factCitationsForSlot(subject),
      ...factCitationsForSlot(object),
    ];

    if (conflicts.length > 0) {
      claims.push({
        status: "conflict",
        subjectSlotKind: subjectKind,
        objectSlotKind: objectKind,
        summary: conflicts[0]?.explanation ?? "Approved rule marks a conflict.",
        facts,
        rules: conflicts.map(toRuleCitation),
      });
      continue;
    }

    claims.push({
      status: "compatible",
      subjectSlotKind: subjectKind,
      objectSlotKind: objectKind,
      summary:
        supports[0]?.explanation ?? "Approved rule supports this pairing.",
      facts,
      rules: supports.map(toRuleCitation),
    });
  }

  return claims;
}

export function isCompleteLookCovered(
  slots: readonly OutfitSlotFact[],
): boolean {
  return OUTFIT_SLOT_KINDS.every((kind) => {
    const slot = slots.find((entry) => entry.slotKind === kind);
    return Boolean(slot?.available);
  });
}
