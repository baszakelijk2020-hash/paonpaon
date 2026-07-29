/**
 * Complete-look outfit slots (ROAD-002, ADR-063 / PHASE 4.2).
 * Slot kinds are finer than garment categories — shoes and pocket squares
 * are distinct composition slots.
 */

import type { GarmentCategoryCode } from "../production/production";
import type {
  KnowledgeObjectId,
  OutfitId,
  OutfitRuleCitationId,
  OutfitSlotId,
  ProductId,
  RetailerId,
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

export const OUTFIT_STATUSES = ["draft", "proposed", "approved"] as const;

export type OutfitStatus = (typeof OUTFIT_STATUSES)[number];

export const OUTFIT_STATUS_TRANSITIONS: Readonly<
  Record<OutfitStatus, readonly OutfitStatus[]>
> = {
  draft: ["proposed", "draft"],
  proposed: ["approved", "draft"],
  approved: ["approved"],
};

export interface OutfitRuleCitation {
  readonly id: OutfitRuleCitationId;
  readonly outfitId: OutfitId;
  readonly retailerId: RetailerId;
  readonly knowledgeObjectId: KnowledgeObjectId;
  readonly explanation: string;
  readonly slotKindA?: OutfitSlotKind;
  readonly slotKindB?: OutfitSlotKind;
  readonly createdAt: string;
}

export interface OutfitSlot {
  readonly id: OutfitSlotId;
  readonly outfitId: OutfitId;
  readonly retailerId: RetailerId;
  readonly slotKind: OutfitSlotKind;
  readonly sortOrder: number;
  readonly displayLabel: string;
  readonly wardrobeItemId?: WardrobeItemId;
  readonly productId?: ProductId;
}

export interface Outfit extends Timestamps {
  readonly id: OutfitId;
  readonly retailerId: RetailerId;
  readonly customerId: string;
  readonly roadmapId?: string;
  readonly title: string;
  readonly occasionLabel?: string;
  readonly status: OutfitStatus;
  readonly createdByStaffId: StaffId;
  readonly approvedAt?: string;
  readonly approvedByStaffId?: StaffId;
  readonly slots: readonly OutfitSlot[];
  readonly ruleCitations: readonly OutfitRuleCitation[];
}

export interface OutfitSlotReferenceInput {
  readonly slotKind: OutfitSlotKind;
  readonly displayLabel: string;
  readonly wardrobeItemId?: WardrobeItemId | string | null;
  readonly productId?: ProductId | string | null;
}

export type OutfitSlotReferenceIssue =
  | "slot_requires_reference_or_label"
  | "slot_cannot_reference_both"
  | "slot_unknown_kind";

export function outfitSlotReferenceIssues(
  slot: OutfitSlotReferenceInput,
): readonly OutfitSlotReferenceIssue[] {
  const issues: OutfitSlotReferenceIssue[] = [];
  if (!OUTFIT_SLOT_KINDS.includes(slot.slotKind)) {
    issues.push("slot_unknown_kind");
  }
  const hasWardrobe =
    slot.wardrobeItemId !== undefined &&
    slot.wardrobeItemId !== null &&
    slot.wardrobeItemId !== "";
  const hasProduct =
    slot.productId !== undefined &&
    slot.productId !== null &&
    slot.productId !== "";
  const hasLabel = slot.displayLabel.trim().length > 0;
  if (!hasWardrobe && !hasProduct && !hasLabel) {
    issues.push("slot_requires_reference_or_label");
  }
  if (hasWardrobe && hasProduct) {
    issues.push("slot_cannot_reference_both");
  }
  return issues;
}

export function isOutfitSlotReferenceValid(
  slot: OutfitSlotReferenceInput,
): boolean {
  return outfitSlotReferenceIssues(slot).length === 0;
}

export function canTransitionOutfitStatus(
  from: OutfitStatus,
  to: OutfitStatus,
): boolean {
  return OUTFIT_STATUS_TRANSITIONS[from].includes(to);
}

/** Map wardrobe garment categories to the closest outfit slot when composing looks. */
export function garmentCategoryToOutfitSlot(
  category: GarmentCategoryCode,
): OutfitSlotKind | null {
  switch (category) {
    case "jacket":
    case "suit":
    case "overcoat":
    case "coat":
    case "formalwear":
    case "waistcoat":
      return "jacket";
    case "trousers":
    case "denim":
      return "trousers";
    case "shirt":
    case "knitwear":
      return "shirt";
    case "accessories":
      return "accessories";
    case "leather":
    case "other":
      return null;
    default: {
      const _exhaustive: never = category;
      return _exhaustive;
    }
  }
}
