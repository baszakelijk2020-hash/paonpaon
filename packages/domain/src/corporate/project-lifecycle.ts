/**
 * Corporate project and rollout management (BD-107 / PHASE 18.7).
 *
 * The founder's directive named an explicit chain of steps a corporate
 * engagement moves through: opportunity -> tender -> award -> design
 * approval -> sample approval -> material approval -> employee import ->
 * fitting -> production -> QC -> distribution -> launch -> renewal. This
 * file is that chain made real: a single ordered stage list, an explicit
 * allow-list of the one legal next move from each stage (mirroring
 * `checkOpportunityStageTransition` in `business-development.ts` — no
 * skipping, no implicit "anything goes" fallback), and a stall check so a
 * project stuck between two named steps is visible rather than silently
 * lost.
 *
 * This does not re-implement production, QC or distribution as their own
 * subsystems — `design_approval`/`sample_approval`/`material_approval`/
 * `production`/`qc`/`distribution`/`launch` are checkpoints a manager
 * advances explicitly with a note, the same "real caller, human decides"
 * shape already used for the opportunity pipeline's own stage buttons.
 * Where a real trigger already exists elsewhere in this codebase it is
 * reused, not shadowed: `opportunity` -> `tender` fires when the first
 * tender is authored (18.2), and `tender` -> `award` fires when the
 * opportunity is won (18.1) — see `CorporateProjectRepository`.
 */

import type {
  CorporateAccountId,
  CorporateOpportunityId,
  CorporateProjectEventId,
  CorporateProjectId,
  RetailerId,
  StaffId,
} from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";

export const CORPORATE_PROJECT_STAGES = [
  "opportunity",
  "tender",
  "award",
  "design_approval",
  "sample_approval",
  "material_approval",
  "employee_import",
  "fitting",
  "production",
  "qc",
  "distribution",
  "launch",
  "renewal",
] as const;
export type CorporateProjectStage = (typeof CORPORATE_PROJECT_STAGES)[number];

/** Stage -> the one stage after it, or none once the chain ends at
 * `renewal` (the ongoing renewal cycle itself belongs to 18.9, not to a
 * one-way lifecycle state machine). */
const NEXT_STAGE: Record<CorporateProjectStage, CorporateProjectStage | null> =
  {
    opportunity: "tender",
    tender: "award",
    award: "design_approval",
    design_approval: "sample_approval",
    sample_approval: "material_approval",
    material_approval: "employee_import",
    employee_import: "fitting",
    fitting: "production",
    production: "qc",
    qc: "distribution",
    distribution: "launch",
    launch: "renewal",
    renewal: null,
  };

export interface CorporateProject extends Timestamps {
  readonly id: CorporateProjectId;
  readonly retailerId: RetailerId;
  readonly opportunityId: CorporateOpportunityId;
  readonly accountId?: CorporateAccountId;
  readonly stage: CorporateProjectStage;
  readonly stageEnteredAt: string;
}

export interface CorporateProjectEvent {
  readonly id: CorporateProjectEventId;
  readonly retailerId: RetailerId;
  readonly projectId: CorporateProjectId;
  readonly fromStage: CorporateProjectStage | null;
  readonly toStage: CorporateProjectStage;
  readonly note: string | null;
  readonly staffId: StaffId | null;
  readonly createdAt: string;
}

export type AdvanceProjectStageCheck =
  | { readonly ok: true; readonly to: CorporateProjectStage }
  | {
      readonly ok: false;
      readonly reason: "terminal_stage" | "transition_not_allowed";
    };

/**
 * Refuses any move that is not exactly the one legal next step — a
 * project cannot jump from `award` to `production` skipping every
 * approval step in between, and nothing moves once it reaches `renewal`
 * (18.9's own renewal-risk engine takes over from there).
 */
export function checkAdvanceProjectStage(args: {
  readonly from: CorporateProjectStage;
  readonly to: CorporateProjectStage;
}): AdvanceProjectStageCheck {
  const next = NEXT_STAGE[args.from];
  if (next === null) {
    return { ok: false, reason: "terminal_stage" };
  }
  if (next !== args.to) {
    return { ok: false, reason: "transition_not_allowed" };
  }
  return { ok: true, to: next };
}

/** The next stage after the given one, or `null` at the terminal stage —
 * the single source of ordering a UI reads to offer exactly one button,
 * never a picklist of every stage. */
export function nextProjectStage(
  stage: CorporateProjectStage,
): CorporateProjectStage | null {
  return NEXT_STAGE[stage];
}

/**
 * A project sitting in one stage for longer than this is flagged, not
 * silently trusted. There is no historical data yet to derive this
 * threshold from, so it is a conservative, published, easily-changed
 * constant rather than a tuned model — the same "no black box" posture
 * used everywhere else scoring or flagging happens in this codebase.
 */
export const PROJECT_STALL_THRESHOLD_DAYS = 21;

export interface ProjectStallAssessment {
  readonly stalled: boolean;
  readonly daysInStage: number;
  readonly thresholdDays: number;
}

/**
 * Returns the days-in-stage alongside the boolean, not just the boolean
 * — a manager can judge "18 days, nearly there" differently from
 * "18 days, nothing usually takes this long" even though both currently
 * read `stalled: false`.
 */
export function assessProjectStall(args: {
  readonly stage: CorporateProjectStage;
  readonly stageEnteredAt: string;
  readonly now: Date;
}): ProjectStallAssessment {
  if (args.stage === "renewal") {
    return {
      stalled: false,
      daysInStage: 0,
      thresholdDays: PROJECT_STALL_THRESHOLD_DAYS,
    };
  }
  const enteredAt = new Date(args.stageEnteredAt);
  const daysInStage = Math.max(
    0,
    Math.floor(
      (args.now.getTime() - enteredAt.getTime()) / (24 * 60 * 60 * 1000),
    ),
  );
  return {
    stalled: daysInStage > PROJECT_STALL_THRESHOLD_DAYS,
    daysInStage,
    thresholdDays: PROJECT_STALL_THRESHOLD_DAYS,
  };
}
