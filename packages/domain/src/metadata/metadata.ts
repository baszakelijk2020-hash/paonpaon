import type {
  EntityMetadataAssignmentId,
  MetadataConceptEdgeId,
  MetadataConceptId,
  ProductId,
  ProductVariantId,
  RetailerConceptOverrideId,
  RetailerId,
  StaffId,
  WardrobeItemId,
} from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";

export type MetadataConceptKind =
  | "mill"
  | "fabric_collection"
  | "fibre"
  | "weave"
  | "weight_band"
  | "pattern"
  | "colour"
  | "season"
  | "garment_type"
  | "construction"
  | "fit"
  | "formality"
  | "climate"
  | "performance"
  | "care"
  | "style"
  | "occasion"
  | "compatibility"
  | "collar"
  | "silhouette";

export type MetadataSource = "supplier" | "ai" | "retailer" | "paon";
export type MetadataReviewStatus = "pending" | "accepted" | "rejected";
export type MetadataEdgeKind =
  | "parent"
  | "related"
  | "equivalent"
  | "suggests"
  | "compatible_with"
  | "incompatible_with";

export type MetadataTarget =
  | {
      readonly targetType: "product";
      readonly targetId: ProductId;
    }
  | {
      readonly targetType: "product_variant";
      readonly targetId: ProductVariantId;
    }
  | {
      readonly targetType: "wardrobe_item";
      readonly targetId: WardrobeItemId;
    };

export interface MetadataEvidence {
  readonly summary: string;
  readonly sourceReference?: string;
}

export interface MetadataConcept extends Timestamps {
  readonly id: MetadataConceptId;
  /** Null identifies a PAON-owned canonical concept. */
  readonly retailerId: RetailerId | null;
  readonly kind: MetadataConceptKind;
  readonly slug: string;
  readonly canonicalName: string;
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly imageUrl?: string;
  readonly active: boolean;
}

export interface MetadataConceptEdge extends Timestamps {
  readonly id: MetadataConceptEdgeId;
  /** Null identifies a PAON-owned canonical edge. */
  readonly retailerId: RetailerId | null;
  readonly sourceConceptId: MetadataConceptId;
  readonly targetConceptId: MetadataConceptId;
  readonly kind: MetadataEdgeKind;
  readonly weight: number;
}

export interface EntityMetadataAssignment extends Timestamps {
  readonly id: EntityMetadataAssignmentId;
  readonly retailerId: RetailerId;
  readonly target: MetadataTarget;
  readonly conceptId: MetadataConceptId;
  readonly source: MetadataSource;
  readonly confidence?: number;
  readonly reviewStatus: MetadataReviewStatus;
  readonly supplierValue?: string;
  readonly evidence?: MetadataEvidence;
  readonly reviewedByStaffId?: StaffId;
  readonly reviewedAt?: string;
}

export interface RetailerConceptOverride extends Timestamps {
  readonly id: RetailerConceptOverrideId;
  readonly retailerId: RetailerId;
  readonly conceptId: MetadataConceptId;
  readonly displayName?: string;
  readonly summaryOverride?: string;
  readonly imageUrlOverride?: string;
  readonly isHidden: boolean;
  readonly priorityOverride?: number;
}

export interface ProductFabricComposition {
  readonly fibreConceptId: MetadataConceptId;
  readonly percentage: number;
}

export interface ProductFabricProfile {
  readonly fabricWeightGramsPerSquareMetre?: number;
  readonly composition: readonly ProductFabricComposition[];
  readonly supplierReference?: string;
}

export interface MetadataAssignmentTenancy {
  readonly assignmentRetailerId: RetailerId;
  readonly targetRetailerId: RetailerId;
  readonly conceptRetailerId: RetailerId | null;
}

/**
 * An assignment is always tenant-owned. It may reference a PAON canonical
 * concept or a concept owned by the same retailer, never another retailer's
 * local concept or entity.
 */
export function isMetadataAssignmentTenantCompatible(
  tenancy: MetadataAssignmentTenancy,
): boolean {
  return (
    tenancy.assignmentRetailerId === tenancy.targetRetailerId &&
    (tenancy.conceptRetailerId === null ||
      tenancy.conceptRetailerId === tenancy.assignmentRetailerId)
  );
}

export interface MetadataEdgeTenancy {
  readonly edgeRetailerId: RetailerId | null;
  readonly sourceConceptRetailerId: RetailerId | null;
  readonly targetConceptRetailerId: RetailerId | null;
}

/**
 * Canonical edges may join canonical concepts only. A retailer-owned edge may
 * join canonical concepts with concepts owned by that same retailer.
 */
export function isMetadataEdgeTenantCompatible(
  tenancy: MetadataEdgeTenancy,
): boolean {
  if (tenancy.edgeRetailerId === null) {
    return (
      tenancy.sourceConceptRetailerId === null &&
      tenancy.targetConceptRetailerId === null
    );
  }

  const conceptIsVisibleToEdgeOwner = (
    conceptRetailerId: RetailerId | null,
  ): boolean =>
    conceptRetailerId === null || conceptRetailerId === tenancy.edgeRetailerId;

  return (
    conceptIsVisibleToEdgeOwner(tenancy.sourceConceptRetailerId) &&
    conceptIsVisibleToEdgeOwner(tenancy.targetConceptRetailerId)
  );
}
