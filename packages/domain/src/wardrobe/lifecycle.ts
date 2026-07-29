/**
 * Wardrobe lifecycle history and respectful longevity guidance
 * (WARD-002, LONG-001, PHASE 4.3). Self-reported state only — never
 * official fitting observations (ADR-016/055/063).
 */

import type {
  CustomerId,
  RetailerId,
  WardrobeItemId,
  WardrobeLifecycleEventId,
} from "../shared/branded-id";

import type {
  WardrobeCareState,
  WardrobeConditionState,
  WardrobeItem,
  WardrobeWearFrequency,
} from "./wardrobe";

export const WARDROBE_LIFECYCLE_EVENT_KINDS = [
  "wear_logged",
  "rested",
  "cleaned",
  "repaired",
  "care_due_acknowledged",
] as const;

export type WardrobeLifecycleEventKind =
  (typeof WARDROBE_LIFECYCLE_EVENT_KINDS)[number];

export interface WardrobeLifecycleEvent {
  readonly id: WardrobeLifecycleEventId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly wardrobeItemId: WardrobeItemId;
  readonly eventKind: WardrobeLifecycleEventKind;
  readonly note?: string;
  readonly occurredAt: string;
  readonly createdAt: string;
}

export const WARDROBE_GUIDANCE_KINDS = [
  "care_due",
  "rest_rotation",
  "repair_attention",
  "longevity_celebration",
  "fit_self_report",
] as const;

export type WardrobeGuidanceKind = (typeof WARDROBE_GUIDANCE_KINDS)[number];

export interface WardrobeGuidanceItem {
  readonly key: string;
  readonly kind: WardrobeGuidanceKind;
  readonly title: string;
  readonly explanation: string;
  readonly dismissible: true;
}

export interface WardrobeLifecycleGuidanceInput {
  readonly item: Pick<
    WardrobeItem,
    | "id"
    | "displayName"
    | "condition"
    | "wearFrequency"
    | "careState"
    | "acquiredAt"
    | "createdAt"
  >;
  readonly lifecycleEvents: readonly Pick<
    WardrobeLifecycleEvent,
    "eventKind" | "occurredAt"
  >[];
  readonly dismissedKeys: ReadonlySet<string>;
  readonly now: string;
}

const MS_PER_DAY = 86_400_000;

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (Number.isNaN(from) || Number.isNaN(to) || to < from) {
    return 0;
  }
  return Math.floor((to - from) / MS_PER_DAY);
}

function itemAgeDays(
  item: Pick<WardrobeItem, "acquiredAt" | "createdAt">,
  now: string,
): number {
  const anchor = item.acquiredAt ?? item.createdAt;
  return daysBetween(anchor, now);
}

function lastEventDaysAgo(
  events: readonly Pick<WardrobeLifecycleEvent, "eventKind" | "occurredAt">[],
  kind: WardrobeLifecycleEventKind,
  now: string,
): number | null {
  const matches = events.filter((event) => event.eventKind === kind);
  if (matches.length === 0) return null;
  const latest = matches.reduce((a, b) =>
    Date.parse(a.occurredAt) >= Date.parse(b.occurredAt) ? a : b,
  );
  return daysBetween(latest.occurredAt, now);
}

function wearPressure(
  wearFrequency: WardrobeWearFrequency | undefined,
): "low" | "medium" | "high" {
  switch (wearFrequency) {
    case "frequently":
      return "high";
    case "regularly":
      return "medium";
    case "occasionally":
    case "rarely":
      return "low";
    default:
      return "low";
  }
}

/**
 * Deterministic, dismissible guidance from actual wardrobe state.
 * No coercive replacement or hidden scores.
 */
export function deriveWardrobeGuidance(
  input: WardrobeLifecycleGuidanceInput,
): readonly WardrobeGuidanceItem[] {
  const guidance: WardrobeGuidanceItem[] = [];
  const { item, lifecycleEvents, dismissedKeys, now } = input;
  const ageDays = itemAgeDays(item, now);
  const pressure = wearPressure(item.wearFrequency);

  if (item.careState === "due_soon" || item.careState === "needs_attention") {
    const key = `${item.id}:care_due`;
    if (!dismissedKeys.has(key)) {
      guidance.push({
        key,
        kind: "care_due",
        title: "Care may be due",
        explanation:
          item.careState === "needs_attention"
            ? `${item.displayName} is marked as needing care attention. A professional clean or repair keeps cloth performing well without rushing replacement.`
            : `${item.displayName} is approaching a care interval. When convenient, schedule cleaning or minor repair to protect the fabric.`,
        dismissible: true,
      });
    }
  }

  if (item.condition === "needs_care" || item.condition === "fair") {
    const key = `${item.id}:repair_attention`;
    if (!dismissedKeys.has(key)) {
      guidance.push({
        key,
        kind: "repair_attention",
        title: "Repair can extend life",
        explanation: `${item.displayName} shows wear that often responds well to repair or re-crafting. Your house can advise without implying you must replace the piece.`,
        dismissible: true,
      });
    }
  }

  const daysSinceClean = lastEventDaysAgo(lifecycleEvents, "cleaned", now);
  const cleanThreshold =
    pressure === "high" ? 90 : pressure === "medium" ? 120 : 180;
  if (
    (daysSinceClean === null || daysSinceClean >= cleanThreshold) &&
    pressure !== "low" &&
    item.careState !== "in_service"
  ) {
    const key = `${item.id}:rest_rotation`;
    if (!dismissedKeys.has(key)) {
      guidance.push({
        key,
        kind: "rest_rotation",
        title: "Rotation helps cloth rest",
        explanation: `${item.displayName} has been in regular rotation. Letting structured pieces rest between wears helps fibres recover — especially with wools and linens.`,
        dismissible: true,
      });
    }
  }

  if (ageDays >= 365 * 3 && item.condition !== "retired") {
    const key = `${item.id}:longevity_celebration`;
    if (!dismissedKeys.has(key)) {
      guidance.push({
        key,
        kind: "longevity_celebration",
        title: "A well-kept companion",
        explanation: `${item.displayName} has been with you for several seasons. Longevity is a sign of good ownership — not a prompt to replace it.`,
        dismissible: true,
      });
    }
  }

  return guidance;
}

export interface WardrobeLifecycleStateSnapshot {
  readonly ageDays: number;
  readonly condition: WardrobeConditionState;
  readonly wearFrequency?: WardrobeWearFrequency;
  readonly careState: WardrobeCareState;
  readonly lastCleanedDaysAgo: number | null;
  readonly lastRepairedDaysAgo: number | null;
}

export function snapshotWardrobeLifecycleState(params: {
  readonly item: Pick<
    WardrobeItem,
    "condition" | "wearFrequency" | "careState" | "acquiredAt" | "createdAt"
  >;
  readonly lifecycleEvents: readonly Pick<
    WardrobeLifecycleEvent,
    "eventKind" | "occurredAt"
  >[];
  readonly now: string;
}): WardrobeLifecycleStateSnapshot {
  return {
    ageDays: itemAgeDays(params.item, params.now),
    condition: params.item.condition,
    ...(params.item.wearFrequency
      ? { wearFrequency: params.item.wearFrequency }
      : {}),
    careState: params.item.careState,
    lastCleanedDaysAgo: lastEventDaysAgo(
      params.lifecycleEvents,
      "cleaned",
      params.now,
    ),
    lastRepairedDaysAgo: lastEventDaysAgo(
      params.lifecycleEvents,
      "repaired",
      params.now,
    ),
  };
}
