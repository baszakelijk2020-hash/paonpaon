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
  /** A campaign activation's own staff mission (PHASE 10.1) — the same
   * draft-task/contact-pressure/outcome-linking object every other type
   * already is, distinguished only by carrying a campaignId. */
  "campaign_mission",
  /** An advisor's own confirmed follow-up, usually from advisor capture —
   * the same draft-task object, distinguished only by having no
   * system-detected trigger behind it. */
  "advisor_commitment",
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
  /** Set only for type "campaign_mission" (PHASE 10.1) — which activation created this mission. */
  readonly campaignId?: string;
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

/**
 * One candidate customer for a campaign activation rehearsal (PHASE 10.1).
 * The audience-rule match itself is decided by campaign.ts's
 * evaluateAudienceRules — this stays with the per-customer contact-pressure
 * check specifically, so the two concerns are never conflated into one
 * opaque yes/no.
 */
export interface CampaignRehearsalCandidate {
  readonly customerId: CustomerId;
  readonly audienceMatch:
    { readonly ok: true } | { readonly ok: false; readonly reason: string };
  readonly recentTouchCount: number;
  readonly cooldownUntil?: string;
}

export type CampaignRehearsalOutcome =
  | { readonly customerId: CustomerId; readonly result: "eligible" }
  | {
      readonly customerId: CustomerId;
      readonly result: "excluded";
      readonly reason: string;
    }
  | { readonly customerId: CustomerId; readonly result: "contact_pressure" };

export interface CampaignRehearsalReport {
  readonly eligibleCount: number;
  readonly excludedCount: number;
  readonly contactPressureCount: number;
  readonly outcomes: readonly CampaignRehearsalOutcome[];
}

/**
 * Previews who a campaign activation would actually reach, without writing
 * anything — 10.1's acceptance requires a campaign to be "rehearsed with
 * prerequisites/exclusions/contact pressure" before it is activated into
 * live missions and customer placements. Every candidate falls into exactly
 * one bucket: audience mismatch, contact-pressure suppressed, or eligible.
 */
export function evaluateCampaignRehearsal(args: {
  readonly candidates: readonly CampaignRehearsalCandidate[];
  readonly now: string;
}): CampaignRehearsalReport {
  const outcomes: CampaignRehearsalOutcome[] = args.candidates.map(
    (candidate) => {
      if (!candidate.audienceMatch.ok) {
        return {
          customerId: candidate.customerId,
          result: "excluded",
          reason: candidate.audienceMatch.reason,
        };
      }
      const pressure = isContactPressureActive({
        recentTouchCount: candidate.recentTouchCount,
        now: args.now,
        ...(candidate.cooldownUntil
          ? { cooldownUntil: candidate.cooldownUntil }
          : {}),
      });
      if (pressure) {
        return { customerId: candidate.customerId, result: "contact_pressure" };
      }
      return { customerId: candidate.customerId, result: "eligible" };
    },
  );

  return {
    eligibleCount: outcomes.filter((o) => o.result === "eligible").length,
    excludedCount: outcomes.filter((o) => o.result === "excluded").length,
    contactPressureCount: outcomes.filter(
      (o) => o.result === "contact_pressure",
    ).length,
    outcomes,
  };
}

export interface BuildCampaignMissionInput {
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly campaignId: string;
  readonly campaignTitle: string;
  readonly staffMission: string;
  readonly now: string;
  readonly assignedStaffId?: StaffId;
}

/**
 * One shared staff mission for one customer under one campaign activation
 * (PHASE 10.1). "Shared" means every eligible customer under the same
 * activation gets the identical suggestedAction text (the campaign's own
 * staffMission from its pinned library snapshot) — a mission is not
 * re-authored per customer, only targeted per customer.
 */
export function buildCampaignMissionOpportunity(
  input: BuildCampaignMissionInput,
): Omit<ClientelingOpportunity, "id" | "createdAt" | "updatedAt"> {
  return {
    retailerId: input.retailerId,
    customerId: input.customerId,
    type: "campaign_mission",
    whyNow: `Eligible for the "${input.campaignTitle}" campaign.`,
    suggestedAction: input.staffMission,
    channel: "in_person",
    priority: 2,
    confidence: 1,
    status: "draft",
    contactPressure: false,
    campaignId: input.campaignId,
    evidence: [],
    ...(input.assignedStaffId
      ? { assignedStaffId: input.assignedStaffId }
      : {}),
    expiresAt: new Date(
      Date.parse(input.now) + 30 * 24 * 60 * 60 * 1000,
    ).toISOString(),
    projectorVersion: CLIENTELING_OPPORTUNITY_PROJECTOR_VERSION,
  };
}
