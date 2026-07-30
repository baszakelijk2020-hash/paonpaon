/**
 * Owned-first seven-day wardrobe capsule projector (CMP-105 / WRD-104 / PHASE 10.2).
 * Wardrobe items rank before catalogue suggestions; cited gaps explain missing slots.
 */

import type { ProductId, WardrobeItemId } from "../shared/branded-id";
import {
  garmentCategoryToOutfitSlot,
  type OutfitSlotKind,
} from "../wardrobe/sartorial";
import type { GarmentCategoryCode } from "../wardrobe/wardrobe";

import {
  CAMPAIGN_CHALLENGE_DAY_COUNT,
  CAMPAIGN_REQUIRED_LOOK_SLOTS,
} from "./campaign";

export const SEVEN_DAY_CAPSULE_PROJECTOR_VERSION = "seven-day-capsule-v1";

export const SEVEN_DAY_SLOT_SOURCE_KINDS = [
  "owned",
  "catalogue_suggested",
] as const;

export type SevenDaySlotSourceKind =
  (typeof SEVEN_DAY_SLOT_SOURCE_KINDS)[number];

export interface SevenDayWardrobeCandidate {
  readonly wardrobeItemId: WardrobeItemId | string;
  readonly displayName: string;
  readonly categoryCode: GarmentCategoryCode;
  readonly retiredAt?: string | null;
  readonly deletedAt?: string | null;
}

export interface SevenDayCatalogueCandidate {
  readonly productId: ProductId | string;
  readonly displayName: string;
  readonly slotKind: OutfitSlotKind;
  readonly inventoryQuantity: number;
  readonly leadTimeDays?: number | null;
}

export interface SevenDayCapsuleGapCitation {
  readonly slotKind: OutfitSlotKind;
  readonly explanation: string;
  readonly factCitation?: string;
  readonly ruleCitation?: string;
}

export interface SevenDayCapsuleSlotProposal {
  readonly slotKind: OutfitSlotKind;
  readonly sourceKind: SevenDaySlotSourceKind;
  readonly wardrobeItemId?: WardrobeItemId | string;
  readonly productId?: ProductId | string;
  readonly displayName: string;
  readonly explanation: string;
}

export interface SevenDayCapsuleDayProposal {
  readonly dayIndex: number;
  readonly title: string;
  readonly occasionLabel?: string;
  readonly slots: readonly SevenDayCapsuleSlotProposal[];
  readonly gaps: readonly SevenDayCapsuleGapCitation[];
}

export interface BuildSevenDayCapsuleInput {
  readonly wardrobeItems: readonly SevenDayWardrobeCandidate[];
  readonly catalogueCandidates: readonly SevenDayCatalogueCandidate[];
  readonly occasionLabels?: readonly string[];
}

const DEFAULT_OCCASION_LABELS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

function isAvailableWardrobeItem(item: SevenDayWardrobeCandidate): boolean {
  return !item.retiredAt && !item.deletedAt;
}

function pickOwnedForSlot(args: {
  readonly slotKind: OutfitSlotKind;
  readonly wardrobeItems: readonly SevenDayWardrobeCandidate[];
  readonly usedWardrobeIds: ReadonlySet<string>;
}): SevenDayWardrobeCandidate | null {
  for (const item of args.wardrobeItems) {
    if (!isAvailableWardrobeItem(item)) continue;
    if (args.usedWardrobeIds.has(item.wardrobeItemId)) continue;
    const mapped = garmentCategoryToOutfitSlot(item.categoryCode);
    if (mapped !== args.slotKind) continue;
    return item;
  }
  return null;
}

function pickCatalogueForSlot(args: {
  readonly slotKind: OutfitSlotKind;
  readonly catalogueCandidates: readonly SevenDayCatalogueCandidate[];
  readonly usedProductIds: ReadonlySet<string>;
}): SevenDayCatalogueCandidate | null {
  const inStock = args.catalogueCandidates.filter(
    (candidate) =>
      candidate.slotKind === args.slotKind &&
      candidate.inventoryQuantity > 0 &&
      !args.usedProductIds.has(candidate.productId),
  );
  if (inStock.length === 0) return null;
  return (
    inStock.sort((left, right) => {
      const leadLeft = left.leadTimeDays ?? 999;
      const leadRight = right.leadTimeDays ?? 999;
      if (leadLeft !== leadRight) return leadLeft - leadRight;
      return left.displayName.localeCompare(right.displayName);
    })[0] ?? null
  );
}

