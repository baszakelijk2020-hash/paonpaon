/**
 * Mission Control Decision Intelligence (PHASE 11.6 / build-order item 6).
 *
 * A ranked, explainable "why now / what next" view over existing retail signals:
 * clienteling opportunities, appointments, unread messages, price approvals, low stock.
 *
 * This is a pure, read-side composition and ranking layer — no new opaque model,
 * no new parallel data store. Ranking uses fixed, named, inspectable weights per
 * entry kind, combined with urgency derived from due/start times. Every ranked
 * entry carries its reason, confidence (where present), and rule version so
 * ranking changes are always auditable.
 *
 * Following the "no black box" discipline already enforced in scoreOpportunity
 * (corporate/business-development.ts): every weight is named, published, and
 * explicit, with all contributing factors visible.
 */

import type { ClientelingOpportunityType } from "../intelligence/clienteling-opportunity";
import type { AppointmentId, CustomerId } from "../shared/branded-id";

export const DECISION_FEED_RULE_VERSION = 1;

/**
 * Fixed, published weight per entry kind — the entire ranking formula.
 * A weight change is a code change and a PHASE.md addendum, not a silent
 * runtime tuning knob.
 *
 * Base weights rank by type priority:
 * - High urgency (pending approval, imminent appointment): 90–100
 * - Medium urgency (unread messages, draft opportunities): 50–70
 * - Lower baseline (low stock): 20–30
 *
 * Urgency modifiers add to the base weight when due/start time is close.
 */
export const DECISION_FEED_ENTRY_WEIGHTS: Record<
  DecisionFeedEntryKind,
  {
    readonly baseWeight: number;
    readonly description: string;
  }
> = {
  clienteling_opportunity: {
    baseWeight: 60,
    description: "Draft clienteling opportunity, awaiting decision",
  },
  appointment_soon: {
    baseWeight: 85,
    description: "Appointment starting soon (within 2 hours)",
  },
  appointment_today: {
    baseWeight: 70,
    description: "Appointment scheduled for today",
  },
  price_approval_pending: {
    baseWeight: 90,
    description: "Alteration price approval pending",
  },
  unread_message: {
    baseWeight: 55,
    description: "Unread customer message or conversation",
  },
  low_stock: {
    baseWeight: 25,
    description: "Product variant at or below low-stock threshold",
  },
};

export type DecisionFeedEntryKind =
  | "clienteling_opportunity"
  | "appointment_soon"
  | "appointment_today"
  | "price_approval_pending"
  | "unread_message"
  | "low_stock";

/**
 * Input shape: a discriminated union covering each of the five signal sources.
 * All optional fields are named explicitly so the ranking function can see
 * exactly which inputs had which confidence/urgency information.
 */
export type DecisionFeedInput =
  | {
      readonly kind: "clienteling_opportunity";
      readonly sourceId: string;
      readonly customerId: CustomerId;
      readonly opportunityType: ClientelingOpportunityType;
      readonly whyNow: string;
      readonly suggestedAction: string;
      readonly priority: number;
      readonly confidence: number;
      readonly dueAt?: string;
      readonly expiresAt?: string;
    }
  | {
      readonly kind: "appointment_soon" | "appointment_today";
      readonly sourceId: AppointmentId;
      readonly customerId: CustomerId;
      readonly startsAt: string;
      readonly customerName?: string;
      readonly appointmentType: string;
    }
  | {
      readonly kind: "price_approval_pending";
      readonly sourceId: string;
      readonly workOrderNumber: string;
      readonly originalAmountMinorUnits: number;
      readonly proposedAmountMinorUnits: number;
    }
  | {
      readonly kind: "unread_message";
      readonly sourceId: string;
      readonly messageThreadId: string;
      readonly unreadCount: number;
    }
  | {
      readonly kind: "low_stock";
      readonly sourceId: string;
      readonly variantName: string;
      readonly unitCount: number;
    };

/**
 * Output shape: the input entry with ranking metadata added.
 * Every entry shows why it was ranked where it was, not just the number.
 */
export interface RankedDecisionFeedEntry {
  readonly input: DecisionFeedInput;
  readonly rank: number;
  readonly score: number;
  readonly reasonCode: string;
  readonly reasonText: string;
  readonly confidence?: number;
  readonly ruleVersion: number;
}

/**
 * Urgency scoring: closer due/start times score higher.
 * For appointments and time-bound opportunities, a time within 2 hours
 * of now is "imminent" (+30 urgency points), less than 24 hours is "today"
 * (+15 points), beyond that gets base weight only.
 */
