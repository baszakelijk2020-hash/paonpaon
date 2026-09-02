/**
 * Relationship-scoped wardrobe ownership (WARD-001–003, ADR-063 / PHASE 4.1).
 * Distinct from PhysicalGarment, which remains the official fitting/service
 * aggregate. Self-reported fit/care/wear never populate official measurements.
 */

import type { RetailerRole } from "../identity/role";
import { retailerRoleAtLeast } from "../identity/role";
import type { GarmentCategoryCode } from "../production/production";
import { GARMENT_CATEGORIES } from "../production/production";
import type {
  CustomerId,
  OrderLineId,
  PhysicalGarmentId,
  ProductId,
  RetailerId,
  StaffId,
  WardrobeItemId,
  WardrobeOwnershipEventId,
} from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";

export { GARMENT_CATEGORIES };
export type { GarmentCategoryCode };

export const WARDROBE_OWNERSHIP_KINDS = [
  "retailer_purchased",
  "external",
] as const;

export type WardrobeOwnershipKind = (typeof WARDROBE_OWNERSHIP_KINDS)[number];

export const WARDROBE_PROVENANCE_SOURCES = [
  "order_line",
  "catalogue_link",
  "customer_added",
  "advisor_added",
] as const;

export type WardrobeProvenanceSource =
  (typeof WARDROBE_PROVENANCE_SOURCES)[number];

export const WARDROBE_CONDITION_STATES = [
  "new",
  "excellent",
  "good",
  "fair",
  "needs_care",
  "retired",
] as const;

export type WardrobeConditionState = (typeof WARDROBE_CONDITION_STATES)[number];

export const WARDROBE_WEAR_FREQUENCIES = [
  "rarely",
  "occasionally",
  "regularly",
  "frequently",
] as const;

export type WardrobeWearFrequency = (typeof WARDROBE_WEAR_FREQUENCIES)[number];

export const WARDROBE_CARE_STATES = [
  "current",
  "due_soon",
  "needs_attention",
  "in_service",
] as const;

export type WardrobeCareState = (typeof WARDROBE_CARE_STATES)[number];

export const WARDROBE_FIT_PERCEPTIONS = [
  "unknown",
  "true_to_size",
  "slightly_tight",
  "slightly_loose",
  "needs_alteration",
] as const;

export type WardrobeFitPerception = (typeof WARDROBE_FIT_PERCEPTIONS)[number];

export const WARDROBE_ACTOR_KINDS = ["customer", "advisor", "system"] as const;

export type WardrobeActorKind = (typeof WARDROBE_ACTOR_KINDS)[number];

export const WARDROBE_OWNERSHIP_EVENT_KINDS = [
  "acquired",
  "ownership_confirmed",
  "provenance_updated",
  "retired",
  "restored",
] as const;

export type WardrobeOwnershipEventKind =
  (typeof WARDROBE_OWNERSHIP_EVENT_KINDS)[number];

/** FT-14 sibling gap (PHASE 17.13's own named "Book an alteration"/"Book a
 * cleaning" action buttons, `docs/vision/PAON_VIRTUAL_TRYON_AND_OOTD_ECONOMICS.md`
 * §17): the two per-item service requests a customer can raise from their
 * own wardrobe. Deliberately not a new `ConversationIntent` value — that
 * enum is a designated ADR-034 source contract every existing consumer
 * depends on; this reuses the existing freeform message channel instead. */
export const WARDROBE_SERVICE_REQUEST_KINDS = [
  "repair",
  "alteration",
  "cleaning",
] as const;

export type WardrobeServiceRequestKind =
  (typeof WARDROBE_SERVICE_REQUEST_KINDS)[number];

export const WARDROBE_SERVICE_REQUEST_KIND_LABELS: Record<
  WardrobeServiceRequestKind,
  string
> = {
  repair: "Book a repair",
  alteration: "Book an alteration",
  cleaning: "Book a cleaning",
};

