/**
 * Corporate business-development opportunities (BD-101 / PHASE 18.1).
 *
 * The InsiderTailoring pipeline model, deliberately without the "insider"
 * part yet: this file holds the opportunity, its signals and its score —
 * not the external signal discovery that will one day populate them. That
 * split is intentional. Building the discovery crawler before the pipeline
 * it feeds exists would mean scraping data with nowhere honest to put it;
 * the founder's own ordering for this build put "opportunity model" before
 * "external signal ingestion" for exactly that reason.
 *
 * The other house rule carries over unchanged from advisor capture: no
 * black box. `scoreOpportunity` is a plain, inspectable sum over named,
 * weighted signal sources — never an opaque model output — and it returns
 * the contributing signals alongside the number, so a manager can see
 * *why* an opportunity scored what it did, not just that it did.
 */

import type {
  CorporateAccountId,
  CorporateOpportunityId,
  CorporateOpportunitySignalId,
  RetailerId,
} from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";

export const CORPORATE_OPPORTUNITY_STAGES = [
  "identified",
  "qualified",
  "tender_sent",
  "won",
  "lost",
] as const;
export type CorporateOpportunityStage =
  (typeof CORPORATE_OPPORTUNITY_STAGES)[number];

const TERMINAL_STAGES: ReadonlySet<CorporateOpportunityStage> = new Set([
  "won",
  "lost",
]);

/** Stage -> stages it may move to next. Every entry is explicit; there is
 * no implicit "anything goes" fallback, so a UI cannot offer a transition
 * this model has not reasoned about. */
const ALLOWED_TRANSITIONS: Record<
  CorporateOpportunityStage,
  readonly CorporateOpportunityStage[]
> = {
  identified: ["qualified", "lost"],
  qualified: ["tender_sent", "lost"],
  tender_sent: ["won", "lost"],
  won: [],
  lost: [],
};

/**
 * Manually-entered signal sources for v1. No "web_scan" or "public_signal"
 * source exists yet — that is the not-yet-built external-ingestion item,
 * and adding a source kind for data this system cannot yet produce would
 * be a lie the schema tells on the ingestion feature's behalf.
 */
export const CORPORATE_OPPORTUNITY_SIGNAL_SOURCES = [
  "referral",
  "inbound_enquiry",
  "event",
  "existing_customer_link",
  "staff_observation",
  "other",
] as const;
export type CorporateOpportunitySignalSource =
  (typeof CORPORATE_OPPORTUNITY_SIGNAL_SOURCES)[number];

/** Fixed, published weight per source — the entire scoring formula. A
 * weight change is a code change and a PHASE.md addendum, not a silent
 * runtime tuning knob. */
const SIGNAL_SOURCE_WEIGHTS: Record<CorporateOpportunitySignalSource, number> =
  {
    existing_customer_link: 30,
    referral: 25,
    inbound_enquiry: 20,
    event: 15,
    staff_observation: 10,
    other: 5,
  };

export const MAX_OPPORTUNITY_SCORE = 100;

export interface CorporateOpportunity extends Timestamps {
  readonly id: CorporateOpportunityId;
  readonly retailerId: RetailerId;
  readonly companyName: string;
  readonly stage: CorporateOpportunityStage;
  readonly score: number;
  /** Set once the opportunity is won and becomes a real corporate account
   * — see `linkWonOpportunityToAccount`. Never a second company record. */
  readonly linkedAccountId?: CorporateAccountId;
}

export interface CorporateOpportunitySignal {
  readonly id: CorporateOpportunitySignalId;
  readonly retailerId: RetailerId;
  readonly opportunityId: CorporateOpportunityId;
  readonly source: CorporateOpportunitySignalSource;
  readonly detail: string;
  readonly observedOn: string;
  readonly createdAt: string;
}

export type OpportunityTransitionCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: "terminal_stage" | "transition_not_allowed";
    };

/**
 * Refuses any move a manager could not have reached by reading the pipeline
 * — no skipping qualification straight to a signed contract, and nothing
 * moves out of `won`/`lost` (a mistaken close is corrected by opening a new
 * opportunity, not by rewriting history on this one).
 */
export function checkOpportunityStageTransition(args: {
  readonly from: CorporateOpportunityStage;
  readonly to: CorporateOpportunityStage;
}): OpportunityTransitionCheck {
  if (TERMINAL_STAGES.has(args.from)) {
    return { ok: false, reason: "terminal_stage" };
  }
  if (!ALLOWED_TRANSITIONS[args.from].includes(args.to)) {
    return { ok: false, reason: "transition_not_allowed" };
  }
  return { ok: true };
}

export interface OpportunityScoreBreakdown {
  readonly source: CorporateOpportunitySignalSource;
  readonly weight: number;
}

export interface OpportunityScore {
  readonly score: number;
  readonly breakdown: readonly OpportunityScoreBreakdown[];
}

/**
 * The entire scoring formula: sum the fixed weight of each signal's
 * source, capped at `MAX_OPPORTUNITY_SCORE`, and hand back exactly which
 * signals contributed what. There is no hidden multiplier, no recency
 * decay, no model call — a manager reading the breakdown can recompute the
 * total by hand.
 */
export function scoreOpportunity(
  signals: readonly Pick<CorporateOpportunitySignal, "source">[],
): OpportunityScore {
  const breakdown = signals.map((signal) => ({
    source: signal.source,
    weight: SIGNAL_SOURCE_WEIGHTS[signal.source],
  }));
  const total = breakdown.reduce((sum, entry) => sum + entry.weight, 0);
  return { score: Math.min(total, MAX_OPPORTUNITY_SCORE), breakdown };
}

export type CreateOpportunityCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "company_name_required" };

export function checkCreateOpportunity(args: {
  readonly companyName: string;
}): CreateOpportunityCheck {
  if (args.companyName.trim().length === 0) {
    return { ok: false, reason: "company_name_required" };
  }
  return { ok: true };
}

export type AddSignalCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "detail_required" };

export function checkAddSignal(args: {
  readonly detail: string;
}): AddSignalCheck {
  if (args.detail.trim().length === 0) {
    return { ok: false, reason: "detail_required" };
  }
  return { ok: true };
}
