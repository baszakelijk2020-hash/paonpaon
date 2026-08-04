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

  /**
   * The single write path for every stage transition. `staffId` is null
   * for the two transitions this repository fires automatically
   * (opportunity -> tender, tender -> award) so the event log honestly
   * shows "the system, because X happened" rather than attributing an
   * automatic move to whichever staff member happened to be signed in.
   */
  async advanceStage(args: {
    readonly retailerId: RetailerId;
    readonly opportunityId: CorporateOpportunityId;
    readonly to: CorporateProjectStage;
    readonly note?: string;
    readonly staffId?: StaffId;
  }): Promise<AdvanceProjectStageResult> {
    const current = await this.findByOpportunity(args.opportunityId);
    if (!current) return { ok: false, reason: "project_not_found" };
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