export interface WardrobeItem extends Timestamps {
  readonly id: WardrobeItemId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly ownershipKind: WardrobeOwnershipKind;
  readonly provenanceSource: WardrobeProvenanceSource;
  readonly categoryCode: GarmentCategoryCode;
  readonly displayName: string;
  readonly brand?: string;
  readonly description?: string;
  readonly condition: WardrobeConditionState;
  readonly wearFrequency?: WardrobeWearFrequency;
  readonly careState: WardrobeCareState;
  /** Self-reported perceived fit — never official measurements (ADR-016/055). */
  readonly fitPerception: WardrobeFitPerception;
  readonly careNotes?: string;
  readonly fitNotes?: string;
  readonly acquiredAt?: string;
  readonly productId?: ProductId;
  readonly orderLineId?: OrderLineId;
  /** Optional link to fitting/service aggregate; not the wardrobe item itself. */
  readonly physicalGarmentId?: PhysicalGarmentId;
  readonly identifyingPhotoUrl?: string;
  readonly createdByActor: Exclude<WardrobeActorKind, "system">;
  readonly createdByStaffId?: StaffId;
  readonly retiredAt?: string;
  readonly deletedAt?: string;
  /** Permanent opaque token for the QR wardrobe card's anonymous public
   * reveal (PHASE 17.13 / ADV-113) — never the customer's identity. */
  readonly publicToken: string;
}

export interface WardrobeOwnershipEvent {
  readonly id: WardrobeOwnershipEventId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly wardrobeItemId: WardrobeItemId;
  readonly eventKind: WardrobeOwnershipEventKind;
  readonly ownershipKind: WardrobeOwnershipKind;
  readonly provenanceSource: WardrobeProvenanceSource;
  readonly actorKind: WardrobeActorKind;
  readonly actorStaffId?: StaffId;
  readonly note?: string;
  readonly occurredAt: string;
  readonly createdAt: string;
}

export interface WardrobeItemConsistencyInput {
  readonly ownershipKind: WardrobeOwnershipKind;
  readonly provenanceSource: WardrobeProvenanceSource;
  readonly orderLineId?: OrderLineId | string | null;
  readonly productId?: ProductId | string | null;
  readonly physicalGarmentId?: PhysicalGarmentId | string | null;
  readonly createdByActor: Exclude<WardrobeActorKind, "system">;
  readonly createdByStaffId?: StaffId | string | null;
  readonly retiredAt?: string | null;
  readonly condition: WardrobeConditionState;
}

export type WardrobeItemConsistencyIssue =
  | "external_cannot_have_order_line"
  | "order_line_requires_retailer_purchased"
  | "order_line_provenance_requires_order_line"
  | "retailer_purchased_provenance_invalid"
  | "external_provenance_invalid"
  | "advisor_actor_requires_staff"
  | "customer_actor_forbids_staff"
  | "retired_condition_mismatch";

/**
 * Pure provenance/ownership rules for retailer-purchased vs external items.
 * Catalogue/product links are optional references; they never clone a Product.
 */
