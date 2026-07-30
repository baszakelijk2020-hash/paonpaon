/**
 * Source authority and external identity registry repository (PHASE 8.2).
 */

import {
  asId,
  buildFadenFixtureIngestPlan,
  DEFAULT_FADEN_PRODUCTION_POLICY,
  FADEN_FIXTURE_MAPPING_VERSION,
  type ConnectionStatus,
  type ConnectorHealthEvent,
  type ConnectorHealthStatus,
  type ConnectorProvider,
  type ExternalIdentity,
  type ReconciliationState,
  type RetailerId,
  type SourceAuthorityMode,
  type SourceAuthorityPolicy,
  type SourceConnection,
  type SourceConnectionId,
  type SourceDomain,
  type SourceReconciliation,
  type SyncDirection,
  summarizeConnectionHealth,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database, Json } from "../generated/database.types";

type ConnectionRow = Database["public"]["Tables"]["source_connections"]["Row"];
type PolicyRow =
  Database["public"]["Tables"]["source_authority_policies"]["Row"];
type IdentityRow = Database["public"]["Tables"]["external_identities"]["Row"];
type ReconciliationRow =
  Database["public"]["Tables"]["source_reconciliations"]["Row"];
type HealthRow = Database["public"]["Tables"]["connector_health_events"]["Row"];

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function toConnection(row: ConnectionRow): SourceConnection {
  return {
    id: asId<"SourceConnectionId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    provider: row.provider as ConnectorProvider,
    label: row.label,
    status: row.status as ConnectionStatus,
    mappingVersion: row.mapping_version,
    allowedDirections: row.allowed_directions as SyncDirection[],
    ...(row.last_sync_at ? { lastSyncAt: row.last_sync_at } : {}),
    ...(row.cursor ? { cursor: row.cursor } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toPolicy(row: PolicyRow): SourceAuthorityPolicy {
  return {
    id: asId<"SourceAuthorityPolicyId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    domain: row.domain as SourceDomain,
    fieldGroup: row.field_group,
    authorityMode: row.authority_mode as SourceAuthorityMode,
    allowedDirections: row.allowed_directions as SyncDirection[],
    ...(row.connection_id
      ? { connectionId: asId<"SourceConnectionId">(row.connection_id) }
      : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toIdentity(row: IdentityRow): ExternalIdentity {
  return {
    id: asId<"ExternalIdentityId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    connectionId: asId<"SourceConnectionId">(row.connection_id),
    domain: row.domain as SourceDomain,
    externalObjectType: row.external_object_type,
    externalId: row.external_id,
    canonicalType: row.canonical_type,
    canonicalId: row.canonical_id,
    externalVersion: row.external_version,
    mappingVersion: row.mapping_version,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toReconciliation(row: ReconciliationRow): SourceReconciliation {
  return {
    id: asId<"SourceReconciliationId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    externalIdentityId: asId<"ExternalIdentityId">(row.external_identity_id),
    state: row.state as ReconciliationState,
    ...(row.conflict_reason ? { conflictReason: row.conflict_reason } : {}),
    ...(row.resolved_at ? { resolvedAt: row.resolved_at } : {}),
    observedAt: row.observed_at,
  };
}

function toHealth(row: HealthRow): ConnectorHealthEvent {
  return {
    id: row.id,
    retailerId: asId<"RetailerId">(row.retailer_id),
    connectionId: asId<"SourceConnectionId">(row.connection_id),
    status: row.status as ConnectorHealthStatus,
    lagSeconds: row.lag_seconds,
    openConflictCount: row.open_conflict_count,
    ...(row.notes ? { notes: row.notes } : {}),
    observedAt: row.observed_at,
  };
}

export interface SourceIngestResult {
  readonly snapshotId: string | null;
  readonly externalIdentityId: string;
  readonly reconciliationState: ReconciliationState;
  readonly conflictReason?: string;
  readonly updated: boolean;
}

export interface RetailerConnectionOverview {
  readonly connection: SourceConnection;
  readonly policies: readonly SourceAuthorityPolicy[];
  readonly openConflicts: readonly SourceReconciliation[];
  readonly latestHealth?: ConnectorHealthEvent;
  readonly summarizedStatus: ConnectorHealthStatus;
}

export class SourceAuthorityRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async listConnectionsForRetailer(
    retailerId: RetailerId,
  ): Promise<SourceConnection[]> {
    const { data, error } = await this.client
      .from("source_connections")
      .select("*")
      .eq("retailer_id", retailerId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data.map(toConnection);
  }

  async listAllConnections(limit = 100): Promise<SourceConnection[]> {
    const { data, error } = await this.client
      .from("source_connections")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data.map(toConnection);
  }

  async getAuthorityPolicies(
    retailerId: RetailerId,
  ): Promise<SourceAuthorityPolicy[]> {
    const { data, error } = await this.client
      .from("source_authority_policies")
      .select("*")
      .eq("retailer_id", retailerId)
      .order("domain", { ascending: true })
      .order("field_group", { ascending: true });
    if (error) throw error;
    return data.map(toPolicy);
  }

  async ensureFadenFixtureConnection(
    retailerId: RetailerId,
  ): Promise<SourceConnection> {
    const existing = await this.listConnectionsForRetailer(retailerId);
    const faden = existing.find(
      (connection) =>
        connection.provider === "faden" && connection.label === "Faden fixture",
    );
    if (faden) {
      return faden;
    }

    const { data, error } = await this.client
      .from("source_connections")
      .insert({
        retailer_id: retailerId,
        provider: "faden",
        label: "Faden fixture",
        status: "fixture",
        mapping_version: FADEN_FIXTURE_MAPPING_VERSION,
        allowed_directions: ["ingest"],
        config: { fixture: true, liveCredentials: false },
      })
      .select("*")
      .single();
    if (error) throw error;

    const connection = toConnection(data);

    await this.client.from("source_authority_policies").upsert(
      {
        retailer_id: retailerId,
        domain: DEFAULT_FADEN_PRODUCTION_POLICY.domain,
        field_group: DEFAULT_FADEN_PRODUCTION_POLICY.fieldGroup,
        authority_mode: DEFAULT_FADEN_PRODUCTION_POLICY.authorityMode,
        allowed_directions: [
          ...DEFAULT_FADEN_PRODUCTION_POLICY.allowedDirections,
        ],
        connection_id: connection.id,
      },
      { onConflict: "retailer_id,domain,field_group" },
    );

    return connection;
  }

  async listOpenConflicts(
    retailerId: RetailerId,
  ): Promise<SourceReconciliation[]> {
    const { data, error } = await this.client
      .from("source_reconciliations")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("state", "conflict")
      .is("resolved_at", null)
      .order("observed_at", { ascending: false });
    if (error) throw error;
    return data.map(toReconciliation);
  }

  async listRecentHealth(
    retailerId?: RetailerId,
    limit = 30,
  ): Promise<ConnectorHealthEvent[]> {
    let query = this.client
      .from("connector_health_events")
      .select("*")
      .order("observed_at", { ascending: false })
      .limit(limit);
    if (retailerId) {
      query = query.eq("retailer_id", retailerId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data.map(toHealth);
  }

  async getRetailerOverview(
    retailerId: RetailerId,
  ): Promise<RetailerConnectionOverview[]> {
    const [connections, policies, openConflicts, health] = await Promise.all([
      this.listConnectionsForRetailer(retailerId),
      this.getAuthorityPolicies(retailerId),
      this.listOpenConflicts(retailerId),
      this.listRecentHealth(retailerId, 20),
    ]);

    return connections.map((connection) => {
      const connectionPolicies = policies.filter(
        (policy) => policy.connectionId === connection.id,
      );
      const connectionConflicts = openConflicts;
      const latestHealth = health.find(
        (event) => event.connectionId === connection.id,
      );
      return {
        connection,
        policies: connectionPolicies,
        openConflicts: connectionConflicts,
        ...(latestHealth ? { latestHealth } : {}),
        summarizedStatus: summarizeConnectionHealth({
          status: connection.status,
          ...(latestHealth ? { latestHealth: latestHealth.status } : {}),
          ...(latestHealth?.lagSeconds !== undefined
            ? { lagSeconds: latestHealth.lagSeconds }
            : {}),
          openConflictCount: connectionConflicts.length,
          fixtureMode: connection.status === "fixture",
        }),
      };
    });
  }

  async ingestSnapshot(args: {
    readonly connectionId: SourceConnectionId;
    readonly providerEventId: string;
    readonly payloadHash: string;
    readonly rawPayload: Readonly<Record<string, unknown>>;
    readonly domain: SourceDomain;
    readonly externalObjectType: string;
    readonly externalId: string;
    readonly canonicalType: string;
    readonly canonicalId: string;
    readonly externalVersion: string;
    readonly mappingVersion: string;
  }): Promise<SourceIngestResult> {
    const { data, error } = await this.client.rpc("ingest_source_snapshot", {
      p_connection_id: args.connectionId,
      p_provider_event_id: args.providerEventId,
      p_payload_hash: args.payloadHash,
      p_raw_payload: toJson(args.rawPayload),
      p_domain: args.domain,
      p_external_object_type: args.externalObjectType,
      p_external_id: args.externalId,
      p_canonical_type: args.canonicalType,
      p_canonical_id: args.canonicalId,
      p_external_version: args.externalVersion,
      p_mapping_version: args.mappingVersion,
    });
    if (error) throw error;

    const result = data as {
      snapshotId: string | null;
      externalIdentityId: string;
      reconciliationState: ReconciliationState;
      conflictReason?: string | null;
      updated: boolean;
    };

    return {
      snapshotId: result.snapshotId,
      externalIdentityId: result.externalIdentityId,
      reconciliationState: result.reconciliationState,
      ...(result.conflictReason
        ? { conflictReason: result.conflictReason }
        : {}),
      updated: result.updated,
    };
  }

  async runFadenFixtureIngest(retailerId: RetailerId): Promise<{
    readonly connection: SourceConnection;
    readonly result: SourceIngestResult;
    readonly deepLinkUrl: string;
  }> {
    const connection = await this.ensureFadenFixtureConnection(retailerId);

    const identities = await this.client
      .from("external_identities")
      .select("canonical_id, external_version, mapping_version")
      .eq("connection_id", connection.id)
      .eq("external_object_type", "production_order")
      .maybeSingle();

    if (identities.error) {
      throw identities.error;
    }

    const plan = buildFadenFixtureIngestPlan({
      retailerId,
      connectionId: connection.id,
      ...(identities.data
        ? {
            existingIdentity: {
              canonicalId: identities.data.canonical_id,
              externalVersion: identities.data.external_version,
              mappingVersion: identities.data.mapping_version,
            },
          }
        : {}),
    });

    const result = await this.ingestSnapshot({
      connectionId: connection.id,
      providerEventId: plan.providerEventId,
      payloadHash: plan.payloadHash,
      rawPayload: plan.rawPayload,
      domain: plan.externalIdentity.domain,
      externalObjectType: plan.externalIdentity.externalObjectType,
      externalId: plan.externalIdentity.externalId,
      canonicalType: plan.externalIdentity.canonicalType,
      canonicalId: plan.externalIdentity.canonicalId,
      externalVersion: plan.externalIdentity.externalVersion,
      mappingVersion: plan.externalIdentity.mappingVersion,
    });

    return {
      connection,
      result,
      deepLinkUrl: plan.deepLinkUrl,
    };
  }

  async findExternalIdentityByExternalKey(args: {
    readonly connectionId: SourceConnectionId;
    readonly externalObjectType: string;
    readonly externalId: string;
  }): Promise<ExternalIdentity | null> {
    const { data, error } = await this.client
      .from("external_identities")
      .select("*")
      .eq("connection_id", args.connectionId)
      .eq("external_object_type", args.externalObjectType)
      .eq("external_id", args.externalId)
      .maybeSingle();
    if (error) throw error;
    return data ? toIdentity(data) : null;
  }
}
