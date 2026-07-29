/**
 * MorningRoutine delivery scheduling and retailer eligible-product controls
 * (MR-002, MR-003, CUST-003 / PHASE 4.5 / ADR-061).
 *
 * Explicit subscription opt-in is independent of marketing consent.
 * Delivery always derives from a persisted selection; retailer eligible
 * products may filter catalogue secondary picks only — never inject ads.
 */

import type {
  CustomerId,
  MorningRoutineDeliveryAuditId,
  MorningRoutineSelectionId,
  MorningRoutineSubscriptionId,
  NotificationId,
  ProductId,
  RetailerId,
  StaffId,
} from "../shared/branded-id";

export const MORNING_ROUTINE_DELIVERY_FREQUENCIES = [
  "daily",
  "weekdays",
  "weekly",
] as const;

export type MorningRoutineDeliveryFrequency =
  (typeof MORNING_ROUTINE_DELIVERY_FREQUENCIES)[number];

export const MORNING_ROUTINE_DELIVERY_CHANNELS = ["in_app", "email"] as const;

export type MorningRoutineDeliveryChannel =
  (typeof MORNING_ROUTINE_DELIVERY_CHANNELS)[number];

export const MORNING_ROUTINE_DELIVERY_OUTCOMES = [
  "queued_in_app",
  "queued_email",
  "suppressed",
  "skipped_quiet_hours",
  "skipped_frequency",
  "skipped_not_opted_in",
  "skipped_no_selection",
  "skipped_duplicate",
  "skipped_retailer_paused",
  "failed",
] as const;

export type MorningRoutineDeliveryOutcome =
  (typeof MORNING_ROUTINE_DELIVERY_OUTCOMES)[number];

export const MORNING_ROUTINE_SUPPRESSION_REASONS = [
  "customer_opt_out",
  "product_not_eligible",
  "duplicate_for_date",
  "retailer_paused",
  "unrelated_promotion_blocked",
  "manual",
] as const;

export type MorningRoutineSuppressionReason =
  (typeof MORNING_ROUTINE_SUPPRESSION_REASONS)[number];

export interface MorningRoutineQuietHours {
  readonly startMinute: number;
  readonly endMinute: number;
}

export interface MorningRoutineSubscription {
  readonly id: MorningRoutineSubscriptionId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly optedIn: boolean;
  readonly optedInAt?: string;
  readonly optedOutAt?: string;
  readonly frequency: MorningRoutineDeliveryFrequency;
  readonly timezone: string;
  readonly quietHours?: MorningRoutineQuietHours;
  readonly channels: readonly MorningRoutineDeliveryChannel[];
  readonly preferredLocalHour: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MorningRoutineDeliveryAudit {
  readonly id: MorningRoutineDeliveryAuditId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly selectionId?: MorningRoutineSelectionId;
  readonly forDate: string;
  readonly outcome: MorningRoutineDeliveryOutcome;
  readonly suppressionReason?: MorningRoutineSuppressionReason;
  readonly notificationId?: NotificationId;
  readonly scheduledFor: string;
  readonly createdAt: string;
}

export interface MorningRoutineEligibleProduct {
  readonly retailerId: RetailerId;
  readonly productId: ProductId;
  readonly active: boolean;
  readonly createdByStaffId?: StaffId;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MorningRoutineRetailerDeliverySettings {
  readonly retailerId: RetailerId;
  readonly paused: boolean;
  readonly updatedAt: string;
}

function clampMinute(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1439, Math.max(0, Math.trunc(value)));
}

export function isValidIanaTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/** Local calendar YYYY-MM-DD in the subscription timezone. */
export function localDateInTimezone(
  nowUtcIso: string,
  timezone: string,
): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: isValidIanaTimezone(timezone) ? timezone : "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date(nowUtcIso));
}

export function localMinutesInTimezone(
  nowUtcIso: string,
  timezone: string,
): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: isValidIanaTimezone(timezone) ? timezone : "UTC",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(nowUtcIso));
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? "0",
  );
  return hour * 60 + minute;
}

export function isInQuietHours(
  localMinute: number,
  quietHours: MorningRoutineQuietHours | undefined,
): boolean {
  if (!quietHours) return false;
  const start = clampMinute(quietHours.startMinute);
  const end = clampMinute(quietHours.endMinute);
  if (start === end) return false;
  if (start < end) {
    return localMinute >= start && localMinute < end;
  }
  return localMinute >= start || localMinute < end;
}

export function matchesDeliveryFrequency(args: {
  readonly frequency: MorningRoutineDeliveryFrequency;
  readonly forDate: string;
  readonly weekday: number; // 0=Sun … 6=Sat in local TZ
}): boolean {
  switch (args.frequency) {
    case "daily":
      return true;
    case "weekdays":
      return args.weekday >= 1 && args.weekday <= 5;
    case "weekly":
      return args.weekday === 1;
    default: {
      const _exhaustive: never = args.frequency;
      return _exhaustive;
    }
  }
}