function computeUrgencyBonus(
  now: Date,
  dueAtOrStartsAt?: string,
): { bonus: number; reason: string } {
  if (!dueAtOrStartsAt) {
    return { bonus: 0, reason: "no_due_time" };
  }

  const dueMs = new Date(dueAtOrStartsAt).getTime();
  const nowMs = now.getTime();
  const minutesUntil = (dueMs - nowMs) / (60 * 1000);

  if (minutesUntil < 0) {
    return { bonus: 0, reason: "already_due" };
  }

  if (minutesUntil <= 120) {
    // Within 2 hours: highly imminent
    return { bonus: 30, reason: "imminent_within_2h" };
  }

  if (minutesUntil <= 1440) {
    // Within 24 hours: today
    return { bonus: 15, reason: "within_today" };
  }

  return { bonus: 0, reason: "future" };
}

/**
 * Rank a set of decision feed entries using fixed weights and urgency.
 * Pure function, deterministic, no I/O.
 *
 * Algorithm:
 * 1. For each entry, compute base weight from DECISION_FEED_ENTRY_WEIGHTS
 * 2. Add urgency bonus if the entry has a due/start time close to now
 * 3. For clienteling opportunities, factor in explicit confidence (0–1)
 * 4. Sort by final score (descending), then by original order (stable)
 * 5. Assign rank (position) starting from 1
 */
export function rankDecisionFeedEntries(
  inputs: readonly DecisionFeedInput[],
  now: Date = new Date(),
): RankedDecisionFeedEntry[] {
  // Score each entry
  const scored = inputs.map((input) => {
    const weightInfo = DECISION_FEED_ENTRY_WEIGHTS[input.kind];
    let baseScore = weightInfo.baseWeight;
    let reasonText = weightInfo.description;
    let confidenceValue: number | undefined;

    // Apply input-specific modifiers
    if (input.kind === "clienteling_opportunity") {
      confidenceValue = input.confidence;
      // Confidence modifier: 0–1 scales to 0–20 bonus points
      const confidenceBonus = input.confidence * 20;
      // Priority modifier: lower priority number = higher urgency (+5 per level)
      const priorityBonus = Math.max(0, 10 - input.priority * 5);
      baseScore += confidenceBonus + priorityBonus;
      reasonText = input.whyNow;
    }

    if (input.kind === "appointment_soon") {
      confidenceValue = 1; // Appointments are certain
      reasonText = `Appointment with ${input.customerName ?? "customer"} starts in a few minutes`;
    }

    if (input.kind === "appointment_today") {
      confidenceValue = 1;
      reasonText = `Appointment with ${input.customerName ?? "customer"} today at ${new Date(input.startsAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
    }

    if (input.kind === "price_approval_pending") {
      confidenceValue = 1;
      reasonText = `Price approval needed: ${input.workOrderNumber}`;
    }

    if (input.kind === "unread_message") {
      confidenceValue = 1;
      reasonText =
        input.unreadCount === 1
          ? "One unread message waiting"
          : `${input.unreadCount} unread messages waiting`;
    }

    if (input.kind === "low_stock") {
      confidenceValue = 1;
      reasonText = `${input.variantName} at or below 5 units (${input.unitCount} available)`;
    }

    // Compute urgency bonus based on due/start time
    let urgencyBonus = 0;
    let urgencyReason = "no_due_time";

    if (
      input.kind === "appointment_soon" ||
      input.kind === "appointment_today"
    ) {
      const urgency = computeUrgencyBonus(now, input.startsAt);
      urgencyBonus = urgency.bonus;
      urgencyReason = urgency.reason;
    } else if (input.kind === "clienteling_opportunity") {
      const urgency = computeUrgencyBonus(now, input.dueAt);
      urgencyBonus = urgency.bonus;
      urgencyReason = urgency.reason;
    }

    const finalScore = baseScore + urgencyBonus;
    const reasonCode = `${input.kind}:${urgencyReason}`;

    return {
      input,
      score: finalScore,
      reasonCode,
      reasonText,
      confidence: confidenceValue,
      originalIndex: inputs.indexOf(input),
    };
  });

  // Sort by score (descending), then by original order (stable)
  const sorted = scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.originalIndex - b.originalIndex;
  });

  // Assign ranks and build output
  return sorted.map((entry, index) => ({
    input: entry.input,
    rank: index + 1,
    score: entry.score,
    reasonCode: entry.reasonCode,
    reasonText: entry.reasonText,
    ...(entry.confidence !== undefined ? { confidence: entry.confidence } : {}),
    ruleVersion: DECISION_FEED_RULE_VERSION,
  }));
}
