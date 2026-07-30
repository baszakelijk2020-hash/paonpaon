/**
 * Sparse clienteling opportunities (CLI-004 / CLI-005 / PHASE 7.4 / ADR-066).
 * Draft tasks by default — never autonomous customer spam.
 */

import type {
  CustomerFactId,
  CustomerId,
  RetailerId,
  StaffId,
} from "../shared/branded-id";

export const CLIENTELING_OPPORTUNITY_TYPES = [
  "interest_follow_up",
  "purchase_care_check",
  "occasion_readiness",
  "relationship_dormancy",
  "wardrobe_gap",
  "anniversary_moment",
  "contact_pressure_warning",
] as const;

export type ClientelingOpportunityType =
  (typeof CLIENTELING_OPPORTUNITY_TYPES)[number];

export const CLIENTELING_OPPORTUNITY_STATUSES = [
  "draft",
  "accepted",
  "snoozed",
  "dismissed",
  "incorrect",
  "completed",
  "expired",
] as const;

export type ClientelingOpportunityStatus =
  (typeof CLIENTELING_OPPORTUNITY_STATUSES)[number];

export const CLIENTELING_CHANNELS = [
  "in_person",
  "message",
  "email",
  "phone",
  "appointment",
] as const;

export type ClientelingChannel = (typeof CLIENTELING_CHANNELS)[number];

export const CLIENTELING_OPPORTUNITY_PROJECTOR_VERSION =
  "clienteling-opportunity-v1";

/** Default cooldown after a completed/dismissed touch (days). */
export const DEFAULT_CONTACT_COOLDOWN_DAYS = 7;
/** Soft contact-pressure threshold inside a rolling window. */
export const DEFAULT_CONTACT_PRESSURE_TOUCHES = 3;
export const DEFAULT_CONTACT_PRESSURE_WINDOW_DAYS = 14;

export interface ClientelingOpportunityEvidence {
  readonly factId?: CustomerFactId;
  readonly insightStatement?: string;
  readonly note?: string;
}

export interface ClientelingOpportunity {
  readonly id: string;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly type: ClientelingOpportunityType;
  readonly whyNow: string;
  readonly suggestedAction: string;
  readonly channel: ClientelingChannel;
  readonly bestTimeWindow?: string;
  readonly assignedStaffId?: StaffId;
  readonly branchLabel?: string;
  readonly priority: number;
  readonly confidence: number;
  readonly status: ClientelingOpportunityStatus;
  readonly dueAt?: string;
  readonly expiresAt?: string;
  readonly cooldownUntil?: string;
  readonly contactPressure: boolean;
  readonly evidence: readonly ClientelingOpportunityEvidence[];
  readonly outcomeMessageId?: string;
  readonly outcomeAppointmentId?: string;
  readonly outcomeOrderId?: string;
  readonly projectorVersion: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ContactPressureInput {
  readonly recentTouchCount: number;
  readonly windowDays?: number;
  readonly threshold?: number;
  readonly cooldownUntil?: string;
  readonly now: string;
}

export function isContactPressureActive(input: ContactPressureInput): boolean {
  if (
    input.cooldownUntil &&
    Date.parse(input.cooldownUntil) > Date.parse(input.now)
  ) {
    return true;
  }
  const threshold = input.threshold ?? DEFAULT_CONTACT_PRESSURE_TOUCHES;
  return input.recentTouchCount >= threshold;
}

export interface BuildInterestFollowUpInput {
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly now: string;
  readonly insightStatements: readonly string[];
  readonly recentTouchCount: number;
  readonly cooldownUntil?: string;
  readonly assignedStaffId?: StaffId;
  readonly maxOpportunities?: number;
}

/**
 * Deterministic sparse opportunity drafts from cited interest statements.
 * Returns draft status only — activation is human-reviewed.
 */
export function buildInterestFollowUpOpportunities(
  input: BuildInterestFollowUpInput,
): readonly Omit<ClientelingOpportunity, "id" | "createdAt" | "updatedAt">[] {
  const pressure = isContactPressureActive({
    recentTouchCount: input.recentTouchCount,
    now: input.now,
    ...(input.cooldownUntil ? { cooldownUntil: input.cooldownUntil } : {}),
  });

  if (pressure) {
    return [
      {
        retailerId: input.retailerId,
        customerId: input.customerId,
        type: "contact_pressure_warning",
        whyNow: `Already ${input.recentTouchCount} touches in the recent window — pause outbound contact.`,
        suggestedAction: "Snooze or wait for the customer to initiate.",
        channel: "message",
        priority: 1,
        confidence: 0.95,
        status: "draft",
        contactPressure: true,
        ...(input.cooldownUntil ? { cooldownUntil: input.cooldownUntil } : {}),
        ...(input.assignedStaffId
          ? { assignedStaffId: input.assignedStaffId }
          : {}),
        evidence: input.insightStatements.slice(0, 3).map((statement) => ({
          insightStatement: statement,
        })),
        projectorVersion: CLIENTELING_OPPORTUNITY_PROJECTOR_VERSION,
      },
    ];
  }

  const max = input.maxOpportunities ?? 3;
  return input.insightStatements.slice(0, max).map((statement, index) => ({
    retailerId: input.retailerId,
    customerId: input.customerId,
    type: "interest_follow_up" as const,
    whyNow: statement,
    suggestedAction: "Open a short message or book a fabric appointment.",
    channel: "message" as const,
    bestTimeWindow: "weekday evening or Sunday morning",
    priority: index + 1,
    confidence: Math.max(0.4, 0.9 - index * 0.1),
    status: "draft" as const,
    contactPressure: false,
    expiresAt: new Date(
      Date.parse(input.now) + 14 * 24 * 60 * 60 * 1000,
    ).toISOString(),
    ...(input.assignedStaffId
      ? { assignedStaffId: input.assignedStaffId }
      : {}),
    evidence: [{ insightStatement: statement }],
    projectorVersion: CLIENTELING_OPPORTUNITY_PROJECTOR_VERSION,
  }));
}
