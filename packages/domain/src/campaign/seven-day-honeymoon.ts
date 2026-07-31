/**
 * Seven-Day Wardrobe + Honeymoon Phase packages (CMP-105 / CMP-106 / WRD-104 /
 * PHASE 10.2). Owned-first composition cites gaps; honeymoon actions respect
 * stock, lead time and contact pressure — never fabricated scarcity or
 * unapproved one-click payment.
 */

import type { OrderStatus } from "../commerce/order";
import type { OutfitSlotKind } from "../wardrobe/outfit";

import { CAMPAIGN_CHALLENGE_DAY_COUNT } from "./campaign";
import type { CampaignLibrarySnapshot } from "./campaign-library";

export const SEVEN_DAY_SLOT_KINDS: readonly OutfitSlotKind[] = [
  "jacket",
  "trousers",
  "shirt",
  "shoes",
  "accessories",
] as const;

export type SevenDaySource = "owned" | "suggested" | "gap";

export interface SevenDaySlotPlan {
  readonly dayIndex: number;
  readonly slotKind: OutfitSlotKind;
  readonly source: SevenDaySource;
  readonly wardrobeItemId?: string;
  readonly productId?: string;
  readonly citation?: string;
}

export interface SevenDayGapCitation {
  readonly dayIndex: number;
  readonly slotKind: OutfitSlotKind;
  readonly reason: string;
  readonly suggestedProductId?: string;
}

export interface OwnedWardrobeCandidate {
  readonly wardrobeItemId: string;
  readonly slotKind: OutfitSlotKind;
  readonly label: string;
}

export interface SuggestedCatalogueCandidate {
  readonly productId: string;
  readonly slotKind: OutfitSlotKind;
  readonly label: string;
  readonly inStock: boolean;
}

/**
 * Prefer owned wardrobe items; fall back to in-stock catalogue suggestions;
 * otherwise cite an explicit gap (never invent ownership).
 */
export function composeSevenDayOwnedFirstPlan(args: {
  readonly owned: readonly OwnedWardrobeCandidate[];
  readonly suggested: readonly SuggestedCatalogueCandidate[];
}): {
  readonly slots: readonly SevenDaySlotPlan[];
  readonly gaps: readonly SevenDayGapCitation[];
} {
  const slots: SevenDaySlotPlan[] = [];
  const gaps: SevenDayGapCitation[] = [];
  const ownedBySlot = new Map<OutfitSlotKind, OwnedWardrobeCandidate[]>();
  for (const item of args.owned) {
    const list = ownedBySlot.get(item.slotKind) ?? [];
    list.push(item);
    ownedBySlot.set(item.slotKind, list);
  }
  const suggestedBySlot = new Map<
    OutfitSlotKind,
    SuggestedCatalogueCandidate[]
  >();
  for (const item of args.suggested.filter((candidate) => candidate.inStock)) {
    const list = suggestedBySlot.get(item.slotKind) ?? [];
    list.push(item);
    suggestedBySlot.set(item.slotKind, list);
  }

  for (let day = 1; day <= CAMPAIGN_CHALLENGE_DAY_COUNT; day += 1) {
    for (const slotKind of SEVEN_DAY_SLOT_KINDS) {
      const ownedList = ownedBySlot.get(slotKind) ?? [];
      const owned = ownedList[(day - 1) % Math.max(ownedList.length, 1)];
      if (ownedList.length > 0 && owned) {
        slots.push({
          dayIndex: day,
          slotKind,
          source: "owned",
          wardrobeItemId: owned.wardrobeItemId,
          citation: `Owned wardrobe item: ${owned.label}`,
        });
        continue;
      }
      const suggestedList = suggestedBySlot.get(slotKind) ?? [];
      const suggested =
        suggestedList[(day - 1) % Math.max(suggestedList.length, 1)];
      if (suggestedList.length > 0 && suggested) {
        slots.push({
          dayIndex: day,
          slotKind,
          source: "suggested",
          productId: suggested.productId,
          citation: `Suggested catalogue item: ${suggested.label}`,
        });
        continue;
      }
      const gap: SevenDayGapCitation = {
        dayIndex: day,
        slotKind,
        reason: `No owned or in-stock ${slotKind} for day ${day}`,
      };
      gaps.push(gap);
      slots.push({
        dayIndex: day,
        slotKind,
        source: "gap",
        citation: gap.reason,
      });
    }
  }

  return { slots, gaps };
}

export function separateOwnedAndSuggested(slots: readonly SevenDaySlotPlan[]): {
  readonly owned: readonly SevenDaySlotPlan[];
  readonly suggested: readonly SevenDaySlotPlan[];
  readonly gaps: readonly SevenDaySlotPlan[];
} {
  return {
    owned: slots.filter((slot) => slot.source === "owned"),
    suggested: slots.filter((slot) => slot.source === "suggested"),
    gaps: slots.filter((slot) => slot.source === "gap"),
  };
}

export const HONEYMOON_ACTION_KINDS = [
  "preparation",
  "collection",
  "aftercare",
] as const;

