/**
 * Customer self-provided intake (PHASE 17.11). Persistence over
 * `@paon/domain`'s `checkCustomerIntakeProposal` — every proposal is
 * validated, including that its cited `sourceExcerpt` is a real
 * substring of the raw intake text, before it is ever stored or shown to
 * staff for review. Nothing writes to `customer_facts` until
 * `confirmProposal` runs, and that requires the confirming staff id
 * explicitly — mirrors AdvisorCaptureRepository's confirmBundle exactly,
 * for the same reason: "an AI proposed it" is never itself "it is now
 * true about this customer."
 */

import {
  checkCustomerIntakeProposal,
  type CustomerId,
  type CustomerIntakeFactType,
  type CustomerIntakeProposal as CustomerIntakeProposalDraft,
  type CustomerIntakeProposalStatus,
  type RetailerId,
  type StaffId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import { CustomerFactRepository } from "./customer-fact-repository";

type SessionRow =
  Database["public"]["Tables"]["customer_intake_sessions"]["Row"];
type ProposalRow =
  Database["public"]["Tables"]["customer_intake_proposals"]["Row"];

export interface CustomerIntakeSession {
  readonly id: string;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly rawText: string;
  readonly createdAt: string;
}

export interface CustomerIntakeProposalRecord {
  readonly id: string;
  readonly intakeSessionId: string;
  readonly factType: CustomerIntakeFactType;
  readonly valueLabel: string;
  readonly valueText: string | null;
  readonly sourceExcerpt: string;
  readonly confidence: number;
  readonly status: CustomerIntakeProposalStatus;
  readonly linkedFactId: string | null;
  readonly createdAt: string;
}

function sessionToDomain(row: SessionRow): CustomerIntakeSession {
  return {
    id: row.id,
    retailerId: row.retailer_id as RetailerId,
    customerId: row.customer_id as CustomerId,
    rawText: row.raw_text,
    createdAt: row.created_at,
  };
}

function proposalToDomain(row: ProposalRow): CustomerIntakeProposalRecord {
  return {
    id: row.id,
    intakeSessionId: row.intake_session_id,
    factType: row.fact_type as CustomerIntakeFactType,
    valueLabel: row.value_label,
    valueText: row.value_text,
    sourceExcerpt: row.source_excerpt,
    confidence: Number(row.confidence),
    status: row.status as CustomerIntakeProposalStatus,
    linkedFactId: row.linked_fact_id,
    createdAt: row.created_at,
  };
}

export type ConfirmIntakeProposalResult =
  | { readonly ok: true; readonly proposal: CustomerIntakeProposalRecord }
  | { readonly ok: false; readonly reason: "not_found" }
  | { readonly ok: false; readonly reason: "already_resolved" };

export class CustomerIntakeRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  /** The customer's own raw text — this insert runs as the customer's
   * own authenticated session, gated by customer_intake_sessions'
   * insert RLS policy (customer_id must resolve to the caller's own
   * customers row). */
  async startSession(args: {
    readonly retailerId: RetailerId;
    readonly customerId: CustomerId;
    readonly rawText: string;
  }): Promise<CustomerIntakeSession> {
    const { data, error } = await this.client
      .from("customer_intake_sessions")
      .insert({
        retailer_id: args.retailerId,
        customer_id: args.customerId,
        raw_text: args.rawText.trim(),
      })
      .select("*")
      .single();
    if (error) throw error;
    return sessionToDomain(data);
  }

  async listSessionsForCustomer(
    customerId: CustomerId,
  ): Promise<readonly CustomerIntakeSession[]> {
    const { data, error } = await this.client
      .from("customer_intake_sessions")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(sessionToDomain);
  }

  /**
   * The AI-extraction pass writes proposals here — always as
   * service_role in practice, since customer_intake_proposals has no
   * authenticated insert policy at all (see the migration comment: a
   * customer never directly writes an unreviewed fact about themselves).
   * Every draft is validated against the session's own raw text before
   * insert; a draft that fails validation is dropped silently, exactly
   * like AdvisorCaptureRepository.proposeBundles — it was never real
   * evidence to begin with.
   */
  async proposeFacts(args: {
    readonly retailerId: RetailerId;
    readonly session: CustomerIntakeSession;
    readonly drafts: readonly CustomerIntakeProposalDraft[];
  }): Promise<readonly CustomerIntakeProposalRecord[]> {
    const valid = args.drafts.filter(
      (draft) =>
        checkCustomerIntakeProposal({
          rawIntakeText: args.session.rawText,
          proposal: draft,
        }).ok,
    );
    if (valid.length === 0) return [];

    const { data, error } = await this.client
      .from("customer_intake_proposals")
      .insert(
        valid.map((draft) => ({
          retailer_id: args.retailerId,
          intake_session_id: args.session.id,
          fact_type: draft.factType,
          value_label: draft.valueLabel.trim().slice(0, 300),
          ...(draft.valueText ? { value_text: draft.valueText } : {}),
          source_excerpt: draft.sourceExcerpt.trim().slice(0, 2000),
          confidence: draft.confidence,
        })),
      )
      .select("*");
    if (error) throw error;
    return data.map(proposalToDomain);
  }

  async listProposalsForSession(
    intakeSessionId: string,
  ): Promise<readonly CustomerIntakeProposalRecord[]> {
    const { data, error } = await this.client
      .from("customer_intake_proposals")
      .select("*")
      .eq("intake_session_id", intakeSessionId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data.map(proposalToDomain);
  }

  async listPendingForRetailer(
    retailerId: RetailerId,
  ): Promise<readonly CustomerIntakeProposalRecord[]> {
    const { data, error } = await this.client
      .from("customer_intake_proposals")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("status", "proposed")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data.map(proposalToDomain);
  }

  /**
   * Staff confirms a proposal really becomes a customer_facts row —
   * provenance_class='customer_declared' (the customer authored this
   * about themselves), never 'advisor_observed'. Confirming staff id is
   * required, matching AdvisorCaptureRepository's confirmBundle: there
   * is no path from "AI proposed it" straight to "canonical record
   * changed" without a named human in between.
   */
  async confirmProposal(args: {
    readonly retailerId: RetailerId;
    readonly customerId: CustomerId;
    readonly proposalId: string;
    readonly staffId: StaffId;
  }): Promise<ConfirmIntakeProposalResult> {
    const { data: current, error: findError } = await this.client
      .from("customer_intake_proposals")
      .select("*")
      .eq("id", args.proposalId)
      .maybeSingle();
    if (findError) throw findError;
    if (!current) return { ok: false, reason: "not_found" };
    if (current.status !== "proposed") {
      return { ok: false, reason: "already_resolved" };
    }

    const fact = await new CustomerFactRepository(this.client).record({
      retailerId: args.retailerId,
      customerId: args.customerId,
      staffId: args.staffId,
      factType: current.fact_type as CustomerIntakeFactType,
      valueLabel: current.value_label,
      provenanceClass: "customer_declared",
      confidence: Number(current.confidence),
    });

    const { data, error } = await this.client
      .from("customer_intake_proposals")
      .update({
        status: "confirmed",
        confirmed_by_staff_id: args.staffId,
        confirmed_at: new Date().toISOString(),
        linked_fact_id: fact.id,
      })
      .eq("id", args.proposalId)
      .select("*")
      .single();
    if (error) throw error;
    return { ok: true, proposal: proposalToDomain(data) };
  }

  async dismissProposal(args: {
    readonly proposalId: string;
    readonly staffId: StaffId;
  }): Promise<ConfirmIntakeProposalResult> {
    const { data: current, error: findError } = await this.client
      .from("customer_intake_proposals")
      .select("status")
      .eq("id", args.proposalId)
      .maybeSingle();
    if (findError) throw findError;
    if (!current) return { ok: false, reason: "not_found" };
    if (current.status !== "proposed") {
      return { ok: false, reason: "already_resolved" };
    }

    const { data, error } = await this.client
      .from("customer_intake_proposals")
      .update({
        status: "dismissed",
        confirmed_by_staff_id: args.staffId,
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", args.proposalId)
      .select("*")
      .single();
    if (error) throw error;
    return { ok: true, proposal: proposalToDomain(data) };
  }
}
