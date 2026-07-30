/**
 * Correction and deletion replay (CLI-009 / PHASE 7.8 / ADR-066).
 * Corrections recompute conclusions and expire stale opportunity drafts.
 */

import type { BehavioralEventId, CustomerFactId } from "../shared/branded-id";

import type {
  ClientelingOpportunityEvidence,
  ClientelingOpportunityStatus,
} from "./clienteling-opportunity";
import { interestEventDedupeKey } from "./customer-interest";
import type { BehavioralEvent } from "./interaction-event";

export const CORRECTION_REPLAY_PROJECTOR_VERSION = "correction-replay-v1";

export interface OpportunityCorrectionTarget {
  readonly id: string;
  readonly status: ClientelingOpportunityStatus;
  readonly evidence: readonly ClientelingOpportunityEvidence[];
}

export interface CorrectionReplayResult {
  readonly expireOpportunityIds: readonly string[];
  readonly markIncorrectOpportunityIds: readonly string[];
  readonly excludedEventIds: readonly BehavioralEventId[];
  readonly correctedFactIds: readonly CustomerFactId[];
  readonly projectorVersion: string;
}

export function evidenceReferencesCorrectedFact(
  evidence: readonly ClientelingOpportunityEvidence[],
  correctedFactIds: ReadonlySet<string>,
): boolean {
  return evidence.some((row) => row.factId && correctedFactIds.has(row.factId));
}

/**
 * Opportunities citing corrected facts should be marked incorrect; open drafts
 * referencing corrected evidence expire instead of staying actionable.
 */
export function resolveOpportunityCorrectionReplay(args: {
  readonly opportunities: readonly OpportunityCorrectionTarget[];
  readonly correctedFactIds: readonly CustomerFactId[];
  readonly now: string;
}): Pick<
  CorrectionReplayResult,
  "expireOpportunityIds" | "markIncorrectOpportunityIds"
> {
  const factSet = new Set(args.correctedFactIds);
  const expireOpportunityIds: string[] = [];
  const markIncorrectOpportunityIds: string[] = [];

  for (const opportunity of args.opportunities) {
    if (
      opportunity.status === "completed" ||
      opportunity.status === "expired" ||
      opportunity.status === "incorrect"
    ) {
      continue;
    }

    if (!evidenceReferencesCorrectedFact(opportunity.evidence, factSet)) {
      continue;
    }

    if (opportunity.status === "draft" || opportunity.status === "accepted") {
      expireOpportunityIds.push(opportunity.id);
      continue;
    }

    markIncorrectOpportunityIds.push(opportunity.id);
  }

  return { expireOpportunityIds, markIncorrectOpportunityIds };
}

export function excludeCorrectedEvents(
  events: readonly BehavioralEvent[],
  excludedEventIds: ReadonlySet<string>,
): readonly BehavioralEvent[] {
  if (excludedEventIds.size === 0) return events;
  return events.filter((event) => {
    if (event.id && excludedEventIds.has(event.id)) return false;
    const dedupe = interestEventDedupeKey(event);
    for (const excluded of excludedEventIds) {
      if (dedupe.includes(excluded)) return false;
    }
    return true;
  });
}

export function buildCorrectionReplay(args: {
  readonly opportunities: readonly OpportunityCorrectionTarget[];
  readonly correctedFactIds: readonly CustomerFactId[];
  readonly excludedEventIds: readonly BehavioralEventId[];
  readonly now: string;
}): CorrectionReplayResult {
  const replay = resolveOpportunityCorrectionReplay({
    opportunities: args.opportunities,
    correctedFactIds: args.correctedFactIds,
    now: args.now,
  });

  return {
    ...replay,
    excludedEventIds: [...new Set(args.excludedEventIds)],
    correctedFactIds: [...new Set(args.correctedFactIds)],
    projectorVersion: CORRECTION_REPLAY_PROJECTOR_VERSION,
  };
}
