/**
 * MorningRoutine delivery orchestration (MR-002, MR-003, CUST-003 / PHASE 4.5).
 *
 * Delivery requires explicit opt-in separate from marketing consent.
 * Retailer eligible-product controls constrain catalogue picks only.
 */

import type { CustomerId, ProductId, RetailerId } from "../shared/branded-id";

import type {
  MorningRoutineRecommendation,
  MorningRoutineSelection,
} from "./morning-routine";

export const MORNING_ROUTINE_DELIVERY_FREQUENCIES = [
  "daily",
  "weekly",
] as const;

export type MorningRoutineDeliveryFrequency =
  (typeof MORNING_ROUTINE_DELIVERY_FREQUENCIES)[number];

export const MORNING_ROUTINE_DELIVERY_CHANNELS = ["in_app", "email"] as const;

export type MorningRoutineDeliveryChannel =
  (typeof MORNING_ROUTINE_DELIVERY_CHANNELS)[number];

export const MORNING_ROUTINE_DELIVERY_STATUSES = [
  "pending",
  "sent",
  "suppressed",
  "failed",
] as const;

export type MorningRoutineDeliveryStatus =
  (typeof MORNING_ROUTINE_DELIVERY_STATUSES)[number];

export const MORNING_ROUTINE_SUPPRESSION_REASONS = [
  "not_opted_in",
  "unsubscribed",
  "personalization_withdrawn",
  "retailer_disabled",
  "quiet_period",
  "already_delivered",
  "wrong_frequency",
  "not_due_yet",
  "no_selection",
  "no_email_on_file",
  "missing_personalization_consent",
] as const;

export type MorningRoutineSuppressionReason =
  (typeof MORNING_ROUTINE_SUPPRESSION_REASONS)[number];

export interface MorningRoutineSubscription {
  readonly retailerId: RetailerId | string;
  readonly customerId: CustomerId | string;
  readonly deliveryOptIn: boolean;
  readonly frequency: MorningRoutineDeliveryFrequency;
  readonly channels: readonly MorningRoutineDeliveryChannel[];
  readonly timezone: string;
  readonly deliveryHourLocal: number;
  readonly quietStartHour: number | null;
  readonly quietEndHour: number | null;
  readonly weeklyAnchorDow: number;
  readonly unsubscribedAt?: string;
}

export interface MorningRoutineRetailerDeliverySettings {
  readonly retailerId: RetailerId | string;
  readonly enabled: boolean;
  readonly deliveryHourLocal: number;
  readonly eligibleProductIds: readonly (ProductId | string)[];
}

export interface MorningRoutineDeliveryPayload {
  readonly selectionId: string;
  readonly forDate: string;
  readonly summary: string;
  readonly recommendations: readonly Pick<
    MorningRoutineRecommendation,
    "rank" | "source" | "displayName" | "explanation"
  >[];
  readonly routineHref: string;
  readonly unsubscribeHref: string;
}

export interface MorningRoutineDeliveryDecision {
  readonly deliver: boolean;
  readonly reason?: MorningRoutineSuppressionReason;
}

/** Local hour (0–23) for an IANA timezone; falls back to UTC on invalid zones. */
export function getLocalHour(now: Date, timezone: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    }).formatToParts(now);
    const hour = parts.find((part) => part.type === "hour")?.value;
    const parsed = hour ? Number(hour) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : now.getUTCHours();
  } catch {
    return now.getUTCHours();
  }
}

/** Local calendar date YYYY-MM-DD for an IANA timezone. */
export function getLocalDateString(now: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** Day of week 0=Sunday … 6=Saturday in the subscription timezone. */
export function getLocalDayOfWeek(now: Date, timezone: string): number {
  try {
    const weekday = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
    }).format(now);
    const map: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    return map[weekday] ?? now.getUTCDay();
  } catch {
    return now.getUTCDay();
  }
}

export function isWithinQuietPeriod(
  hourLocal: number,
  quietStart: number | null,
  quietEnd: number | null,
): boolean {
  if (quietStart === null || quietEnd === null) return false;
  if (quietStart === quietEnd) return false;
  if (quietStart < quietEnd) {
    return hourLocal >= quietStart && hourLocal < quietEnd;
  }
  return hourLocal >= quietStart || hourLocal < quietEnd;
}

export function matchesDeliveryFrequency(args: {
  readonly frequency: MorningRoutineDeliveryFrequency;
  readonly weeklyAnchorDow: number;
  readonly localDow: number;
  readonly forDate: string;
  readonly lastWeeklyDeliveryDate?: string;
}): boolean {
  if (args.frequency === "daily") return true;
  if (args.localDow !== args.weeklyAnchorDow) return false;
  if (!args.lastWeeklyDeliveryDate) return true;
  return args.lastWeeklyDeliveryDate < args.forDate;
}