export function localWeekdayInTimezone(
  nowUtcIso: string,
  timezone: string,
): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: isValidIanaTimezone(timezone) ? timezone : "UTC",
    weekday: "short",
  }).format(new Date(nowUtcIso));
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[weekday] ?? 0;
}

/**
 * Pure delivery gate. Does not enqueue — callers persist audit + notifications.
 */
export function evaluateMorningRoutineDelivery(args: {
  readonly subscription: Pick<
    MorningRoutineSubscription,
    | "optedIn"
    | "frequency"
    | "timezone"
    | "quietHours"
    | "channels"
    | "preferredLocalHour"
  >;
  readonly nowUtcIso: string;
  readonly alreadyDeliveredForDate: boolean;
  readonly selectionId?: MorningRoutineSelectionId | string;
  readonly retailerPaused?: boolean;
}):
  | {
      readonly ok: true;
      readonly forDate: string;
      readonly channels: readonly MorningRoutineDeliveryChannel[];
    }
  | {
      readonly ok: false;
      readonly forDate: string;
      readonly outcome: MorningRoutineDeliveryOutcome;
      readonly suppressionReason?: MorningRoutineSuppressionReason;
    } {
  const forDate = localDateInTimezone(
    args.nowUtcIso,
    args.subscription.timezone,
  );

  if (!args.subscription.optedIn) {
    return {
      ok: false,
      forDate,
      outcome: "skipped_not_opted_in",
      suppressionReason: "customer_opt_out",
    };
  }
  if (args.retailerPaused) {
    return {
      ok: false,
      forDate,
      outcome: "skipped_retailer_paused",
      suppressionReason: "retailer_paused",
    };
  }
  if (args.alreadyDeliveredForDate) {
    return {
      ok: false,
      forDate,
      outcome: "skipped_duplicate",
      suppressionReason: "duplicate_for_date",
    };
  }
  if (!args.selectionId) {
    return { ok: false, forDate, outcome: "skipped_no_selection" };
  }

  const weekday = localWeekdayInTimezone(
    args.nowUtcIso,
    args.subscription.timezone,
  );
  if (
    !matchesDeliveryFrequency({
      frequency: args.subscription.frequency,
      forDate,
      weekday,
    })
  ) {
    return { ok: false, forDate, outcome: "skipped_frequency" };
  }

  const localMinute = localMinutesInTimezone(
    args.nowUtcIso,
    args.subscription.timezone,
  );
  if (isInQuietHours(localMinute, args.subscription.quietHours)) {
    return { ok: false, forDate, outcome: "skipped_quiet_hours" };
  }

  const preferredStart = args.subscription.preferredLocalHour * 60;
  if (localMinute < preferredStart) {
    return { ok: false, forDate, outcome: "skipped_quiet_hours" };
  }

  const channels = args.subscription.channels.filter(
    (channel) => channel === "in_app" || channel === "email",
  );
  if (channels.length === 0) {
    return { ok: false, forDate, outcome: "skipped_not_opted_in" };
  }

  return { ok: true, forDate, channels };
}

/**
 * Catalogue secondary recommendations may only include retailer-eligible
 * active products. Owned garments are never filtered by eligibility.
 */
export function filterCatalogueByEligibleProducts<
  T extends {
    readonly productId?: string;
    readonly source: "owned" | "catalogue";
  },
>(
  recommendations: readonly T[],
  eligibleActiveProductIds: ReadonlySet<string>,
): {
  readonly kept: readonly T[];
  readonly suppressedCatalogueCount: number;
} {
  const kept: T[] = [];
  let suppressedCatalogueCount = 0;
  for (const recommendation of recommendations) {
    if (recommendation.source === "owned") {
      kept.push(recommendation);
      continue;
    }
    const productId = recommendation.productId;
    if (productId && eligibleActiveProductIds.has(productId)) {
      kept.push(recommendation);
    } else {
      suppressedCatalogueCount += 1;
    }
  }
  return { kept, suppressedCatalogueCount };
}

export function buildMorningRoutineDeliveryNotification(args: {
  readonly summary: string;
  readonly forDate: string;
  readonly recommendationCount: number;
}): {
  readonly title: string;
  readonly body: string;
  readonly actionHref: string;
} {
  return {
    title: `MorningRoutine for ${args.forDate}`,
    body:
      args.recommendationCount > 0
        ? `${args.summary} Open MorningRoutine to save, review, book, or buy.`
        : `${args.summary}`,
    actionHref: "/morning-routine",
  };
}
