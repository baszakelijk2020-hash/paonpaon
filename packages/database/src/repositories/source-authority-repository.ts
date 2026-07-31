/**
 * Source-authority / external-identity registry (PHASE 8.2).
 * Mutations are service-role; reads are tenant-scoped even then.
 */

import {
  asId,
  planFadenReadOnlyIngest,
  type ConnectionHealthStatus,
  type ConnectionOperationalState,
  type ExternalIdentity,
  type FadenReadOnlyIngestInput,
  type IntegrationConnection,
  type IntegrationProvider,
  type IntegrationRawEvent,
  type ReconciliationStatus,
  type RetailerId,
  type SourceAuthorityDirection,
  type SourceAuthorityDomain,
  type SourceAuthorityMode,
  type SourceAuthorityPolicy,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database, Json } from "../generated/database.types";

type ConnectionRow =
  Database["public"]["Tables"]["integration_connections"]["Row"];
type PolicyRow =
  Database["public"]["Tables"]["source_authority_policies"]["Row"];
type IdentityRow = Database["public"]["Tables"]["external_identities"]["Row"];
type RawEventRow =
  Database["public"]["Tables"]["integration_raw_events"]["Row"];
type HandoffRow =
  Database["public"]["Tables"]["integration_handoff_tasks"]["Row"];

export interface IntegrationHandoffTask {
  readonly id: string;
  readonly retailerId: RetailerId;
  readonly connectionId: string;
  readonly externalObjectType: string;
  readonly externalId: string;
  readonly deepLinkUrl: string;
  readonly writeBackClaimed: false;
  readonly instruction: string;
  readonly status: "open" | "confirmed" | "cancelled";
  readonly createdAt: string;
  readonly updatedAt: string;
}

function toConnection(row: ConnectionRow): IntegrationConnection {
  return {
    id: row.id,
    retailerId: asId<"RetailerId">(row.retailer_id),
    provider: row.provider as IntegrationProvider,
    displayName: row.display_name,
    healthStatus: row.health_status as ConnectionHealthStatus,
    operationalState: row.operational_state as ConnectionOperationalState,
    lagSeconds: row.lag_seconds,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    ...(row.last_success_at ? { lastSuccessAt: row.last_success_at } : {}),
    ...(row.last_error_at ? { lastErrorAt: row.last_error_at } : {}),
    ...(row.last_error_summary
      ? { lastErrorSummary: row.last_error_summary }
      : {}),
    ...(row.deep_link_base_url
      ? { deepLinkBaseUrl: row.deep_link_base_url }
      : {}),
  };
}

