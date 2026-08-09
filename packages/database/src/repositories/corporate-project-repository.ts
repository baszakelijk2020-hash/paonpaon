import {
  asId,
  checkAdvanceProjectStage,
  type CorporateAccountId,
  type CorporateOpportunityId,
  type CorporateProject,
  type CorporateProjectEvent,
  type CorporateProjectId,
  type CorporateProjectStage,
  type RetailerId,
  type StaffId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type AdvanceStageArgs = {
  readonly retailerId: RetailerId;
  readonly to: CorporateProjectStage;
  readonly note?: string;
  readonly staffId?: StaffId;
};

type ProjectRow = Database["public"]["Tables"]["corporate_projects"]["Row"];
type EventRow = Database["public"]["Tables"]["corporate_project_events"]["Row"];

function toProject(row: ProjectRow): CorporateProject {
  return {
    id: asId<"CorporateProjectId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    opportunityId: asId<"CorporateOpportunityId">(row.opportunity_id),
    ...(row.account_id
      ? { accountId: asId<"CorporateAccountId">(row.account_id) }
      : {}),
    stage: row.stage as CorporateProjectStage,
    stageEnteredAt: row.stage_entered_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: null,
  };
}

function toEvent(row: EventRow): CorporateProjectEvent {
  return {
    id: asId<"CorporateProjectEventId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    projectId: asId<"CorporateProjectId">(row.project_id),
    fromStage: row.from_stage as CorporateProjectStage | null,
    toStage: row.to_stage as CorporateProjectStage,
    note: row.note,
    staffId: row.staff_id ? asId<"StaffId">(row.staff_id) : null,
    createdAt: row.created_at,
  };
}

export type AdvanceProjectStageResult =
  | { readonly ok: true; readonly project: CorporateProject }
  | {
      readonly ok: false;
      readonly reason: "terminal_stage" | "transition_not_allowed";
    }
  | { readonly ok: false; readonly reason: "project_not_found" };

/**
 * The corporate project/rollout lifecycle state machine (PHASE 18.7 /
 * BD-107): one project per opportunity, moving through the founder's own
 * named chain one step at a time. `advanceStage` is the single write
 * path for every transition — called directly by a staff "Advance"
 * action for the checkpoints with no other real trigger yet
 * (design/sample/material approval, employee import, production, qc,
 * distribution, launch, renewal), and called internally by
 * `CorporateOpportunityRepository` when a tender is first authored or
 * the opportunity is won, so those two steps are never a second,
 * disconnected truth from the opportunity pipeline that actually causes
 * them.
 */
export class CorporateProjectRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findByOpportunity(
    opportunityId: CorporateOpportunityId,
  ): Promise<CorporateProject | null> {
    const { data, error } = await this.client
      .from("corporate_projects")
      .select("*")
      .eq("opportunity_id", opportunityId)
      .maybeSingle();
    if (error) throw error;
    return data ? toProject(data) : null;
  }

  async findById(
    projectId: CorporateProjectId,
  ): Promise<CorporateProject | null> {
    const { data, error } = await this.client
      .from("corporate_projects")
      .select("*")
      .eq("id", projectId)
      .maybeSingle();
    if (error) throw error;
    return data ? toProject(data) : null;
  }

  /** A project's `account_id` is set once, at award (`linkAccount`), and
   * never reused across a second concurrent project for the same
   * account in this codebase's current flow — the most recently
   * updated match is the real one. Used by rollout planning (18.6),
   * which only ever knows a programme's account, never its originating
   * opportunity. */
  async findByAccountId(
    accountId: CorporateAccountId,
  ): Promise<CorporateProject | null> {
    const { data, error } = await this.client
      .from("corporate_projects")
      .select("*")
      .eq("account_id", accountId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? toProject(data) : null;
  }

  async listEvents(
    projectId: CorporateProjectId,
  ): Promise<readonly CorporateProjectEvent[]> {
    const { data, error } = await this.client
      .from("corporate_project_events")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(toEvent);
  }

  /** Creates the project at its always-true starting stage. One call
   * site: `CorporateOpportunityRepository.create`, so an opportunity can
   * never exist without the project that tracks its full lifecycle. */
  async createForOpportunity(args: {
    readonly retailerId: RetailerId;
    readonly opportunityId: CorporateOpportunityId;
  }): Promise<CorporateProject> {
    const { data, error } = await this.client
      .from("corporate_projects")
      .insert({
        retailer_id: args.retailerId,
        opportunity_id: args.opportunityId,
      })
      .select("*")
      .single();
    if (error) throw error;
    const project = toProject(data);
    await this.recordEvent({
      retailerId: args.retailerId,
      projectId: project.id,
      fromStage: null,
      toStage: project.stage,
      note: null,
      staffId: null,
    });
    return project;
  }

  private async recordEvent(args: {
    readonly retailerId: RetailerId;
    readonly projectId: CorporateProjectId;
    readonly fromStage: CorporateProjectStage | null;
    readonly toStage: CorporateProjectStage;
    readonly note: string | null;
    readonly staffId: StaffId | null;
  }): Promise<void> {
    const { error } = await this.client
      .from("corporate_project_events")
      .insert({
        retailer_id: args.retailerId,
        project_id: args.projectId,
        from_stage: args.fromStage,
        to_stage: args.toStage,
        note: args.note,
        staff_id: args.staffId,
      });
    if (error) throw error;
  }

  /** Shared write path behind both `advanceStage` and
   * `advanceStageForAccount`: given the project already resolved by
   * whichever lookup the caller had on hand, apply the one legal move
   * or return the same refusal reasons either lookup path can hit. */
  private async applyAdvance(
    current: CorporateProject,
    args: AdvanceStageArgs,
  ): Promise<AdvanceProjectStageResult> {
    const check = checkAdvanceProjectStage({
      from: current.stage,
      to: args.to,
    });
    if (!check.ok) return check;

    const { data, error } = await this.client
      .from("corporate_projects")
      .update({ stage: check.to, stage_entered_at: new Date().toISOString() })
      .eq("id", current.id)
      .select("*")
      .single();
    if (error) throw error;
    const project = toProject(data);
    await this.recordEvent({
      retailerId: args.retailerId,
      projectId: project.id,
      fromStage: current.stage,
      toStage: project.stage,
      note: args.note?.trim() ? args.note.trim() : null,
      staffId: args.staffId ?? null,
    });
    return { ok: true, project };
  }

  /**
   * The single write path for every stage transition reached through an
   * opportunity. `staffId` is null for the transitions this repository
   * fires automatically (opportunity -> tender, tender -> award) so the
   * event log honestly shows "the system, because X happened" rather
   * than attributing an automatic move to whichever staff member
   * happened to be signed in.
   */
  async advanceStage(
    args: AdvanceStageArgs & { readonly opportunityId: CorporateOpportunityId },
  ): Promise<AdvanceProjectStageResult> {
    const current = await this.findByOpportunity(args.opportunityId);
    if (!current) return { ok: false, reason: "project_not_found" };
    return this.applyAdvance(current, args);
  }

  /**
   * The same single write path, reached through a project's linked
   * account instead of its originating opportunity — for callers (like
   * rollout planning, 18.6) that only ever know a programme's account,
   * never the opportunity that created it. `staffId` is null for the
   * transitions this repository fires automatically (employee_import ->
   * fitting on first rollout assignment, fitting -> production once
   * every planned slot for the programme is completed), matching
   * `advanceStage`'s own "the system, because X happened" discipline.
   */
  async advanceStageForAccount(
    args: AdvanceStageArgs & { readonly accountId: CorporateAccountId },
  ): Promise<AdvanceProjectStageResult> {
    const current = await this.findByAccountId(args.accountId);
    if (!current) return { ok: false, reason: "project_not_found" };
    return this.applyAdvance(current, args);
  }

  /** Called once an opportunity's account exists (win time) — links the
   * project to the real account rather than leaving it opportunity-only
   * for the rest of the lifecycle. */
  async linkAccount(args: {
    readonly opportunityId: CorporateOpportunityId;
    readonly accountId: CorporateAccountId;
  }): Promise<void> {
    const { error } = await this.client
      .from("corporate_projects")
      .update({ account_id: args.accountId })
      .eq("opportunity_id", args.opportunityId);
    if (error) throw error;
  }
}
