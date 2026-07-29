/**
 * Tailoring milestones and premium rewards
 * (MILE-001, MILE-002 / PHASE 5.2).
 *
 * Eligibility derives idempotently from authoritative orders and accepted
 * catalogue metadata. Awards write only through the existing loyalty ledger
 * (`earn_bonus` / `adjustment_manual`) — never a second balance.
 */

import type { OrderStatus } from "../commerce/order";
import type {
  CustomerId,
  LoyaltyAccountId,
  LoyaltyLedgerEntryId,
  LoyaltyMilestoneAwardId,
  LoyaltyMilestoneDefinitionId,
  MetadataConceptId,
  OrderId,
  RetailerId,
} from "../shared/branded-id";

export const LOYALTY_MILESTONE_KINDS = [
  "first_commission",
  "repeat_order",
  "new_category",
  "premium_construction",
  "advanced_fabric",
  "custom",
] as const;

export type LoyaltyMilestoneKind = (typeof LOYALTY_MILESTONE_KINDS)[number];

export const LOYALTY_BUILT_IN_MILESTONE_KINDS = [
  "first_commission",
  "repeat_order",
  "new_category",
  "premium_construction",
  "advanced_fabric",
] as const satisfies readonly Exclude<LoyaltyMilestoneKind, "custom">[];

export type LoyaltyBuiltInMilestoneKind =
  (typeof LOYALTY_BUILT_IN_MILESTONE_KINDS)[number];

export const LOYALTY_MILESTONE_AWARD_STATUSES = [
  "awarded",
  "reversed",
] as const;

export type LoyaltyMilestoneAwardStatus =
  (typeof LOYALTY_MILESTONE_AWARD_STATUSES)[number];

/** Order statuses that unlock milestone evaluation. */
export const LOYALTY_MILESTONE_QUALIFYING_STATUSES = [
  "delivered",
  "completed",
] as const satisfies readonly OrderStatus[];

export type LoyaltyMilestoneQualifyingStatus =
  (typeof LOYALTY_MILESTONE_QUALIFYING_STATUSES)[number];

/** Order statuses that reverse awards tied to that order. */
export const LOYALTY_MILESTONE_VOIDING_STATUSES = [
  "canceled",
  "refunded",
] as const satisfies readonly OrderStatus[];

export type LoyaltyMilestoneVoidingStatus =
  (typeof LOYALTY_MILESTONE_VOIDING_STATUSES)[number];

/** Default restrained points — capped, never chance-based. */
export const LOYALTY_MILESTONE_DEFAULT_POINTS: Record<
  LoyaltyBuiltInMilestoneKind,
  number
> = {
  first_commission: 250,
  repeat_order: 150,
  new_category: 200,
  premium_construction: 300,
  advanced_fabric: 300,
};

/** Hard cap per award (MILE-002). */
export const LOYALTY_MILESTONE_POINTS_CAP = 1000;

/** Slug fragments that mark premium construction (accepted concepts). */
export const PREMIUM_CONSTRUCTION_SLUG_HINTS = [
  "full-canvas",
  "fullcanvas",
  "hand-canvas",
  "handcanvas",
  "floating-canvas",
] as const;

/** Slug fragments that mark advanced cloth (fibre concepts / composition). */
export const ADVANCED_FABRIC_SLUG_HINTS = [
  "cashmere",
  "vicuna",
  "vicuña",
  "guanaco",
  "super-150",
  "super150",
  "super-180",
  "super180",
  "lotus",
  "qiviuk",
] as const;

export const LOYALTY_MILESTONE_KIND_LABELS: Record<
  LoyaltyMilestoneKind,
  string
> = {
  first_commission: "First commission",
  repeat_order: "Return to the house",
  new_category: "New category explored",
  premium_construction: "Full-canvas craft",
  advanced_fabric: "Advanced cloth",
  custom: "House milestone",
};