function toPolicy(row: PolicyRow): SourceAuthorityPolicy {
  return {
    id: row.id,
    retailerId: asId<"RetailerId">(row.retailer_id),
    connectionId: row.connection_id,
    domain: row.domain as SourceAuthorityDomain,
    fieldGroup: row.field_group,
    authority: row.authority as SourceAuthorityMode,
    allowedDirections: row.allowed_directions as SourceAuthorityDirection[],
    mappingVersion: row.mapping_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function toIdentity(row: IdentityRow): ExternalIdentity {
  return {
    id: row.id,
    retailerId: asId<"RetailerId">(row.retailer_id),
    connectionId: row.connection_id,
    domain: row.domain as SourceAuthorityDomain,
    externalObjectType: row.external_object_type,
    externalId: row.external_id,
    canonicalObjectType: row.canonical_object_type,
    canonicalId: row.canonical_id,
    mappingVersion: row.mapping_version,
    reconciliationStatus: row.reconciliation_status as ReconciliationStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    ...(row.external_version ? { externalVersion: row.external_version } : {}),
    ...(row.external_updated_at
      ? { externalUpdatedAt: row.external_updated_at }
      : {}),
    ...(row.raw_event_id ? { rawEventId: row.raw_event_id } : {}),
    ...(row.conflict_summary ? { conflictSummary: row.conflict_summary } : {}),
  };
}

function toRawEvent(row: RawEventRow): IntegrationRawEvent {
  return {
    id: row.id,
    retailerId: asId<"RetailerId">(row.retailer_id),
    connectionId: row.connection_id,
    providerEventId: row.provider_event_id,
    payloadHash: row.payload_hash,
    receivedAt: row.received_at,
    mappingVersion: row.mapping_version,
    direction: row.direction as SourceAuthorityDirection,
  };
}

function toHandoff(row: HandoffRow): IntegrationHandoffTask {
  return {
    id: row.id,
    retailerId: asId<"RetailerId">(row.retailer_id),
    connectionId: row.connection_id,
    externalObjectType: row.external_object_type,
    externalId: row.external_id,
    deepLinkUrl: row.deep_link_url,
    writeBackClaimed: false,
    instruction: row.instruction,
    status: row.status as IntegrationHandoffTask["status"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface FadenIngestPersistResult {
  readonly ok: boolean;
  readonly idempotentReplay: boolean;
  readonly writeBackClaimed: false;
  readonly rawEvent?: IntegrationRawEvent;
  readonly identity?: ExternalIdentity;
  readonly handoff?: IntegrationHandoffTask;
  readonly conflictCode?: string;
  readonly conflictMessage?: string;
}

export class SourceAuthorityRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async listConnections(
    retailerId: RetailerId,
  ): Promise<IntegrationConnection[]> {
    const { data, error } = await this.client
      .from("integration_connections")
      .select("*")
      .eq("retailer_id", retailerId)
      .is("deleted_at", null)
      .order("display_name", { ascending: true });
    if (error) throw error;
    return data.map(toConnection);
  }

  async listPolicies(
    retailerId: RetailerId,
    connectionId?: string,
  ): Promise<SourceAuthorityPolicy[]> {
    let query = this.client
      .from("source_authority_policies")
      .select("*")
      .eq("retailer_id", retailerId)
      .is("deleted_at", null)
      .order("domain", { ascending: true });
    if (connectionId) {
      query = query.eq("connection_id", connectionId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data.map(toPolicy);
  }

  async listIdentities(
    retailerId: RetailerId,
    limit = 40,
  ): Promise<ExternalIdentity[]> {
    const { data, error } = await this.client
      .from("external_identities")
      .select("*")
      .eq("retailer_id", retailerId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data.map(toIdentity);
  }

  async listHandoffs(
    retailerId: RetailerId,
    limit = 20,
  ): Promise<IntegrationHandoffTask[]> {
    const { data, error } = await this.client
      .from("integration_handoff_tasks")
      .select("*")
      .eq("retailer_id", retailerId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data.map(toHandoff);
  }

  async findIdentityByExternal(args: {
    readonly retailerId: RetailerId;
    readonly connectionId: string;
    readonly domain: SourceAuthorityDomain;
    readonly externalObjectType: string;
    readonly externalId: string;
  }): Promise<ExternalIdentity | null> {
    const { data, error } = await this.client
      .from("external_identities")
      .select("*")
      .eq("retailer_id", args.retailerId)
      .eq("connection_id", args.connectionId)
      .eq("domain", args.domain)
      .eq("external_object_type", args.externalObjectType)
      .eq("external_id", args.externalId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    return data ? toIdentity(data) : null;
  }

  async createConnection(args: {
    readonly retailerId: RetailerId;
    readonly provider: IntegrationProvider;
    readonly displayName: string;
    readonly deepLinkBaseUrl?: string;
    readonly healthStatus?: ConnectionHealthStatus;
  }): Promise<IntegrationConnection> {
    const { data, error } = await this.client
      .from("integration_connections")
      .insert({
        retailer_id: args.retailerId,
        provider: args.provider,
        display_name: args.displayName,
        health_status: args.healthStatus ?? "disconnected",
        ...(args.deepLinkBaseUrl
          ? { deep_link_base_url: args.deepLinkBaseUrl }
          : {}),
      })
      .select("*")
      .single();
    if (error) throw error;
    return toConnection(data);
  }

  async upsertPolicy(args: {
    readonly retailerId: RetailerId;
    readonly connectionId: string;
    readonly domain: SourceAuthorityDomain;
    readonly fieldGroup: string;
    readonly authority: SourceAuthorityMode;
    readonly allowedDirections: readonly SourceAuthorityDirection[];
    readonly mappingVersion: string;
  }): Promise<SourceAuthorityPolicy> {
    const existing = await this.client
      .from("source_authority_policies")
      .select("*")
      .eq("retailer_id", args.retailerId)
      .eq("connection_id", args.connectionId)
      .eq("domain", args.domain)
      .eq("field_group", args.fieldGroup)
      .is("deleted_at", null)
      .maybeSingle();
    if (existing.error) throw existing.error;

    if (existing.data) {
      const { data, error } = await this.client
        .from("source_authority_policies")
        .update({
          authority: args.authority,
          allowed_directions: [...args.allowedDirections],
          mapping_version: args.mappingVersion,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.data.id)
        .eq("retailer_id", args.retailerId)
        .select("*")
        .single();
      if (error) throw error;
      return toPolicy(data);
    }

    const { data, error } = await this.client
      .from("source_authority_policies")
      .insert({
        retailer_id: args.retailerId,
        connection_id: args.connectionId,
        domain: args.domain,
        field_group: args.fieldGroup,
        authority: args.authority,
        allowed_directions: [...args.allowedDirections],
        mapping_version: args.mappingVersion,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toPolicy(data);
  }

  /**
   * Persist a Faden read-only ingest decision. Never claims write-back.
   * Replays of the same provider_event_id are idempotent.
   */
  async ingestFadenReadOnly(
    input: FadenReadOnlyIngestInput,
    payload: Readonly<Record<string, unknown>>,
  ): Promise<FadenIngestPersistResult> {
    const existingRaw = await this.client
      .from("integration_raw_events")
      .select("*")
      .eq("retailer_id", input.retailerId)
      .eq("connection_id", input.connectionId)
      .eq("provider_event_id", input.providerEventId)
      .maybeSingle();
    if (existingRaw.error) throw existingRaw.error;

    if (existingRaw.data) {
      const identity = await this.findIdentityByExternal({
        retailerId: input.retailerId,
        connectionId: input.connectionId,
        domain: input.policy.domain,
        externalObjectType: input.externalObjectType,
        externalId: input.externalId,
      });
      return {
        ok: true,
        idempotentReplay: true,
        writeBackClaimed: false,
        rawEvent: toRawEvent(existingRaw.data),
        ...(identity ? { identity } : {}),
      };
    }

    const known = await this.findIdentityByExternal({
      retailerId: input.retailerId,
      connectionId: input.connectionId,
      domain: input.policy.domain,
      externalObjectType: input.externalObjectType,
      externalId: input.externalId,
    });

    const planned = planFadenReadOnlyIngest({
      ...input,
      ...(known?.externalUpdatedAt
        ? { knownExternalUpdatedAt: known.externalUpdatedAt }
        : {}),
    });

    const { data: rawRow, error: rawError } = await this.client
      .from("integration_raw_events")
      .insert({
        retailer_id: input.retailerId,
        connection_id: input.connectionId,
        provider_event_id: input.providerEventId,
        payload_hash: input.payloadHash,
        payload: payload as Json,
        received_at: input.receivedAt,
        mapping_version: input.mappingVersion,
        direction: "ingest",
      })
      .select("*")
      .single();
    if (rawError) throw rawError;

    let handoff: IntegrationHandoffTask | undefined;
    if (planned.deepLink) {
      const { data: handoffRow, error: handoffError } = await this.client
        .from("integration_handoff_tasks")
        .insert({
          retailer_id: input.retailerId,
          connection_id: input.connectionId,
          external_object_type: planned.deepLink.externalObjectType,
          external_id: planned.deepLink.externalId,
          deep_link_url: planned.deepLink.url,
          write_back_claimed: false,
          instruction: planned.deepLink.instruction,
          status: "open",
        })
        .select("*")
        .single();
      if (handoffError) throw handoffError;
      handoff = toHandoff(handoffRow);
    }

    if (!planned.ok) {
      let conflictIdentity: ExternalIdentity;
      if (known) {
        const { data, error } = await this.client
          .from("external_identities")
          .update({
            raw_event_id: rawRow.id,
            reconciliation_status: "conflict",
            conflict_summary: planned.conflict?.message ?? "authority conflict",
            updated_at: new Date().toISOString(),
          })
          .eq("id", known.id)
          .eq("retailer_id", input.retailerId)
          .select("*")
          .single();
        if (error) throw error;
        conflictIdentity = toIdentity(data);
      } else {
        const { data, error } = await this.client
          .from("external_identities")
          .insert({
            retailer_id: input.retailerId,
            connection_id: input.connectionId,
            domain: input.policy.domain,
            external_object_type: input.externalObjectType,
            external_id: input.externalId,
            canonical_object_type: input.canonicalObjectType,
            canonical_id: input.canonicalId,
            external_updated_at: input.externalUpdatedAt,
            raw_event_id: rawRow.id,
            mapping_version: input.mappingVersion,
            reconciliation_status: "conflict",
            conflict_summary: planned.conflict?.message ?? "authority conflict",
          })
          .select("*")
          .single();
        if (error) throw error;
        conflictIdentity = toIdentity(data);
      }

      await this.markConnectionHealth(
        input.retailerId,
        input.connectionId,
        "failed",
        planned.conflict?.message,
      );
      return {
        ok: false,
        idempotentReplay: false,
        writeBackClaimed: false,
        rawEvent: toRawEvent(rawRow),
        identity: conflictIdentity,
        ...(handoff ? { handoff } : {}),
        ...(planned.conflict
          ? {
              conflictCode: planned.conflict.code,
              conflictMessage: planned.conflict.message,
            }
          : {}),
      };
    }

    let identity: ExternalIdentity;
    if (known) {
      const { data, error } = await this.client
        .from("external_identities")
        .update({
          canonical_object_type: input.canonicalObjectType,
          canonical_id: input.canonicalId,
          external_updated_at: input.externalUpdatedAt,
          raw_event_id: rawRow.id,
          mapping_version: input.mappingVersion,
          reconciliation_status: "matched",
          conflict_summary: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", known.id)
        .eq("retailer_id", input.retailerId)
        .select("*")
        .single();
      if (error) throw error;
      identity = toIdentity(data);
    } else {
      const { data, error } = await this.client
        .from("external_identities")
        .insert({
          retailer_id: input.retailerId,
          connection_id: input.connectionId,
          domain: input.policy.domain,
          external_object_type: input.externalObjectType,
          external_id: input.externalId,
          canonical_object_type: input.canonicalObjectType,
          canonical_id: input.canonicalId,
          external_updated_at: input.externalUpdatedAt,
          raw_event_id: rawRow.id,
          mapping_version: input.mappingVersion,
          reconciliation_status: "matched",
        })
        .select("*")
        .single();
      if (error) throw error;
      identity = toIdentity(data);
    }

    await this.markConnectionHealth(
      input.retailerId,
      input.connectionId,
      "healthy",
    );

    return {
      ok: true,
      idempotentReplay: false,
      writeBackClaimed: false,
      rawEvent: toRawEvent(rawRow),
      identity,
      ...(handoff ? { handoff } : {}),
    };
  }

  private async markConnectionHealth(
    retailerId: RetailerId,
    connectionId: string,
    status: ConnectionHealthStatus,
    errorSummary?: string,
  ): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await this.client
      .from("integration_connections")
      .update({
        health_status: status,
        updated_at: now,
        ...(status === "healthy"
          ? { last_success_at: now, last_error_summary: null }
          : {
              last_error_at: now,
              ...(errorSummary ? { last_error_summary: errorSummary } : {}),
            }),
      })
      .eq("id", connectionId)
      .eq("retailer_id", retailerId);
    if (error) throw error;
  }
}
