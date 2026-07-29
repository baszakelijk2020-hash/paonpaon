import type {
  KnowledgeObjectConceptId,
  KnowledgeObjectId,
  KnowledgeObjectRelationId,
  MetadataConceptId,
  RetailerId,
  RetailerKnowledgeOverrideId,
} from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";

/**
 * Founder-named education topics from EDU-001. Every topic must be
 * representable by at least one reviewed knowledge object (or inactive
 * placeholder until editorial copy is approved).
 */
export type KnowledgeTopic =
  | "mill"
  | "fibre"
  | "fabric"
  | "weave"
  | "construction"
  | "collar"
  | "styling"
  | "care"
  | "performance"
  | "occasion"
  | "value"
  | "tradeoff";

export type KnowledgeDisplayType =
  | "information_card"
  | "accordion"
  | "tooltip"
  | "comparison"
  | "advisor_answer";

export type KnowledgeCommercialIntent =
  "educate" | "justify_premium" | "upgrade" | "cross_sell" | "appointment";

export interface KnowledgeObject extends Timestamps {
  readonly id: KnowledgeObjectId;
  /** Null identifies a PAON-owned canonical knowledge object. */
  readonly retailerId: RetailerId | null;
  readonly topic: KnowledgeTopic;
  readonly title: string;
  readonly slug: string;
  readonly summary: string;
  readonly body?: string;
  readonly imageUrl?: string;
  readonly displayTypes: readonly KnowledgeDisplayType[];
  readonly commercialIntent: KnowledgeCommercialIntent;
  readonly priority: number;
  readonly active: boolean;
}

export interface KnowledgeObjectConcept extends Timestamps {
  readonly id: KnowledgeObjectConceptId;
  readonly knowledgeObjectId: KnowledgeObjectId;
  readonly conceptId: MetadataConceptId;
  readonly matchStrength: number;
}

export interface KnowledgeObjectRelation extends Timestamps {
  readonly id: KnowledgeObjectRelationId;
  readonly sourceKnowledgeObjectId: KnowledgeObjectId;
  readonly targetKnowledgeObjectId: KnowledgeObjectId;
}

/**
 * Local presentation controls. Never mutates canonical knowledge copy;
 * hide/pin/priority/rename/summary/image apply only for the owning retailer.
 */
export interface RetailerKnowledgeOverride extends Timestamps {
  readonly id: RetailerKnowledgeOverrideId;
  readonly retailerId: RetailerId;
  readonly knowledgeObjectId: KnowledgeObjectId;
  readonly displayTitle?: string;
  readonly summaryOverride?: string;
  readonly imageUrlOverride?: string;
  readonly isHidden: boolean;
  readonly isPinned: boolean;
  readonly priorityOverride?: number;
}

export interface KnowledgeObjectTenancy {
  readonly objectRetailerId: RetailerId | null;
  readonly conceptRetailerId: RetailerId | null;
}

/**
 * Canonical knowledge may join canonical concepts only. Retailer-owned
 * knowledge may join canonical concepts or concepts owned by that retailer.
 */
export function isKnowledgeConceptJoinTenantCompatible(
  tenancy: KnowledgeObjectTenancy,
): boolean {
  if (tenancy.objectRetailerId === null) {
    return tenancy.conceptRetailerId === null;
  }
  return (
    tenancy.conceptRetailerId === null ||
    tenancy.conceptRetailerId === tenancy.objectRetailerId
  );
}

export interface KnowledgeRelationTenancy {
  readonly sourceRetailerId: RetailerId | null;
  readonly targetRetailerId: RetailerId | null;
}

/**
 * Relations may join two canonical objects, or objects visible to one
 * retailer (canonical plus that retailer's own). Cross-tenant joins are
 * forbidden.
 */
export function isKnowledgeRelationTenantCompatible(
  tenancy: KnowledgeRelationTenancy,
): boolean {
  if (tenancy.sourceRetailerId === null && tenancy.targetRetailerId === null) {
    return true;
  }
  if (
    tenancy.sourceRetailerId !== null &&
    tenancy.targetRetailerId !== null &&
    tenancy.sourceRetailerId === tenancy.targetRetailerId
  ) {
    return true;
  }
  if (tenancy.sourceRetailerId === null && tenancy.targetRetailerId !== null) {
    return true;
  }
  if (tenancy.targetRetailerId === null && tenancy.sourceRetailerId !== null) {
    return true;
  }
  return false;
}

export interface ResolvedKnowledgePresentation {
  readonly title: string;
  readonly summary: string;
  readonly imageUrl?: string;
  readonly priority: number;
  readonly isPinned: boolean;
  readonly isHidden: boolean;
}

/**
 * ADR-060 presentation precedence after safety/active gates:
 * retailer hide and pin, then retailer presentation/priority override,
 * then PAON canonical content and priority.
 */
export function resolveKnowledgePresentation(
  object: Pick<KnowledgeObject, "title" | "summary" | "imageUrl" | "priority">,
  override: RetailerKnowledgeOverride | null,
): ResolvedKnowledgePresentation {
  if (override === null) {
    return {
      title: object.title,
      summary: object.summary,
      ...(object.imageUrl === undefined ? {} : { imageUrl: object.imageUrl }),
      priority: object.priority,
      isPinned: false,
      isHidden: false,
    };
  }

  return {
    title: override.displayTitle ?? object.title,
    summary: override.summaryOverride ?? object.summary,
    ...(override.imageUrlOverride !== undefined
      ? { imageUrl: override.imageUrlOverride }
      : object.imageUrl === undefined
        ? {}
        : { imageUrl: object.imageUrl }),
    priority: override.priorityOverride ?? object.priority,
    isPinned: override.isPinned,
    isHidden: override.isHidden,
  };
}

export interface KnowledgeEligibilityInput {
  readonly active: boolean;
  readonly isHidden: boolean;
}

/**
 * Safety/active and retailer-hide gates from ADR-060. Accepted concept
 * matching and ranking belong to discovery (PHASE 2.2); a pin does not
 * bypass inactive or hidden state.
 */
export function isKnowledgeObjectEligible(
  input: KnowledgeEligibilityInput,
): boolean {
  return input.active && !input.isHidden;
}
