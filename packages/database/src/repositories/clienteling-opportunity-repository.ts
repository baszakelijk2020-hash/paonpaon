/**
 * Clienteling opportunity persistence (CLI-005 / PHASE 7.4).
 */

import {
  asId,
  buildInterestFollowUpOpportunities,
  type ClientelingChannel,
  type ClientelingOpportunity,
  type ClientelingOpportunityEvidence,
  type ClientelingOpportunityStatus,
  type ClientelingOpportunityType,
  type CustomerId,
  type RetailerId,
  type StaffId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database, Json } from "../generated/database.types";

import { CustomerInterestRepository } from "./customer-interest-repository";

type Row = Database["public"]["Tables"]["clienteling_opportunities"]["Row"];

function parseEvidence(value: Json): readonly ClientelingOpportunityEvidence[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    return [
      {
        ...(typeof row.factId === "string"
          ? { factId: asId<"CustomerFactId">(row.factId) }
          : {}),
        ...(typeof row.insightStatement === "string"
          ? { insightStatement: row.insightStatement }
          : {}),
        ...(typeof row.note === "string" ? { note: row.note } : {}),
      },
    ];
  });
}

function toDomain(row: Row): ClientelingOpportunity {
  return {
    id: row.id,
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    type: row.opportunity_type as ClientelingOpportunityType,
    whyNow: row.why_now,
    suggestedAction: row.suggested_action,
    channel: row.channel as ClientelingChannel,
    ...(row.best_time_window ? { bestTimeWindow: row.best_time_window } : {}),
    ...(row.assigned_staff_id
      ? { assignedStaffId: asId<"StaffId">(row.assigned_staff_id) }
      : {}),
    ...(row.branch_label ? { branchLabel: row.branch_label } : {}),
    priority: row.priority,
    confidence: Number(row.confidence),
    status: row.status as ClientelingOpportunityStatus,
    ...(row.due_at ? { dueAt: row.due_at } : {}),
    ...(row.expires_at ? { expiresAt: row.expires_at } : {}),
    ...(row.cooldown_until ? { cooldownUntil: row.cooldown_until } : {}),
    contactPressure: row.contact_pressure,
    evidence: parseEvidence(row.evidence),
    ...(row.outcome_message_id
      ? { outcomeMessageId: row.outcome_message_id }
      : {}),
    ...(row.outcome_appointment_id
      ? { outcomeAppointmentId: row.outcome_appointment_id }
      : {}),
    ...(row.outcome_order_id ? { outcomeOrderId: row.outcome_order_id } : {}),
    projectorVersion: row.projector_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ClientelingOpportunityRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  /**
   * A single advisor-authored opportunity — used for `advisor_commitment`
   * (an advisor's own confirmed follow-up, e.g. from advisor capture),
   * distinct from the system-detected types `syncInterestDraftsForCustomer`
   * produces. Draft by default, same as every other opportunity type —
   * "Draft tasks by default — never autonomous customer spam."
   */
  async create(args: {
    readonly retailerId: RetailerId;
    readonly customerId: CustomerId;
    readonly type: ClientelingOpportunityType;
    readonly whyNow: string;
    readonly suggestedAction: string;
    readonly channel: ClientelingChannel;
    readonly assignedStaffId?: StaffId;
    readonly dueAt?: string;
    readonly confidence?: number;
    readonly evidence?: readonly ClientelingOpportunityEvidence[];
    readonly projectorVersion: string;
  }): Promise<ClientelingOpportunity> {
    const { data, error } = await this.client
      .from("clienteling_opportunities")
      .insert({
        retailer_id: args.retailerId,
        customer_id: args.customerId,
        opportunity_type: args.type,
        why_now: args.whyNow.trim().slice(0, 1000),
        suggested_action: args.suggestedAction.trim().slice(0, 1000),
        channel: args.channel,
        ...(args.assignedStaffId
          ? { assigned_staff_id: args.assignedStaffId }
          : {}),
        ...(args.dueAt ? { due_at: args.dueAt } : {}),
        confidence: args.confidence ?? 0.9,
        evidence: (args.evidence ?? []) as unknown as Json,
        projector_version: args.projectorVersion,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toDomain(data);
  }

  async listForCustomer(
    retailerId: RetailerId,
    customerId: CustomerId,
    limit = 20,
  ): Promise<ClientelingOpportunity[]> {
    const { data, error } = await this.client
      .from("clienteling_opportunities")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("customer_id", customerId)
      .is("deleted_at", null)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data.map(toDomain);
  }

  async listDraftInbox(
    retailerId: RetailerId,
    limit = 30,
  ): Promise<ClientelingOpportunity[]> {
    const { data, error } = await this.client
      .from("clienteling_opportunities")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("status", "draft")
      .is("deleted_at", null)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data.map(toDomain);
  }

  async listForRetailer(
    retailerId: RetailerId,
    limit = 200,
  ): Promise<ClientelingOpportunity[]> {
    const { data, error } = await this.client
      .from("clienteling_opportunities")
      .select("*")
      .eq("retailer_id", retailerId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data.map(toDomain);
  }

  /**
   * Project interest insights into draft opportunities and persist new drafts
   * when the customer has no open draft of the same why_now text.
   */
  async syncInterestDraftsForCustomer(args: {
    readonly retailerId: RetailerId;
    readonly customerId: CustomerId;
    readonly viewerRetailerId: RetailerId;
    readonly recentTouchCount?: number;
    readonly assignedStaffId?: StaffId;
    readonly now?: string;
  }): Promise<ClientelingOpportunity[]> {
    const now = args.now ?? new Date().toISOString();
    const interest = await new CustomerInterestRepository(
      this.client,
    ).projectForCustomer({
      retailerId: args.retailerId,
      customerId: args.customerId,
      viewerRetailerId: args.viewerRetailerId,
      now,
    });

    const drafts = buildInterestFollowUpOpportunities({
      retailerId: args.retailerId,
      customerId: args.customerId,
      now,
      recentTouchCount: args.recentTouchCount ?? 0,
      insightStatements: interest.insights.map((row) => row.statement),
      ...(args.assignedStaffId
        ? { assignedStaffId: args.assignedStaffId }
        : {}),
    });

    const existing = await this.listForCustomer(
      args.retailerId,
      args.customerId,
      50,
    );
    const existingWhy = new Set(
      existing.filter((row) => row.status === "draft").map((row) => row.whyNow),
    );

    for (const draft of drafts) {
      if (existingWhy.has(draft.whyNow)) continue;
      const { error } = await this.client
        .from("clienteling_opportunities")
        .insert({
          retailer_id: draft.retailerId,
          customer_id: draft.customerId,
          opportunity_type: draft.type,
          why_now: draft.whyNow,
          suggested_action: draft.suggestedAction,
          channel: draft.channel,
          ...(draft.bestTimeWindow
            ? { best_time_window: draft.bestTimeWindow }
            : {}),
          ...(draft.assignedStaffId
            ? { assigned_staff_id: draft.assignedStaffId }
            : {}),
          priority: draft.priority,
          confidence: draft.confidence,
          status: draft.status,
          ...(draft.expiresAt ? { expires_at: draft.expiresAt } : {}),
          ...(draft.cooldownUntil
            ? { cooldown_until: draft.cooldownUntil }
            : {}),
          contact_pressure: draft.contactPressure,
          evidence: draft.evidence as unknown as Json,
          projector_version: draft.projectorVersion,
        });
      if (error) throw error;
    }

    return this.listForCustomer(args.retailerId, args.customerId);
  }

  async setStatus(args: {
    readonly retailerId: RetailerId;
    readonly opportunityId: string;
    readonly status: ClientelingOpportunityStatus;
  }): Promise<void> {
    const { error } = await this.client
      .from("clienteling_opportunities")
      .update({
        status: args.status,
        updated_at: new Date().toISOString(),
      })
      .eq("retailer_id", args.retailerId)
      .eq("id", args.opportunityId);
    if (error) throw error;
  }

  async linkOutcome(args: {
    readonly retailerId: RetailerId;
    readonly opportunityId: string;
    readonly outcomeMessageId?: string;
    readonly outcomeAppointmentId?: string;
    readonly outcomeOrderId?: string;
    readonly status?: ClientelingOpportunityStatus;
  }): Promise<void> {
    const { error } = await this.client
      .from("clienteling_opportunities")
      .update({
        ...(args.outcomeMessageId
          ? { outcome_message_id: args.outcomeMessageId }
          : {}),
        ...(args.outcomeAppointmentId
          ? { outcome_appointment_id: args.outcomeAppointmentId }
          : {}),
        ...(args.outcomeOrderId
          ? { outcome_order_id: args.outcomeOrderId }
          : {}),
        status: args.status ?? "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("retailer_id", args.retailerId)
      .eq("id", args.opportunityId);
    if (error) throw error;
  }
}
