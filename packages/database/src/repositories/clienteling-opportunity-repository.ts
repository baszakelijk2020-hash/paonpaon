/**
 * Clienteling opportunity repository (CLI-004 / CLI-005 / PHASE 7.4).
 */

import {
  asId,
  DEFAULT_MAX_INBOX_OPPORTUNITIES,
  isOpenOpportunityStatus,
  projectClientelingOpportunityDrafts,
  type AppointmentId,
  type ClientelingHookKind,
  type ClientelingOpportunity,
  type ClientelingOpportunityDraft,
  type ClientelingOpportunityEvidenceRef,
  type ClientelingOpportunityStatus,
  type ClientelingOutcomeType,
  type ClientelingSuggestedAction,
  type ClientelingSuggestedChannel,
  type CustomerId,
  type MessageId,
  type OrderId,
  type RecentContactRecord,
  type RetailerId,
  type StaffId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database, Json } from "../generated/database.types";

import { AnalyticsRepository } from "./analytics-repository";
import { ClientelingRepository } from "./clienteling-repository";
import { CustomerInterestRepository } from "./customer-interest-repository";
import { CustomerRepository } from "./customer-repository";

type Row = Database["public"]["Tables"]["clienteling_opportunities"]["Row"];

const OPEN_STATUSES: ClientelingOpportunityStatus[] = [
  "draft",
  "assigned",
  "in_progress",
];

const RECENT_CUSTOMER_SYNC_LIMIT = 25;
const RECENT_EVENT_LOOKBACK_DAYS = 30;

function parseEvidence(
  value: Json,
): readonly ClientelingOpportunityEvidenceRef[] {
  if (!Array.isArray(value)) return [];
  const out: ClientelingOpportunityEvidenceRef[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    out.push({
      ...(typeof row.eventId === "string"
        ? { eventId: asId<"BehavioralEventId">(row.eventId) }
        : {}),
      ...(typeof row.factId === "string"
        ? { factId: asId<"CustomerFactId">(row.factId) }
        : {}),
      ...(typeof row.insightKey === "string"
        ? { insightKey: row.insightKey }
        : {}),
    });
  }
  return out;
}