export type HoneymoonActionKind = (typeof HONEYMOON_ACTION_KINDS)[number];

export interface HoneymoonAction {
  readonly kind: HoneymoonActionKind;
  readonly title: string;
  readonly dueHint: string;
  readonly suppressed: boolean;
  readonly suppressionReason?: string;
  readonly requiresPaymentApproval: false;
}

export interface HoneymoonLineTruth {
  readonly productLabel: string;
  readonly quantity: number;
  readonly inStock: boolean;
  readonly leadTimeDays: number;
}

/**
 * Order-to-delivery tracker actions. Suppresses when stock/lead-time/pressure
 * truth fails. Never invents scarcity or one-click payment.
 */
export function deriveHoneymoonActions(args: {
  readonly orderStatus: OrderStatus;
  readonly lines: readonly HoneymoonLineTruth[];
  readonly contactPressureActive: boolean;
  readonly nowIso?: string;
}): readonly HoneymoonAction[] {
  const hasStockGap = args.lines.some((line) => !line.inStock);
  const maxLead = args.lines.reduce(
    (max, line) => Math.max(max, line.leadTimeDays),
    0,
  );
  const actions: HoneymoonAction[] = [];

  const prepSuppressed =
    args.orderStatus === "canceled" ||
    args.orderStatus === "refunded" ||
    args.contactPressureActive ||
    hasStockGap;
  actions.push({
    kind: "preparation",
    title: "Prepare fitting notes and confirm lead time",
    dueHint:
      maxLead > 0
        ? `Lead time up to ${maxLead} day(s)`
        : "Lead time not required",
    suppressed: prepSuppressed,
    requiresPaymentApproval: false,
    ...(prepSuppressed
      ? {
          suppressionReason: args.contactPressureActive
            ? "Contact pressure active — defer outreach"
            : hasStockGap
              ? "Stock truth missing for one or more lines"
              : "Order canceled or refunded",
        }
      : {}),
  });

  const collectionReady = [
    "ready_for_fulfillment",
    "shipped",
    "delivered",
    "completed",
  ].includes(args.orderStatus);
  const collectionSuppressed =
    !collectionReady || args.contactPressureActive || hasStockGap;
  actions.push({
    kind: "collection",
    title: "Arrange collection or delivery briefing",
    dueHint: collectionReady
      ? "Order is collection-ready"
      : "Wait until ready for fulfillment",
    suppressed: collectionSuppressed,
    requiresPaymentApproval: false,
    ...(collectionSuppressed
      ? {
          suppressionReason: !collectionReady
            ? "Order not yet ready for collection"
            : args.contactPressureActive
              ? "Contact pressure active — defer outreach"
              : "Stock truth missing for one or more lines",
        }
      : {}),
  });

  const aftercareReady = ["delivered", "completed"].includes(args.orderStatus);
  const aftercareSuppressed = !aftercareReady || args.contactPressureActive;
  actions.push({
    kind: "aftercare",
    title: "Schedule aftercare and fit check-in",
    dueHint: aftercareReady
      ? "Post-delivery aftercare window"
      : "Wait until delivered",
    suppressed: aftercareSuppressed,
    requiresPaymentApproval: false,
    ...(aftercareSuppressed
      ? {
          suppressionReason: !aftercareReady
            ? "Order not yet delivered"
            : "Contact pressure active — defer outreach",
        }
      : {}),
  });

  return actions;
}

export const SEVEN_DAY_WARDROBE_LIBRARY_V1: CampaignLibrarySnapshot = {
  versionLabel: "seven-day-wardrobe-v1",
  kind: "wardrobe_challenge",
  title: "Seven-Day Wardrobe",
  summary:
    "Owned-first seven looks with cited gaps and MorningRoutine-ready days.",
  prerequisites: [
    "personalization_consent",
    "wardrobe_items_or_catalogue",
    "advisor_coverage",
  ],
  placementHints: ["private_offers", "morning_routine", "wardrobe"],
  staffMission:
    "Help the client fill owned looks first; cite gaps without fabricating ownership.",
  outcomeMetrics: ["enrolled", "days_completed", "gaps_cited", "completed"],
  audienceTemplate: {
    consent: "personalization",
    lifecycle: "returning_or_vip",
  },
};

export const HONEYMOON_PHASE_LIBRARY_V1: CampaignLibrarySnapshot = {
  versionLabel: "honeymoon-phase-v1",
  kind: "private_offer",
  title: "Honeymoon Phase",
  summary:
    "Order-to-delivery preparation, collection and aftercare with stock and lead-time truth.",
  prerequisites: ["recent_order", "advisor_coverage"],
  placementHints: ["orders", "clienteling"],
  staffMission:
    "Track preparation, collection and aftercare without pressure spam or fake scarcity.",
  outcomeMetrics: [
    "preparation_done",
    "collection_done",
    "aftercare_done",
    "suppressed",
  ],
  audienceTemplate: {
    trigger: "order_placed_or_in_production",
  },
};