function buildGapCitation(args: {
  readonly slotKind: OutfitSlotKind;
  readonly catalogue: SevenDayCatalogueCandidate | null;
}): SevenDayCapsuleGapCitation {
  if (args.catalogue) {
    const lead =
      args.catalogue.leadTimeDays !== undefined &&
      args.catalogue.leadTimeDays !== null
        ? `${args.catalogue.leadTimeDays} day lead time`
        : "stock available now";
    return {
      slotKind: args.slotKind,
      explanation: `No owned ${args.slotKind} in your wardrobe — a catalogue piece fills this gap.`,
      factCitation: `Catalogue: ${args.catalogue.displayName} (${lead}).`,
      ruleCitation:
        "Complete looks cite owned pieces first; gaps name catalogue alternatives.",
    };
  }
  return {
    slotKind: args.slotKind,
    explanation: `Missing ${args.slotKind} — neither owned wardrobe nor in-stock catalogue covers this slot.`,
    factCitation: "Wardrobe and catalogue were checked for this slot.",
    ruleCitation:
      "A complete look requires jacket, trousers, shirt, and shoes.",
  };
}

/**
 * Deterministic owned-first seven-day capsule with cited gaps per day.
 */
export function buildSevenDayCapsule(
  input: BuildSevenDayCapsuleInput,
): readonly SevenDayCapsuleDayProposal[] {
  const occasions =
    input.occasionLabels &&
    input.occasionLabels.length >= CAMPAIGN_CHALLENGE_DAY_COUNT
      ? input.occasionLabels
      : DEFAULT_OCCASION_LABELS;

  const usedWardrobeIds = new Set<string>();
  const usedProductIds = new Set<string>();
  const days: SevenDayCapsuleDayProposal[] = [];

  for (
    let dayIndex = 1;
    dayIndex <= CAMPAIGN_CHALLENGE_DAY_COUNT;
    dayIndex += 1
  ) {
    const occasionLabel = occasions[dayIndex - 1];
    const slots: SevenDayCapsuleSlotProposal[] = [];
    const gaps: SevenDayCapsuleGapCitation[] = [];

    for (const slotKind of CAMPAIGN_REQUIRED_LOOK_SLOTS) {
      const owned = pickOwnedForSlot({
        slotKind,
        wardrobeItems: input.wardrobeItems,
        usedWardrobeIds,
      });
      if (owned) {
        usedWardrobeIds.add(owned.wardrobeItemId);
        slots.push({
          slotKind,
          sourceKind: "owned",
          wardrobeItemId: owned.wardrobeItemId,
          displayName: owned.displayName,
          explanation: `Owned ${slotKind} from your wardrobe.`,
        });
        continue;
      }

      const catalogue = pickCatalogueForSlot({
        slotKind,
        catalogueCandidates: input.catalogueCandidates,
        usedProductIds,
      });
      if (catalogue) {
        usedProductIds.add(catalogue.productId);
        slots.push({
          slotKind,
          sourceKind: "catalogue_suggested",
          productId: catalogue.productId,
          displayName: catalogue.displayName,
          explanation: `Suggested catalogue ${slotKind} to complete the look.`,
        });
        gaps.push(buildGapCitation({ slotKind, catalogue }));
        continue;
      }

      gaps.push(buildGapCitation({ slotKind, catalogue: null }));
    }

    days.push({
      dayIndex,
      title: `${occasionLabel} look`,
      ...(occasionLabel ? { occasionLabel } : {}),
      slots,
      gaps,
    });
  }

  return days;
}

export function isOwnedFirstCapsule(args: {
  readonly days: readonly SevenDayCapsuleDayProposal[];
}): boolean {
  for (const day of args.days) {
    for (const slot of day.slots) {
      const ownedAvailable = args.days.some((entry) =>
        entry.slots.some(
          (candidate) =>
            candidate.slotKind === slot.slotKind &&
            candidate.sourceKind === "owned",
        ),
      );
      if (
        slot.sourceKind === "catalogue_suggested" &&
        ownedAvailable &&
        day.slots.find(
          (candidate) =>
            candidate.slotKind === slot.slotKind &&
            candidate.sourceKind === "owned",
        )
      ) {
        return false;
      }
    }
  }
  return true;
}
