/**
 * Clienteling outcome funnel integrity (CLI-009 / PHASE 7.8 / ADR-066).
 * Completed opportunities classify into message, appointment, sale,
 * no-response, or pending outcome links.
 */

import type { ClientelingOpportunityStatus } from "./clienteling-opportunity";

export const OUTCOME_FUNNEL_PROJECTOR_VERSION = "outcome-funnel-v1";

export const OUTCOME_TYPES = [
  "message",
  "appointment",
  "sale",
  "no_response",
  "pending",
] as const;

export type OutcomeType = (typeof OUTCOME_TYPES)[number];

export interface OutcomeFunnelRow {
  readonly type: OutcomeType;
  readonly count: number;
}

export interface OutcomeFunnelCounts {
  readonly message: number;
  readonly appointment: number;
  readonly sale: number;
  readonly noResponse: number;
  readonly pending: number;
  readonly completedTotal: number;
}

export interface OutcomeLinkedOpportunity {
  readonly status: ClientelingOpportunityStatus;
  readonly outcomeMessageId?: string;
  readonly outcomeAppointmentId?: string;
  readonly outcomeOrderId?: string;
}

export function classifyOpportunityOutcome(
  opportunity: OutcomeLinkedOpportunity,
): OutcomeType {
  if (opportunity.outcomeOrderId) return "sale";
  if (opportunity.outcomeAppointmentId) return "appointment";
  if (opportunity.outcomeMessageId) return "message";

  if (
    opportunity.status === "completed" ||
    opportunity.status === "dismissed" ||
    opportunity.status === "incorrect"
  ) {
    return "no_response";
  }

  return "pending";
}

export function projectOutcomeFunnel(
  opportunities: readonly OutcomeLinkedOpportunity[],
): OutcomeFunnelCounts {
  let message = 0;
  let appointment = 0;
  let sale = 0;
  let noResponse = 0;
  let pending = 0;
  let completedTotal = 0;

  for (const opportunity of opportunities) {
    const outcome = classifyOpportunityOutcome(opportunity);
    switch (outcome) {
      case "message":
        message += 1;
        completedTotal += 1;
        break;
      case "appointment":
        appointment += 1;
        completedTotal += 1;
        break;
      case "sale":
        sale += 1;
        completedTotal += 1;
        break;
      case "no_response":
        noResponse += 1;
        completedTotal += 1;
        break;
      case "pending":
        pending += 1;
        break;
    }
  }

  return {
    message,
    appointment,
    sale,
    noResponse,
    pending,
    completedTotal,
  };
}

export function outcomeFunnelRows(
  counts: OutcomeFunnelCounts,
): readonly OutcomeFunnelRow[] {
  return [
    { type: "message", count: counts.message },
    { type: "appointment", count: counts.appointment },
    { type: "sale", count: counts.sale },
    { type: "no_response", count: counts.noResponse },
    { type: "pending", count: counts.pending },
  ];
}