export function wardrobeItemConsistencyIssues(
  input: WardrobeItemConsistencyInput,
): readonly WardrobeItemConsistencyIssue[] {
  const issues: WardrobeItemConsistencyIssue[] = [];
  const hasOrderLine =
    input.orderLineId !== undefined &&
    input.orderLineId !== null &&
    input.orderLineId !== "";

  if (input.ownershipKind === "external" && hasOrderLine) {
    issues.push("external_cannot_have_order_line");
  }

  if (hasOrderLine && input.ownershipKind !== "retailer_purchased") {
    issues.push("order_line_requires_retailer_purchased");
  }

  if (input.provenanceSource === "order_line" && !hasOrderLine) {
    issues.push("order_line_provenance_requires_order_line");
  }

  if (input.ownershipKind === "retailer_purchased") {
    if (
      input.provenanceSource !== "order_line" &&
      input.provenanceSource !== "catalogue_link" &&
      input.provenanceSource !== "advisor_added"
    ) {
      issues.push("retailer_purchased_provenance_invalid");
    }
  }

  if (input.ownershipKind === "external") {
    if (
      input.provenanceSource !== "customer_added" &&
      input.provenanceSource !== "advisor_added"
    ) {
      issues.push("external_provenance_invalid");
    }
  }

  if (input.createdByActor === "advisor") {
    if (
      input.createdByStaffId === undefined ||
      input.createdByStaffId === null ||
      input.createdByStaffId === ""
    ) {
      issues.push("advisor_actor_requires_staff");
    }
  } else if (
    input.createdByStaffId !== undefined &&
    input.createdByStaffId !== null &&
    input.createdByStaffId !== ""
  ) {
    issues.push("customer_actor_forbids_staff");
  }

  const retired =
    input.retiredAt !== undefined &&
    input.retiredAt !== null &&
    input.retiredAt !== "";
  if (retired && input.condition !== "retired") {
    issues.push("retired_condition_mismatch");
  }
  if (!retired && input.condition === "retired") {
    issues.push("retired_condition_mismatch");
  }

  return issues;
}

export function isWardrobeItemConsistent(
  input: WardrobeItemConsistencyInput,
): boolean {
  return wardrobeItemConsistencyIssues(input).length === 0;
}

export type WardrobeCollaborationAction =
  "read" | "create" | "update" | "retire" | "propose_metadata";

/**
 * Customer and authorized advisor collaborate only inside the same
 * retailer-customer relationship. Cross-tenant and unlinked identities deny.
 */
export function canCollaborateOnWardrobe(params: {
  readonly action: WardrobeCollaborationAction;
  readonly itemRetailerId: RetailerId;
  readonly itemCustomerId: CustomerId;
  readonly actor:
    | {
        readonly kind: "customer";
        readonly customerId: CustomerId;
        readonly retailerId: RetailerId;
      }
    | {
        readonly kind: "advisor";
        readonly retailerId: RetailerId;
        readonly role: RetailerRole;
      }
    | { readonly kind: "other" };
}): boolean {
  if (params.actor.kind === "other") {
    return false;
  }

  if (params.actor.retailerId !== params.itemRetailerId) {
    return false;
  }

  if (params.actor.kind === "customer") {
    return params.actor.customerId === params.itemCustomerId;
  }

  return retailerRoleAtLeast(params.actor.role, "sales_associate");
}

/** The one place this copy lives, so the button label and the message a
 * staff member actually reads never drift apart. Sent as an ordinary
 * message body — never a new `ConversationIntent` — through the
 * customer's existing conversation with their own advisor. */
export function wardrobeServiceRequestMessage(params: {
  readonly kind: WardrobeServiceRequestKind;
  readonly itemDisplayName: string;
  readonly itemBrand?: string;
}): string {
  const name = params.itemBrand
    ? `${params.itemBrand} ${params.itemDisplayName}`
    : params.itemDisplayName;
  const action =
    params.kind === "alteration"
      ? "an alteration"
      : params.kind === "cleaning"
        ? "a cleaning"
        : "a repair";
  return `I'd like to book ${action} for this item from my wardrobe: ${name}.`;
}

/** Reuses the same real conversation channel as
 * {@link wardrobeServiceRequestMessage} for the Order Again deck's
 * fallback when a wardrobe item has no linked product/variant to
 * repurchase directly. */
export function wardrobeReorderRequestMessage(params: {
  readonly itemDisplayName: string;
  readonly itemBrand?: string;
}): string {
  const name = params.itemBrand
    ? `${params.itemBrand} ${params.itemDisplayName}`
    : params.itemDisplayName;
  return `I'd like to reorder this item from my wardrobe: ${name}. Could you help me find or arrange it?`;
}
