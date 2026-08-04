import {
  asId,
  checkAddSignal,
  checkCreateOpportunity,
  checkOpportunityStageTransition,
  scoreOpportunity,
  type CorporateOpportunity,
  type CorporateOpportunityId,
  type CorporateOpportunitySignal,
  type CorporateOpportunitySignalSource,
  type CorporateOpportunityStage,
  type RetailerId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import { CorporateRepository } from "./corporate-repository";

type OpportunityRow =
  Database["public"]["Tables"]["corporate_opportunities"]["Row"];
type SignalRow =
  Database["public"]["Tables"]["corporate_opportunity_signals"]["Row"];

function toOpportunity(row: OpportunityRow): CorporateOpportunity {
  return {
    id: asId<"CorporateOpportunityId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    companyName: row.company_name,
    stage: row.stage as CorporateOpportunityStage,
    score: row.score,
    ...(row.linked_account_id
      ? { linkedAccountId: asId<"CorporateAccountId">(row.linked_account_id) }
      : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function toSignal(row: SignalRow): CorporateOpportunitySignal {
  return {
    id: asId<"CorporateOpportunitySignalId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    opportunityId: asId<"CorporateOpportunityId">(row.opportunity_id),
    source: row.source as CorporateOpportunitySignalSource,
    detail: row.detail,
    observedOn: row.observed_on,
    createdAt: row.created_at,
  };
}

export type CreateOpportunityResult =
  | { readonly ok: true; readonly opportunity: CorporateOpportunity }
  | { readonly ok: false; readonly reason: "company_name_required" };

export type AddSignalResult =
  | {
      readonly ok: true;
      readonly signal: CorporateOpportunitySignal;
      readonly opportunity: CorporateOpportunity;
    }
  | { readonly ok: false; readonly reason: "detail_required" };

export type TransitionStageResult =
  | { readonly ok: true; readonly opportunity: CorporateOpportunity }
  | {
      readonly ok: false;
      readonly reason: "terminal_stage" | "transition_not_allowed";
    }
  | { readonly ok: false; readonly reason: "opportunity_not_found" };

/**
 * The InsiderTailoring pipeline model (PHASE 18.1 / BD-101). Signals are
 * append-only and every score is recomputed from the live signal set on
 * every add — the stored `score` column is a read optimisation, never a
 * value this repository accepts as input from a caller.
 */
export class CorporateOpportunityRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findByRetailer(
    retailerId: RetailerId,
  ): Promise<readonly CorporateOpportunity[]> {
    const { data, error } = await this.client
      .from("corporate_opportunities")
      .select("*")
      .eq("retailer_id", retailerId)
      .is("deleted_at", null)
      .order("score", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(toOpportunity);
  }

  async findById(
    opportunityId: CorporateOpportunityId,
  ): Promise<CorporateOpportunity | null> {
    const { data, error } = await this.client
      .from("corporate_opportunities")
      .select("*")
      .eq("id", opportunityId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    return data ? toOpportunity(data) : null;
  }

  async listSignals(
    opportunityId: CorporateOpportunityId,
  ): Promise<readonly CorporateOpportunitySignal[]> {
    const { data, error } = await this.client
      .from("corporate_opportunity_signals")
      .select("*")
      .eq("opportunity_id", opportunityId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(toSignal);
  }

  async create(args: {
    readonly retailerId: RetailerId;
    readonly companyName: string;
  }): Promise<CreateOpportunityResult> {
    const check = checkCreateOpportunity({ companyName: args.companyName });
    if (!check.ok) return check;
    const { data, error } = await this.client
      .from("corporate_opportunities")
      .insert({
        retailer_id: args.retailerId,
        company_name: args.companyName.trim(),
      })
      .select("*")
      .single();
    if (error) throw error;
    return { ok: true, opportunity: toOpportunity(data) };
  }

  /** Inserts the signal, then recomputes and persists the score from the
   * full live signal set — never from the caller's claimed delta. */
  async addSignal(args: {
    readonly retailerId: RetailerId;
    readonly opportunityId: CorporateOpportunityId;
    readonly source: CorporateOpportunitySignalSource;
    readonly detail: string;
    readonly observedOn?: string;
  }): Promise<AddSignalResult> {
    const check = checkAddSignal({ detail: args.detail });
    if (!check.ok) return check;

    const insert: Database["public"]["Tables"]["corporate_opportunity_signals"]["Insert"] =
      {
        retailer_id: args.retailerId,
        opportunity_id: args.opportunityId,
        source: args.source,
        detail: args.detail.trim(),
        ...(args.observedOn ? { observed_on: args.observedOn } : {}),
      };
    const { data: signalRow, error: signalError } = await this.client
      .from("corporate_opportunity_signals")
      .insert(insert)
      .select("*")
      .single();
    if (signalError) throw signalError;

    const signals = await this.listSignals(args.opportunityId);
    const { score } = scoreOpportunity(signals);
    const { data: opportunityRow, error: updateError } = await this.client
      .from("corporate_opportunities")
      .update({ score })
      .eq("id", args.opportunityId)
      .select("*")
      .single();
    if (updateError) throw updateError;

    return {
      ok: true,
      signal: toSignal(signalRow),
      opportunity: toOpportunity(opportunityRow),
    };
  }

  async transitionStage(args: {
    readonly retailerId: RetailerId;
    readonly opportunityId: CorporateOpportunityId;
    readonly to: CorporateOpportunityStage;
  }): Promise<TransitionStageResult> {
    const current = await this.findById(args.opportunityId);
    if (!current) return { ok: false, reason: "opportunity_not_found" };
    const check = checkOpportunityStageTransition({
      from: current.stage,
      to: args.to,
    });
    if (!check.ok) return check;
    const { data, error } = await this.client
      .from("corporate_opportunities")
      .update({ stage: args.to })
      .eq("id", args.opportunityId)
      .select("*")
      .single();
    if (error) throw error;
    return { ok: true, opportunity: toOpportunity(data) };
  }

  /**
   * Wins the opportunity and creates the real `CorporateAccount` for it in
   * the same operation — the account, once it exists, is the company's
   * only record; the opportunity never becomes a second, competing one.
   * Reuses `CorporateRepository.createAccount` rather than inserting into
   * `corporate_accounts` directly here.
   */
  async winAndCreateAccount(args: {
    readonly retailerId: RetailerId;
    readonly opportunityId: CorporateOpportunityId;
    readonly accountReference: string;
  }): Promise<TransitionStageResult> {
    const current = await this.findById(args.opportunityId);
    if (!current) return { ok: false, reason: "opportunity_not_found" };
    const check = checkOpportunityStageTransition({
      from: current.stage,
      to: "won",
    });
    if (!check.ok) return check;

    const account = await new CorporateRepository(this.client).createAccount(
      args.retailerId,
      {
        legalName: current.companyName,
        accountReference: args.accountReference,
      },
    );

    const { data, error } = await this.client
      .from("corporate_opportunities")
      .update({ stage: "won", linked_account_id: account.id })
      .eq("id", args.opportunityId)
      .select("*")
      .single();
    if (error) throw error;
    return { ok: true, opportunity: toOpportunity(data) };
  }
}
