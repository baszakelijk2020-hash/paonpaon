/**
 * Clienteling opportunity persistence (CLI-005 / PHASE 7.4).
 */

import {
  asId,
  buildInterestFollowUpOpportunities,
  CLIENTELING_OPPORTUNITY_PROJECTOR_VERSION,
  nextAnniversary,
  nextYearlyOccurrence,
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
    ...((row as unknown as { campaign_id?: string }).campaign_id
      ? { campaignId: (row as unknown as { campaign_id?: string }).campaign_id }
      : {}),
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

  /**
   * Find active campaign mission for automatic order-outcome linking (PHASE 10.1).
   * Returns the first open campaign mission (draft status, no outcome yet) for a customer.
   */
  async findOpenCampaignMission(
    retailerId: RetailerId,
    customerId: CustomerId,
  ): Promise<ClientelingOpportunity | null> {
    const { data, error } = await this.client
      .from("clienteling_opportunities")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("customer_id", customerId)
      .eq("opportunity_type", "campaign_mission")
      .eq("status", "draft")
      .is("outcome_order_id", null)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw error;
    return data && data.length > 0 ? toDomain(data[0]!) : null;
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

  /**
   * Mission Control's "Outcome learning" surface: completed opportunities
   * whose action actually produced a real, attributable outcome (a sent
   * message, a booked appointment or a placed order via `linkOutcome`) --
   * not merely marked done. A completed opportunity with no outcome link
   * is excluded; it closed without anything to learn from.
   */
  async listRecentOutcomes(
    retailerId: RetailerId,
    limit = 10,
  ): Promise<ClientelingOpportunity[]> {
    const { data, error } = await this.client
      .from("clienteling_opportunities")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("status", "completed")
      .is("deleted_at", null)
      .or(
        "outcome_message_id.not.is.null,outcome_appointment_id.not.is.null,outcome_order_id.not.is.null",
      )
      .order("updated_at", { ascending: false })
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

  /** Open customer work assigned to one staff member's personal day. */
  async listOpenAssignedToStaff(
    retailerId: RetailerId,
    staffId: StaffId,
    limit = 20,
  ): Promise<ClientelingOpportunity[]> {
    const { data, error } = await this.client
      .from("clienteling_opportunities")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("assigned_staff_id", staffId)
      .in("status", ["draft", "accepted", "snoozed"])
      .is("deleted_at", null)
      .order("priority", { ascending: true })
      .order("due_at", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data.map(toDomain);
  }

  /**
   * Completes an open opportunity only when it belongs to this staff member.
   * A false result intentionally does not reveal whether the id was closed,
   * another person's work, or belongs to another retailer.
   */
  async completeAssignedOpen(args: {
    readonly retailerId: RetailerId;
    readonly staffId: StaffId;
    readonly opportunityId: string;
  }): Promise<boolean> {
    const { data, error } = await this.client
      .from("clienteling_opportunities")
      .update({
        status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("retailer_id", args.retailerId)
      .eq("id", args.opportunityId)
      .eq("assigned_staff_id", args.staffId)
      .in("status", ["draft", "accepted", "snoozed"])
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    return data !== null;
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

  /**
   * FT-13's anniversary continuation: `nextAnniversary` (the domain's own
   * annual date recurrence, `packages/domain/src/wedding/moonstruck-pack.ts`)
   * has existed since 2026-08-05 with unit coverage but no caller anywhere
   * in either app -- a customer's wedding anniversary never actually
   * surfaced as anything. Mirrors `syncInterestDraftsForCustomer`'s own
   * shape: called on customer-page view, inserts a draft `anniversary_moment`
   * opportunity for each completed wedding party this customer organized
   * whose anniversary falls within the next 30 days, deduped against an
   * existing undecided draft the same way interest follow-ups already are.
   */
  async syncAnniversaryMomentsForCustomer(args: {
    readonly retailerId: RetailerId;
    readonly customerId: CustomerId;
    readonly assignedStaffId?: StaffId;
    readonly now?: string;
  }): Promise<void> {
    const now = args.now ?? new Date().toISOString();
    // nextAnniversary/nextYearlyOccurrence parse their date args by
    // splitting on "-" and reconstructing a plain YYYY-MM-DD string; a
    // full ISO timestamp's "T..." time suffix corrupts that split, so
    // only the date portion is passed through.
    const asOfDate = now.slice(0, 10);

    const { data: weddingParties, error: weddingPartiesError } =
      await this.client
        .from("wedding_parties")
        .select("event_date")
        .eq("retailer_id", args.retailerId)
        .eq("organizer_customer_id", args.customerId)
        .eq("status", "completed")
        .not("event_date", "is", null)
        .is("deleted_at", null);
    if (weddingPartiesError) throw weddingPartiesError;
    if (!weddingParties || weddingParties.length === 0) return;

    const existing = await this.listForCustomer(
      args.retailerId,
      args.customerId,
      50,
    );
    const existingWhy = new Set(
      existing.filter((row) => row.status === "draft").map((row) => row.whyNow),
    );

    const oneDayMs = 24 * 60 * 60 * 1000;
    for (const party of weddingParties) {
      if (!party.event_date) continue;
      const moment = nextAnniversary({
        eventDate: party.event_date,
        asOf: asOfDate,
        nextYearlyOccurrence,
      });
      const daysUntil = Math.round(
        (Date.parse(moment.occursOn) - Date.parse(asOfDate)) / oneDayMs,
      );
      // A year-away anniversary would flood every visit with a note about
      // something not yet actionable; a 30-day window matches this
      // codebase's own "worth surfacing soon" precedent elsewhere.
      if (daysUntil < 0 || daysUntil > 30) continue;

      const yearWord = moment.yearsSince === 1 ? "year" : "years";
      const whyNow = `${moment.yearsSince} ${yearWord} married on ${moment.occursOn}.`;
      if (existingWhy.has(whyNow)) continue;

      const { error } = await this.client
        .from("clienteling_opportunities")
        .insert({
          retailer_id: args.retailerId,
          customer_id: args.customerId,
          opportunity_type:
            "anniversary_moment" satisfies ClientelingOpportunityType,
          why_now: whyNow,
          suggested_action:
            "Reach out with an anniversary touch — a care check-in or a considered gift suggestion.",
          channel: "message" satisfies ClientelingChannel,
          priority: 2,
          confidence: 1,
          status: "draft" satisfies ClientelingOpportunityStatus,
          ...(args.assignedStaffId
            ? { assigned_staff_id: args.assignedStaffId }
            : {}),
          contact_pressure: false,
          evidence: [
            { insightStatement: `Wedding date: ${party.event_date}` },
          ] satisfies ClientelingOpportunityEvidence[] as unknown as Json,
          projector_version: CLIENTELING_OPPORTUNITY_PROJECTOR_VERSION,
        });
      if (error) throw error;
    }
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
