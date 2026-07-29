import type {
  KnowledgeObjectConceptId,
  KnowledgeObjectId,
  KnowledgeObjectRelationId,
  MetadataConceptId,
  RetailerId,
  RetailerKnowledgeOverrideId,
} from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";

export type KnowledgeDisplayType =
  | "information_card"
  | "accordion"
  | "tooltip"
  | "comparison"
  | "advisor_answer";

export type KnowledgeCommercialIntent =
  | "educate"
  | "justify_premium"
  | "upgrade"
  | "cross_sell"
  | "appointment";

export type KnowledgeRelationKind =
  | "related"
  | "prerequisite"
  | "comparison"
  | "follow_up";

/** Founder-named education topic buckets required by EDU-001. */
export type KnowledgeEducationTopic =
  | "mills"
  | "fibres"
  | "fabrics"
  | "weaves"
  | "construction"
  | "collars"
  | "styling"
  | "care"
  | "performance"
  | "occasion"
  | "value"
  | "tradeoffs";

export interface KnowledgeObject extends Timestamps {
  readonly id: KnowledgeObjectId;
  /** Null identifies a PAON-owned canonical knowledge object. */
  readonly retailerId: RetailerId | null;
  readonly title: string;
  readonly slug: string;
  readonly summary: string;
  readonly body?: string;
  readonly imageUrl?: string;
  readonly displayTypes: readonly KnowledgeDisplayType[];
  readonly commercialIntent: KnowledgeCommercialIntent;
  readonly educationTopic: KnowledgeEducationTopic;
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
  /** Null identifies a PAON-owned canonical relation. */
  readonly retailerId: RetailerId | null;
  readonly sourceKnowledgeObjectId: KnowledgeObjectId;
  readonly targetKnowledgeObjectId: KnowledgeObjectId;
  readonly kind: KnowledgeRelationKind;
}

export interface RetailerKnowledgeOverride extends Timestamps {
  readonly id: RetailerKnowledgeOverrideId;
  readonly retailerId: RetailerId;
  readonly knowledgeObjectId: KnowledgeObjectId;
  readonly titleOverride?: string;
  readonly summaryOverride?: string;
  readonly imageUrlOverride?: string;
  readonly isHidden: boolean;
  readonly isPinned: boolean;
  readonly priorityOverride?: number;
}

export interface EffectiveKnowledgePresentation {
  readonly title: string;
  readonly summary: string;
  readonly imageUrl?: string;
  readonly priority: number;
  readonly isPinned: boolean;
}

/**
 * Retailer presentation overrides apply locally without mutating canonical
 * knowledge content. Priority and pin follow the same precedence order as
 * ADR-060: hide removes eligibility; pin still requires active/canonical gates.
 */
export function resolveEffectiveKnowledgePresentation(
  object: KnowledgeObject,
  override: RetailerKnowledgeOverride | null,
): EffectiveKnowledgePresentation {
  return {
    title: override?.titleOverride ?? object.title,
    summary: override?.summaryOverride ?? object.summary,
    ...(override?.imageUrlOverride === undefined &&
    object.imageUrl === undefined
      ? {}
      : {
          imageUrl: override?.imageUrlOverride ?? object.imageUrl,
        }),
    priority: override?.priorityOverride ?? object.priority,
    isPinned: override?.isPinned ?? false,
  };
}

export function isKnowledgeObjectEligible(
  object: KnowledgeObject,
  override: RetailerKnowledgeOverride | null,
): boolean {
  return object.active && object.deletedAt == null && override?.isHidden !== true;
}

export interface KnowledgeObjectConceptTenancy {
  readonly knowledgeObjectRetailerId: RetailerId | null;
  readonly conceptRetailerId: RetailerId | null;
}

/**
 * Canonical knowledge links to canonical concepts only. Retailer-owned
 * knowledge may link to canonical concepts or concepts owned by the same
 * retailer, never another retailer's local concept.
 */
export function isKnowledgeObjectConceptTenantCompatible(
  tenancy: KnowledgeObjectConceptTenancy,
): boolean {
  if (tenancy.knowledgeObjectRetailerId === null) {
    return tenancy.conceptRetailerId === null;
  }

  return (
    tenancy.conceptRetailerId === null ||
    tenancy.conceptRetailerId === tenancy.knowledgeObjectRetailerId
  );
}

export interface KnowledgeObjectRelationTenancy {
  readonly relationRetailerId: RetailerId | null;
  readonly sourceKnowledgeObjectRetailerId: RetailerId | null;
  readonly targetKnowledgeObjectRetailerId: RetailerId | null;
}

/**
 * Canonical relations join canonical knowledge objects only. A retailer-owned
 * relation may join canonical objects with objects owned by that same retailer.
 */
export function isKnowledgeObjectRelationTenantCompatible(
  tenancy: KnowledgeObjectRelationTenancy,
): boolean {
  if (tenancy.relationRetailerId === null) {
    return (
      tenancy.sourceKnowledgeObjectRetailerId === null &&
      tenancy.targetKnowledgeObjectRetailerId === null
    );
  }

  const objectIsVisibleToRelationOwner = (
    objectRetailerId: RetailerId | null,
  ): boolean =>
    objectRetailerId === null ||
    objectRetailerId === tenancy.relationRetailerId;

  return (
    objectIsVisibleToRelationOwner(tenancy.sourceKnowledgeObjectRetailerId) &&
    objectIsVisibleToRelationOwner(tenancy.targetKnowledgeObjectRetailerId)
  );
}

export interface KnowledgeOverrideTenancy {
  readonly overrideRetailerId: RetailerId;
  readonly knowledgeObjectRetailerId: RetailerId | null;
}

/**
 * Retailers may override canonical knowledge or knowledge they own locally.
 */
export function isKnowledgeOverrideTenantCompatible(
  tenancy: KnowledgeOverrideTenancy,
): boolean {
  return (
    tenancy.knowledgeObjectRetailerId === null ||
    tenancy.knowledgeObjectRetailerId === tenancy.overrideRetailerId
  );
}