function toDomain(row: Row): ClientelingOpportunity {
  return {
    id: row.id,
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    customerName: "",
    hookKind: row.hook_kind as ClientelingHookKind,
    projectorKey: row.projector_key,
    projectorVersion: row.projector_version,
    title: row.title,
    whyNow: row.why_now,
    suggestedAction: row.suggested_action as ClientelingSuggestedAction,
    suggestedChannel: row.suggested_channel as ClientelingSuggestedChannel,
    suggestedAt: row.suggested_at,
    status: row.status as ClientelingOpportunityStatus,
    priority: row.priority,
    confidence: Number(row.confidence),
    dueAt: row.due_at,
    expiresAt: row.expires_at,
    ...(row.assigned_staff_id
      ? { assignedStaffId: asId<"StaffId">(row.assigned_staff_id) }
      : {}),
    evidence: parseEvidence(row.evidence),
    ...(row.feedback_note ? { feedbackNote: row.feedback_note } : {}),
    ...(row.outcome_type
      ? { outcomeType: row.outcome_type as ClientelingOutcomeType }
      : {}),
    ...(row.outcome_message_id
      ? { outcomeMessageId: asId<"MessageId">(row.outcome_message_id) }
      : {}),
    ...(row.outcome_appointment_id
      ? {
          outcomeAppointmentId: asId<"AppointmentId">(
            row.outcome_appointment_id,
          ),
        }
      : {}),
    ...(row.outcome_order_id
      ? { outcomeOrderId: asId<"OrderId">(row.outcome_order_id) }
      : {}),
    ...(row.outcome_recorded_at
      ? { outcomeRecordedAt: row.outcome_recorded_at }
      : {}),
    ...(row.outcome_staff_id
      ? { outcomeStaffId: asId<"StaffId">(row.outcome_staff_id) }
      : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function draftToJson(draft: ClientelingOpportunityDraft): Json {
  return {
    hookKind: draft.hookKind,
    projectorKey: draft.projectorKey,
    projectorVersion: draft.projectorVersion,
    title: draft.title,
    whyNow: draft.whyNow,
    suggestedAction: draft.suggestedAction,
    suggestedChannel: draft.suggestedChannel,
    suggestedAt: draft.suggestedAt,
    priority: draft.priority,
    confidence: draft.confidence,
    dueAt: draft.dueAt,
    expiresAt: draft.expiresAt,
    evidence: draft.evidence,
  } as unknown as Json;
}

export interface ClientelingOpportunityRepositoryDeps {
  readonly analytics: AnalyticsRepository;
  readonly interest: CustomerInterestRepository;
  readonly customers: CustomerRepository;
  readonly notes: ClientelingRepository;
}

export class ClientelingOpportunityRepository {
  private readonly deps: ClientelingOpportunityRepositoryDeps;
  private readonly client: PaonSupabaseClient;

  constructor(
    client: PaonSupabaseClient,
    deps?: Partial<ClientelingOpportunityRepositoryDeps>,
  ) {
    this.client = client;
    this.deps = {
      analytics: deps?.analytics ?? new AnalyticsRepository(client),
      interest: deps?.interest ?? new CustomerInterestRepository(client),
      customers: deps?.customers ?? new CustomerRepository(client),
      notes: deps?.notes ?? new ClientelingRepository(client),
    };
  }

  async listOpenForRetailer(
    retailerId: RetailerId,
    limit = DEFAULT_MAX_INBOX_OPPORTUNITIES,
  ): Promise<ClientelingOpportunity[]> {
    const { data, error } = await this.client
      .from("clienteling_opportunities")
      .select("*")
      .eq("retailer_id", retailerId)
      .in("status", OPEN_STATUSES)
      .is("deleted_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("priority", { ascending: false })
      .order("due_at", { ascending: true })
      .limit(limit);
    if (error) throw error;
    return data.map(toDomain);
  }

  async listInboxForStaff(args: {
    readonly retailerId: RetailerId;
    readonly staffId: StaffId;
    readonly includeUnassigned?: boolean;
    readonly limit?: number;
  }): Promise<ClientelingOpportunity[]> {
    const limit = args.limit ?? DEFAULT_MAX_INBOX_OPPORTUNITIES;
    const query = this.client
      .from("clienteling_opportunities")
      .select("*")
      .eq("retailer_id", args.retailerId)
      .in("status", OPEN_STATUSES)
      .is("deleted_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("priority", { ascending: false })
      .order("due_at", { ascending: true })
      .limit(limit);

    const { data, error } =
      args.includeUnassigned === false
        ? await query.eq("assigned_staff_id", args.staffId)
        : await query.or(
            `assigned_staff_id.eq.${args.staffId},assigned_staff_id.is.null`,
          );
    if (error) throw error;
    return data.map(toDomain);
  }

  async listProjectorKeysForCustomer(
    retailerId: RetailerId,
    customerId: CustomerId,
  ): Promise<string[]> {
    const { data, error } = await this.client
      .from("clienteling_opportunities")
      .select("projector_key")
      .eq("retailer_id", retailerId)
      .eq("customer_id", customerId)
      .is("deleted_at", null);
    if (error) throw error;
    return data.map((row) => row.projector_key);
  }

  async loadRecentContacts(
    retailerId: RetailerId,
    customerIds: readonly CustomerId[],
  ): Promise<readonly RecentContactRecord[]> {
    if (customerIds.length === 0) return [];

    const [outcomes, notes] = await Promise.all([
      this.client
        .from("clienteling_opportunities")
        .select("customer_id, outcome_recorded_at")
        .eq("retailer_id", retailerId)
        .in("customer_id", [...customerIds])
        .eq("status", "completed")
        .not("outcome_recorded_at", "is", null)
        .order("outcome_recorded_at", { ascending: false })
        .limit(100),
      Promise.all(
        customerIds.map(async (customerId) => {
          const customerNotes =
            await this.deps.notes.findByCustomer(customerId);
          return customerNotes.map((note) => ({
            customerId,
            occurredAt: note.createdAt,
            source: "clienteling_note" as const,
          }));
        }),
      ),
    ]);

    if (outcomes.error) throw outcomes.error;

    const contacts: RecentContactRecord[] = [];
    for (const row of outcomes.data ?? []) {
      if (!row.outcome_recorded_at) continue;
      contacts.push({
        customerId: asId<"CustomerId">(row.customer_id),
        occurredAt: row.outcome_recorded_at,
        source: "opportunity_outcome",
      });
    }
    for (const noteContacts of notes) {
      contacts.push(...noteContacts.slice(0, 3));
    }
    return contacts;
  }

  async projectDraftsForCustomer(args: {
    readonly retailerId: RetailerId;
    readonly customerId: CustomerId;
    readonly customerName: string;
    readonly viewerRetailerId: RetailerId;
    readonly now?: string;
  }): Promise<readonly ClientelingOpportunityDraft[]> {
    const now = args.now ?? new Date().toISOString();
    const [events, interestProjection, existingProjectorKeys, recentContacts] =
      await Promise.all([
        this.deps.analytics.findRecentByCustomer(
          args.retailerId,
          args.customerId,
          50,
        ),
        this.deps.interest.projectForCustomer({
          retailerId: args.retailerId,
          customerId: args.customerId,
          viewerRetailerId: args.viewerRetailerId,
          now,
        }),
        this.listProjectorKeysForCustomer(args.retailerId, args.customerId),
        this.loadRecentContacts(args.retailerId, [args.customerId]),
      ]);

    const insights =
      interestProjection.visibility === "usable"
        ? interestProjection.insights
        : [];

    return projectClientelingOpportunityDrafts({
      retailerId: args.retailerId,
      viewerRetailerId: args.viewerRetailerId,
      customerId: args.customerId,
      customerName: args.customerName,
      now,
      events,
      interestInsights: insights,
      recentContacts,
      existingProjectorKeys,
    }).drafts;
  }

  async syncDraftsForCustomer(args: {
    readonly retailerId: RetailerId;
    readonly customerId: CustomerId;
    readonly customerName: string;
    readonly viewerRetailerId: RetailerId;
    readonly now?: string;
  }): Promise<ClientelingOpportunity[]> {
    const drafts = await this.projectDraftsForCustomer(args);
    if (drafts.length === 0) return [];

    const { data, error } = await this.client.rpc(
      "sync_clienteling_opportunity_drafts",
      {
        p_retailer_id: args.retailerId,
        p_customer_id: args.customerId,
        p_drafts: drafts.map(draftToJson) as unknown as Json,
      },
    );
    if (error) throw error;
    return (data ?? []).map(toDomain);
  }

  async syncDraftsForRetailer(args: {
    readonly retailerId: RetailerId;
    readonly viewerRetailerId: RetailerId;
    readonly now?: string;
  }): Promise<number> {
    const now = args.now ?? new Date().toISOString();
    const since = new Date(now);
    since.setUTCDate(since.getUTCDate() - RECENT_EVENT_LOOKBACK_DAYS);

    const recentEvents = await this.deps.analytics.findRecent(
      args.retailerId,
      300,
    );
    const customerIds = [
      ...new Set(
        recentEvents
          .filter(
            (event) =>
              event.customerId &&
              new Date(event.occurredAt).getTime() >= since.getTime(),
          )
          .map((event) => event.customerId as CustomerId),
      ),
    ].slice(0, RECENT_CUSTOMER_SYNC_LIMIT);

    if (customerIds.length === 0) return 0;

    const customers = await this.deps.customers.findByRetailer(args.retailerId);
    const customerById = new Map(
      customers.map((customer) => [customer.id, customer]),
    );

    let synced = 0;
    for (const customerId of customerIds) {
      const customer = customerById.get(customerId);
      if (!customer) continue;
      const rows = await this.syncDraftsForCustomer({
        retailerId: args.retailerId,
        customerId,
        customerName: customer.fullName,
        viewerRetailerId: args.viewerRetailerId,
        now,
      });
      synced += rows.length;
    }
    return synced;
  }

  async assign(
    opportunityId: string,
    staffId: StaffId,
  ): Promise<ClientelingOpportunity> {
    const { data, error } = await this.client.rpc(
      "assign_clienteling_opportunity",
      {
        p_opportunity_id: opportunityId,
        p_staff_id: staffId,
      },
    );
    if (error) throw error;
    return toDomain(data);
  }

  async updateStatus(args: {
    readonly opportunityId: string;
    readonly status: ClientelingOpportunityStatus;
    readonly feedbackNote?: string;
  }): Promise<ClientelingOpportunity> {
    const { data, error } = await this.client.rpc(
      "update_clienteling_opportunity_status",
      {
        p_opportunity_id: args.opportunityId,
        p_status: args.status,
        ...(args.feedbackNote ? { p_feedback_note: args.feedbackNote } : {}),
      },
    );
    if (error) throw error;
    return toDomain(data);
  }

  async recordOutcome(args: {
    readonly opportunityId: string;
    readonly outcomeType: ClientelingOutcomeType;
    readonly staffId: StaffId;
    readonly messageId?: MessageId;
    readonly appointmentId?: AppointmentId;
    readonly orderId?: OrderId;
    readonly feedbackNote?: string;
  }): Promise<ClientelingOpportunity> {
    const { data, error } = await this.client.rpc(
      "record_clienteling_opportunity_outcome",
      {
        p_opportunity_id: args.opportunityId,
        p_outcome_type: args.outcomeType,
        p_staff_id: args.staffId,
        ...(args.messageId ? { p_message_id: args.messageId } : {}),
        ...(args.appointmentId ? { p_appointment_id: args.appointmentId } : {}),
        ...(args.orderId ? { p_order_id: args.orderId } : {}),
        ...(args.feedbackNote ? { p_feedback_note: args.feedbackNote } : {}),
      },
    );
    if (error) throw error;
    return toDomain(data);
  }

  withCustomerNames(
    opportunities: readonly ClientelingOpportunity[],
    customers: ReadonlyMap<string, { fullName: string }>,
  ): ClientelingOpportunity[] {
    return opportunities.map((opportunity) => ({
      ...opportunity,
      customerName:
        customers.get(opportunity.customerId)?.fullName ?? "Customer",
    }));
  }

  filterOpen(
    opportunities: readonly ClientelingOpportunity[],
  ): ClientelingOpportunity[] {
    return opportunities.filter((opportunity) =>
      isOpenOpportunityStatus(opportunity.status),
    );
  }
}