export function shouldDeliverMorningRoutine(args: {
  readonly subscription: MorningRoutineSubscription;
  readonly retailerSettings: MorningRoutineRetailerDeliverySettings;
  readonly personalizationGranted: boolean;
  readonly now: Date;
  readonly forDate: string;
  readonly localHour: number;
  readonly localDow: number;
  readonly deliveredChannelsToday: readonly MorningRoutineDeliveryChannel[];
  readonly lastWeeklyDeliveryDate?: string;
}): MorningRoutineDeliveryDecision {
  if (args.subscription.unsubscribedAt || !args.subscription.deliveryOptIn) {
    return {
      deliver: false,
      reason: args.subscription.unsubscribedAt
        ? "unsubscribed"
        : "not_opted_in",
    };
  }
  if (!args.personalizationGranted) {
    return { deliver: false, reason: "missing_personalization_consent" };
  }
  if (!args.retailerSettings.enabled) {
    return { deliver: false, reason: "retailer_disabled" };
  }
  if (
    isWithinQuietPeriod(
      args.localHour,
      args.subscription.quietStartHour,
      args.subscription.quietEndHour,
    )
  ) {
    return { deliver: false, reason: "quiet_period" };
  }
  if (args.localHour !== args.subscription.deliveryHourLocal) {
    return { deliver: false, reason: "not_due_yet" };
  }
  if (
    !matchesDeliveryFrequency({
      frequency: args.subscription.frequency,
      weeklyAnchorDow: args.subscription.weeklyAnchorDow,
      localDow: args.localDow,
      forDate: args.forDate,
      ...(args.lastWeeklyDeliveryDate
        ? { lastWeeklyDeliveryDate: args.lastWeeklyDeliveryDate }
        : {}),
    })
  ) {
    return { deliver: false, reason: "wrong_frequency" };
  }
  const pendingChannels = args.subscription.channels.filter(
    (channel) => !args.deliveredChannelsToday.includes(channel),
  );
  if (pendingChannels.length === 0) {
    return { deliver: false, reason: "already_delivered" };
  }
  return { deliver: true };
}

/** Retailer eligible-product allowlist — empty means all active catalogue items. */
export function filterCatalogueByEligibleProducts<
  T extends { productId: string },
>(
  candidates: readonly T[],
  eligibleProductIds: readonly string[],
): readonly T[] {
  if (eligibleProductIds.length === 0) return candidates;
  const allowed = new Set(eligibleProductIds.map(String));
  return candidates.filter((candidate) =>
    allowed.has(String(candidate.productId)),
  );
}

export function buildMorningRoutineDeliveryPayload(args: {
  readonly selection: MorningRoutineSelection & { readonly id: string };
  readonly customerAppBaseUrl: string;
  readonly retailerSlug: string;
  readonly unsubscribeToken: string;
}): MorningRoutineDeliveryPayload {
  const routineHref = `${args.customerAppBaseUrl}/morning-routine`;
  const unsubscribeHref = `${args.customerAppBaseUrl}/morning-routine/unsubscribe?token=${encodeURIComponent(args.unsubscribeToken)}`;
  return {
    selectionId: args.selection.id,
    forDate: args.selection.forDate,
    summary: args.selection.summary,
    recommendations: args.selection.recommendations.map((recommendation) => ({
      rank: recommendation.rank,
      source: recommendation.source,
      displayName: recommendation.displayName,
      explanation: recommendation.explanation,
    })),
    routineHref,
    unsubscribeHref,
  };
}

export function buildMorningRoutineNotificationContent(
  payload: MorningRoutineDeliveryPayload,
  retailerName: string,
): {
  readonly title: string;
  readonly body: string;
  readonly actionHref: string;
} {
  const topPick = payload.recommendations[0];
  const body = topPick
    ? `${payload.summary} Top pick: ${topPick.displayName}.`
    : payload.summary;
  return {
    title: `MorningRoutine — ${retailerName}`,
    body,
    actionHref: payload.routineHref,
  };
}

export function buildMorningRoutineEmailHtml(
  payload: MorningRoutineDeliveryPayload,
  retailerName: string,
): string {
  const items = payload.recommendations
    .map(
      (recommendation) => `
      <li>
        <strong>${recommendation.rank}. ${recommendation.displayName}</strong>
        (${recommendation.source})
        <ul>${recommendation.explanation.map((line) => `<li>${line}</li>`).join("")}</ul>
      </li>`,
    )
    .join("");
  return `
    <p>Good morning,</p>
    <p>Your MorningRoutine from ${retailerName} for ${payload.forDate}:</p>
    <p>${payload.summary}</p>
    ${items.length > 0 ? `<ol>${items}</ol>` : "<p>No recommendations today.</p>"}
    <p><a href="${payload.routineHref}">Open MorningRoutine</a></p>
    <p style="font-size:12px;color:#666;">
      You opted in to personalised MorningRoutine delivery — not marketing mail.
      <a href="${payload.unsubscribeHref}">Unsubscribe</a>
    </p>
  `.trim();
}
