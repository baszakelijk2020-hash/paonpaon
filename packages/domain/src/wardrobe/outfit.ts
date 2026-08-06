/**
 * Complete looks / outfits spanning ROAD-002 slots (PHASE 4.2 / ADR-063).
 * Outfits reference wardrobe or catalogue items; they do not copy product facts.
 */

import type {
  OutfitId,
  OutfitSlotId,
  ProductId,
  RetailerId,
  CustomerId,
  StaffId,
  WardrobeItemId,
  WardrobeRoadmapId,
} from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";

import type { OutfitSlotKind } from "./sartorial";
import { OUTFIT_SLOT_KINDS } from "./sartorial";

export { OUTFIT_SLOT_KINDS };
export type { OutfitSlotKind };

export interface OutfitSlot {
  readonly id: OutfitSlotId;
  readonly outfitId: OutfitId;
  readonly retailerId: RetailerId;
  readonly slotKind: OutfitSlotKind;
  readonly wardrobeItemId?: WardrobeItemId;
  readonly productId?: ProductId;
  readonly label: string;
  readonly available: boolean;
  readonly displayOrder: number;
}

export interface Outfit extends Timestamps {
  readonly id: OutfitId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly roadmapId?: WardrobeRoadmapId;
  readonly title: string;
  readonly occasionLabel?: string;
  readonly notes?: string;
  /**
   * Exactly one of `createdByStaffId` / `createdByCustomerId` is set — an
   * outfit is authored either by an advisor (the original ROAD-002 shape)
   * or, since Virtual Wardrobe Studio (VWS-001 / PHASE 4.6), by the
   * customer composing their own try-on look. See `outfitAuthorIssues`.
   */
  readonly createdByStaffId?: StaffId;
  readonly createdByCustomerId?: CustomerId;
  readonly deletedAt?: string;
  readonly slots: readonly OutfitSlot[];
}

export type OutfitAuthorIssue = "missing_author" | "both_authors_set";

/** Exactly one author. Mirrors the outfit-slot consistency guard's shape. */
export function outfitAuthorIssues(params: {
  readonly createdByStaffId?: StaffId | string | null;
  readonly createdByCustomerId?: CustomerId | string | null;
}): readonly OutfitAuthorIssue[] {
  const hasStaff =
    params.createdByStaffId !== undefined &&
    params.createdByStaffId !== null &&
    params.createdByStaffId !== "";
  const hasCustomer =
    params.createdByCustomerId !== undefined &&
    params.createdByCustomerId !== null &&
    params.createdByCustomerId !== "";

  if (hasStaff && hasCustomer) return ["both_authors_set"];
  if (!hasStaff && !hasCustomer) return ["missing_author"];
  return [];
}

export type OutfitSlotConsistencyIssue =
  | "missing_item_reference"
  | "both_wardrobe_and_product"
  | "unavailable_with_reference"
  | "duplicate_slot_kind";

export function outfitSlotConsistencyIssues(params: {
  readonly slots: readonly {
    readonly slotKind: OutfitSlotKind;
    readonly wardrobeItemId?: WardrobeItemId | string | null;
    readonly productId?: ProductId | string | null;
    readonly available: boolean;
  }[];
}): readonly OutfitSlotConsistencyIssue[] {
  const issues: OutfitSlotConsistencyIssue[] = [];
  const seen = new Set<OutfitSlotKind>();

  for (const slot of params.slots) {
    if (seen.has(slot.slotKind)) {
      issues.push("duplicate_slot_kind");
    }
    seen.add(slot.slotKind);

    const hasWardrobe =
      slot.wardrobeItemId !== undefined &&
      slot.wardrobeItemId !== null &&
      slot.wardrobeItemId !== "";
    const hasProduct =
      slot.productId !== undefined &&
      slot.productId !== null &&
      slot.productId !== "";

    if (hasWardrobe && hasProduct) {
      issues.push("both_wardrobe_and_product");
    }

    if (slot.available && !hasWardrobe && !hasProduct) {
      issues.push("missing_item_reference");
    }

    if (!slot.available && (hasWardrobe || hasProduct)) {
      issues.push("unavailable_with_reference");
    }
  }

  return [...new Set(issues)];
}

export function isOutfitSlotsConsistent(params: {
  readonly slots: readonly {
    readonly slotKind: OutfitSlotKind;
    readonly wardrobeItemId?: WardrobeItemId | string | null;
    readonly productId?: ProductId | string | null;
    readonly available: boolean;
  }[];
}): boolean {
  return outfitSlotConsistencyIssues(params).length === 0;
}