export interface LoyaltyMilestoneDefinition {
  readonly id: LoyaltyMilestoneDefinitionId;
  readonly retailerId: RetailerId;
  readonly kind: LoyaltyMilestoneKind;
  readonly customKey?: string;
  readonly label: string;
  readonly explanation: string;
  readonly points: number;
  readonly matchConceptIds: readonly MetadataConceptId[];
  readonly active: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface LoyaltyMilestoneAward {
  readonly id: LoyaltyMilestoneAwardId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly loyaltyAccountId: LoyaltyAccountId;
  readonly definitionId?: LoyaltyMilestoneDefinitionId;
  readonly kind: LoyaltyMilestoneKind;
  readonly idempotencyKey: string;
  readonly relatedOrderId?: OrderId;
  readonly relatedConceptId?: MetadataConceptId;
  readonly points: number;
  readonly status: LoyaltyMilestoneAwardStatus;
  readonly loyaltyLedgerEntryId?: LoyaltyLedgerEntryId;
  readonly reverseLedgerEntryId?: LoyaltyLedgerEntryId;
  readonly label: string;
  readonly explanation: string;
  readonly awardedAt: string;
  readonly reversedAt?: string;
}

export interface MilestoneConceptRef {
  readonly conceptId: MetadataConceptId;
  readonly kind: string;
  readonly slug: string;
  readonly canonicalName: string;
}

export interface MilestoneOrderLineFacts {
  readonly requiresProduction: boolean;
  readonly garmentTypeConcepts: readonly MilestoneConceptRef[];
  readonly constructionConcepts: readonly MilestoneConceptRef[];
  readonly fibreConcepts: readonly MilestoneConceptRef[];
}

export interface MilestoneOrderFacts {
  readonly orderId: OrderId;
  readonly status: OrderStatus;
  readonly createdAt: string;
  readonly lines: readonly MilestoneOrderLineFacts[];
}

export interface MilestoneAwardSnapshot {
  readonly kind: LoyaltyMilestoneKind;
  readonly idempotencyKey: string;
  readonly status: LoyaltyMilestoneAwardStatus;
  readonly relatedOrderId?: OrderId;
}

export interface MilestoneDefinitionSnapshot {
  readonly id?: LoyaltyMilestoneDefinitionId;
  readonly kind: LoyaltyMilestoneKind;
  readonly customKey?: string;
  readonly label: string;
  readonly explanation: string;
  readonly points: number;
  readonly matchConceptIds: readonly MetadataConceptId[];
  readonly active: boolean;
}

export interface MilestoneAwardCandidate {
  readonly kind: LoyaltyMilestoneKind;
  readonly definitionId?: LoyaltyMilestoneDefinitionId;
  readonly customKey?: string;
  readonly idempotencyKey: string;
  readonly relatedOrderId: OrderId;
  readonly relatedConceptId?: MetadataConceptId;
  readonly points: number;
  readonly label: string;
  readonly explanation: string;
}

export interface MilestoneCorrectionCandidate {
  readonly idempotencyKey: string;
  readonly kind: LoyaltyMilestoneKind;
  readonly relatedOrderId: OrderId;
  readonly points: number;
}

export function isMilestoneQualifyingStatus(
  status: OrderStatus,
): status is LoyaltyMilestoneQualifyingStatus {
  return (LOYALTY_MILESTONE_QUALIFYING_STATUSES as readonly string[]).includes(
    status,
  );
}

export function isMilestoneVoidingStatus(
  status: OrderStatus,
): status is LoyaltyMilestoneVoidingStatus {
  return (LOYALTY_MILESTONE_VOIDING_STATUSES as readonly string[]).includes(
    status,
  );
}

export function clampMilestonePoints(points: number): number {
  if (!Number.isFinite(points) || points <= 0) return 0;
  return Math.min(Math.floor(points), LOYALTY_MILESTONE_POINTS_CAP);
}

export function matchesSlugHints(
  slug: string,
  hints: readonly string[],
): boolean {
  const normalized = slug.toLowerCase().replaceAll("_", "-");
  return hints.some((hint) => {
    const needle = hint.toLowerCase().replaceAll("_", "-");
    return normalized === needle || normalized.includes(needle);
  });
}

export function isPremiumConstructionConcept(
  concept: Pick<MilestoneConceptRef, "kind" | "slug">,
): boolean {
  return (
    concept.kind === "construction" &&
    matchesSlugHints(concept.slug, PREMIUM_CONSTRUCTION_SLUG_HINTS)
  );
}

export function isAdvancedFabricConcept(
  concept: Pick<MilestoneConceptRef, "kind" | "slug">,
): boolean {
  return (
    (concept.kind === "fibre" || concept.kind === "fabric") &&
    matchesSlugHints(concept.slug, ADVANCED_FABRIC_SLUG_HINTS)
  );
}

function activeAwards(
  awards: readonly MilestoneAwardSnapshot[],
): MilestoneAwardSnapshot[] {
  return awards.filter((award) => award.status === "awarded");
}

function hasAward(
  awards: readonly MilestoneAwardSnapshot[],
  kind: LoyaltyMilestoneKind,
  idempotencyKey: string,
): boolean {
  return activeAwards(awards).some(
    (award) => award.kind === kind && award.idempotencyKey === idempotencyKey,
  );
}

function priorQualifyingOrders(
  priorOrders: readonly MilestoneOrderFacts[],
): MilestoneOrderFacts[] {
  return priorOrders
    .filter((order) => isMilestoneQualifyingStatus(order.status))
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function lineHasCommission(line: MilestoneOrderLineFacts): boolean {
  return line.requiresProduction;
}

function orderHasCommission(order: MilestoneOrderFacts): boolean {
  return order.lines.some(lineHasCommission);
}

function garmentTypesInOrder(
  order: MilestoneOrderFacts,
): MilestoneConceptRef[] {
  const seen = new Set<string>();
  const result: MilestoneConceptRef[] = [];
  for (const line of order.lines) {
    for (const concept of line.garmentTypeConcepts) {
      if (seen.has(concept.conceptId)) continue;
      seen.add(concept.conceptId);
      result.push(concept);
    }
  }
  return result;
}

function conceptsMatching(
  order: MilestoneOrderFacts,
  predicate: (concept: MilestoneConceptRef) => boolean,
): MilestoneConceptRef[] {
  const seen = new Set<string>();
  const result: MilestoneConceptRef[] = [];
  for (const line of order.lines) {
    const pool = [
      ...line.constructionConcepts,
      ...line.fibreConcepts,
      ...line.garmentTypeConcepts,
    ];
    for (const concept of pool) {
      if (!predicate(concept) || seen.has(concept.conceptId)) continue;
      seen.add(concept.conceptId);
      result.push(concept);
    }
  }
  return result;
}

function definitionForKind(
  definitions: readonly MilestoneDefinitionSnapshot[],
  kind: LoyaltyBuiltInMilestoneKind,
): MilestoneDefinitionSnapshot | undefined {
  return definitions.find(
    (definition) => definition.kind === kind && definition.active,
  );
}

/**
 * Pure eligibility: given the current order, prior history, active awards,
 * and retailer definitions, return award candidates that have not yet been
 * granted. Replay-safe: already-awarded idempotency keys are skipped.
 */
export function evaluateLoyaltyMilestones(args: {
  readonly definitions: readonly MilestoneDefinitionSnapshot[];
  readonly existingAwards: readonly MilestoneAwardSnapshot[];
  readonly priorOrders: readonly MilestoneOrderFacts[];
  readonly currentOrder: MilestoneOrderFacts;
}): readonly MilestoneAwardCandidate[] {
  if (!isMilestoneQualifyingStatus(args.currentOrder.status)) {
    return [];
  }

  const awards = args.existingAwards;
  const prior = priorQualifyingOrders(args.priorOrders).filter(
    (order) => order.orderId !== args.currentOrder.orderId,
  );
  const candidates: MilestoneAwardCandidate[] = [];

  const firstDef = definitionForKind(args.definitions, "first_commission");
  if (firstDef && orderHasCommission(args.currentOrder)) {
    const priorCommission = prior.some(orderHasCommission);
    const key = "first_commission";
    if (!priorCommission && !hasAward(awards, "first_commission", key)) {
      candidates.push({
        kind: "first_commission",
        ...(firstDef.id ? { definitionId: firstDef.id } : {}),
        idempotencyKey: key,
        relatedOrderId: args.currentOrder.orderId,
        points: clampMilestonePoints(firstDef.points),
        label: firstDef.label,
        explanation: firstDef.explanation,
      });
    }
  }

  const repeatDef = definitionForKind(args.definitions, "repeat_order");
  if (repeatDef) {
    const qualifyingIncludingCurrent = [...prior, args.currentOrder];
    const key = "repeat_order";
    if (
      qualifyingIncludingCurrent.length >= 2 &&
      !hasAward(awards, "repeat_order", key)
    ) {
      candidates.push({
        kind: "repeat_order",
        ...(repeatDef.id ? { definitionId: repeatDef.id } : {}),
        idempotencyKey: key,
        relatedOrderId: args.currentOrder.orderId,
        points: clampMilestonePoints(repeatDef.points),
        label: repeatDef.label,
        explanation: repeatDef.explanation,
      });
    }
  }

  const categoryDef = definitionForKind(args.definitions, "new_category");
  if (categoryDef) {
    const priorCategories = new Set<string>();
    for (const order of prior) {
      for (const concept of garmentTypesInOrder(order)) {
        priorCategories.add(concept.conceptId);
      }
    }
    for (const concept of garmentTypesInOrder(args.currentOrder)) {
      const key = `new_category:${concept.conceptId}`;
      if (priorCategories.has(concept.conceptId)) continue;
      if (hasAward(awards, "new_category", key)) continue;
      candidates.push({
        kind: "new_category",
        ...(categoryDef.id ? { definitionId: categoryDef.id } : {}),
        idempotencyKey: key,
        relatedOrderId: args.currentOrder.orderId,
        relatedConceptId: concept.conceptId,
        points: clampMilestonePoints(categoryDef.points),
        label: categoryDef.label,
        explanation: `${categoryDef.explanation} (${concept.canonicalName})`,
      });
    }
  }

  const constructionDef = definitionForKind(
    args.definitions,
    "premium_construction",
  );
  if (constructionDef) {
    const configured = new Set(
      constructionDef.matchConceptIds.map((id) => id as string),
    );
    const matches = conceptsMatching(args.currentOrder, (concept) => {
      if (configured.size > 0) {
        return (
          concept.kind === "construction" && configured.has(concept.conceptId)
        );
      }
      return isPremiumConstructionConcept(concept);
    });
    for (const concept of matches) {
      const key = `premium_construction:${concept.conceptId}`;
      if (hasAward(awards, "premium_construction", key)) continue;
      candidates.push({
        kind: "premium_construction",
        ...(constructionDef.id ? { definitionId: constructionDef.id } : {}),
        idempotencyKey: key,
        relatedOrderId: args.currentOrder.orderId,
        relatedConceptId: concept.conceptId,
        points: clampMilestonePoints(constructionDef.points),
        label: constructionDef.label,
        explanation: `${constructionDef.explanation} (${concept.canonicalName})`,
      });
    }
  }

  const fabricDef = definitionForKind(args.definitions, "advanced_fabric");
  if (fabricDef) {
    const configured = new Set(
      fabricDef.matchConceptIds.map((id) => id as string),
    );
    const matches = conceptsMatching(args.currentOrder, (concept) => {
      if (configured.size > 0) {
        return (
          (concept.kind === "fibre" || concept.kind === "fabric") &&
          configured.has(concept.conceptId)
        );
      }
      return isAdvancedFabricConcept(concept);
    });
    for (const concept of matches) {
      const key = `advanced_fabric:${concept.conceptId}`;
      if (hasAward(awards, "advanced_fabric", key)) continue;
      candidates.push({
        kind: "advanced_fabric",
        ...(fabricDef.id ? { definitionId: fabricDef.id } : {}),
        idempotencyKey: key,
        relatedOrderId: args.currentOrder.orderId,
        relatedConceptId: concept.conceptId,
        points: clampMilestonePoints(fabricDef.points),
        label: fabricDef.label,
        explanation: `${fabricDef.explanation} (${concept.canonicalName})`,
      });
    }
  }

  for (const definition of args.definitions) {
    if (definition.kind !== "custom" || !definition.active) continue;
    if (definition.matchConceptIds.length === 0) continue;
    const customKey = definition.customKey ?? definition.id;
    if (!customKey) continue;
    const wanted = new Set(
      definition.matchConceptIds.map((id) => id as string),
    );
    const matched = conceptsMatching(args.currentOrder, (concept) =>
      wanted.has(concept.conceptId),
    );
    if (matched.length === 0) continue;
    const key = `custom:${customKey}`;
    if (hasAward(awards, "custom", key)) continue;
    candidates.push({
      kind: "custom",
      ...(definition.id ? { definitionId: definition.id } : {}),
      customKey: String(customKey),
      idempotencyKey: key,
      relatedOrderId: args.currentOrder.orderId,
      ...(matched[0]?.conceptId
        ? { relatedConceptId: matched[0].conceptId }
        : {}),
      points: clampMilestonePoints(definition.points),
      label: definition.label,
      explanation: definition.explanation,
    });
  }

  return candidates.filter((candidate) => candidate.points > 0);
}

/**
 * When an order is refunded or canceled, reverse awards tied to that order.
 * Does not invent a second balance — callers write `adjustment_manual`.
 */
export function resolveMilestoneCorrections(args: {
  readonly existingAwards: readonly (MilestoneAwardSnapshot & {
    readonly points: number;
  })[];
  readonly orderId: OrderId;
  readonly orderStatus: OrderStatus;
}): readonly MilestoneCorrectionCandidate[] {
  if (!isMilestoneVoidingStatus(args.orderStatus)) {
    return [];
  }
  return args.existingAwards
    .filter(
      (award) =>
        award.status === "awarded" && award.relatedOrderId === args.orderId,
    )
    .map((award) => ({
      idempotencyKey: award.idempotencyKey,
      kind: award.kind,
      relatedOrderId: args.orderId,
      points: award.points,
    }));
}

/**
 * Premium presentation copy — restrained, never gambling or discount-retail.
 */
export function milestonePresentation(args: {
  readonly kind: LoyaltyMilestoneKind;
  readonly label: string;
  readonly points: number;
  readonly status: LoyaltyMilestoneAwardStatus;
}): {
  readonly headline: string;
  readonly detail: string;
  readonly tone: "recognition" | "reversed";
} {
  if (args.status === "reversed") {
    return {
      headline: args.label,
      detail: "Recognition withdrawn after order correction.",
      tone: "reversed",
    };
  }
  const pointsNote =
    args.points > 0
      ? ` A considered ${args.points}-point recognition has been recorded on your loyalty ledger.`
      : "";
  return {
    headline: args.label,
    detail: `A meaningful stage in your tailoring relationship.${pointsNote}`,
    tone: "recognition",
  };
}

export function defaultBuiltInMilestoneDefinitions(): readonly MilestoneDefinitionSnapshot[] {
  return LOYALTY_BUILT_IN_MILESTONE_KINDS.map((kind) => ({
    kind,
    label: LOYALTY_MILESTONE_KIND_LABELS[kind],
    explanation: defaultMilestoneExplanation(kind),
    points: LOYALTY_MILESTONE_DEFAULT_POINTS[kind],
    matchConceptIds: [],
    active: true,
  }));
}

function defaultMilestoneExplanation(
  kind: LoyaltyBuiltInMilestoneKind,
): string {
  switch (kind) {
    case "first_commission":
      return "Recognised for your first made-to-order commission with this house.";
    case "repeat_order":
      return "Recognised for returning to commission with this house.";
    case "new_category":
      return "Recognised for exploring a new garment category.";
    case "premium_construction":
      return "Recognised for choosing premium construction.";
    case "advanced_fabric":
      return "Recognised for commissioning advanced cloth.";
  }
}
