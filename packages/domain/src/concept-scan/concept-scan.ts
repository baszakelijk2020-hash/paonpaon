import type {
  ConceptOrderSelectionId,
  ConceptScanCodeId,
  CustomerId,
  ProductVariantId,
  RetailerId,
  StaffId,
} from "../shared/branded-id";
import type { Money } from "../shared/money";

/** FT-03 QR try-on and fabric-batch concept order
 * (docs/FOUNDER_TOOL_BLUEPRINTS.md). Each physical Try-On or fabric
 * swatch gets its own opaque, rotatable, expiring scan code; a
 * customer's accumulated scans across a visit form one running "concept
 * order" selection they explicitly send to their advisor. */
export type ConceptScanKind = "try_on" | "fabric_swatch";

export type ConceptScanCodeStatus = "active" | "recalled";

/** The RPC's own effective status — folds an expired `expires_at` into
 * `active`/`recalled` without a separate stored value, same idiom as
 * gift invitations' effective-status computation. */
export type ConceptScanResolveStatus =
  "active" | "expired" | "recalled" | "unknown";

export const CONCEPT_SCAN_KIND_LABELS: Record<ConceptScanKind, string> = {
  try_on: "Try-On",
  fabric_swatch: "Fabric swatch",
};

export const CONCEPT_SCAN_CODE_STATUS_LABELS: Record<
  ConceptScanCodeStatus,
  string
> = {
  active: "Active",
  recalled: "Recalled",
};

export type ConceptOrderSelectionStatus = "draft" | "submitted";

/** A retailer-issued scan code for one product variant — the physical
 * tag/swatch's digital counterpart. */
export interface ConceptScanCode {
  readonly id: ConceptScanCodeId;
  readonly retailerId: RetailerId;
  readonly productVariantId: ProductVariantId;
  readonly kind: ConceptScanKind;
  readonly code: string;
  readonly status: ConceptScanCodeStatus;
  readonly expiresAt?: string;
  readonly supersededByCodeId?: ConceptScanCodeId;
  readonly createdByStaffId?: StaffId;
  readonly createdAt: string;
}

/** The anonymous resolve RPC's full payload — everything the reveal page
 * needs, including the token's true `retailerSlug` so the caller can
 * detect a "wrong House" scan (a different retailer than the one it is
 * currently browsing) without a database round trip. */
export interface ConceptScanReveal {
  readonly status: ConceptScanResolveStatus;
  readonly code?: string;
  readonly kind?: ConceptScanKind;
  readonly retailerId?: RetailerId;
  readonly retailerDisplayName?: string;
  readonly retailerSlug?: string;
  readonly productVariantId?: ProductVariantId;
  readonly productName?: string;
  readonly variantLabel?: string;
  readonly price?: Money;
  readonly primaryImageUrl?: string;
}

export interface ConceptOrderSelection {
  readonly id: ConceptOrderSelectionId;
  readonly customerId: CustomerId;
  readonly retailerId: RetailerId;
  readonly status: ConceptOrderSelectionStatus;
  readonly submittedAt?: string;
  readonly createdAt: string;
}

export interface ConceptOrderSelectionItem {
  readonly scanCodeId: ConceptScanCodeId;
  readonly kind: ConceptScanKind;
  readonly productName: string;
  readonly variantLabel?: string;
  readonly primaryImageUrl?: string;
  readonly addedAt: string;
}
