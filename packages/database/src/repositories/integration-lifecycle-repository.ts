/**
 * Integration connection lifecycle (PHASE 9.2): operator-intended pause/
 * resume/disconnect, connection secret references, sync cursors, run
 * history, dead letters and reconciliation reports.
 *
 * Mutations are service-role only (matching source-authority-repository.ts's
 * boundary); reads stay tenant-scoped even for service-role callers, because
 * every method here takes an explicit retailerId and always filters by it —
 * a caller cannot accidentally read across tenants just because it holds the
 * service-role client.
 */

import {
  asId,
  connectionAcceptsIngest,
  planConnectionOperationalTransition,
  type ConnectionOperationalState,
  type ConnectionSecretRef,
  type DeadLetter,
  type DeadLetterFailureReason,
  type DeadLetterResolution,
  type IntegrationSecretKind,
  type ReconciliationReport,
  type RetailerId,
  type SyncCursor,
  type SyncRun,
  type SyncRunStatus,
  type SyncRunTriggerKind,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database, Json } from "../generated/database.types";

type ConnectionRow =
  Database["public"]["Tables"]["integration_connections"]["Row"];
type SecretRow =
  Database["public"]["Tables"]["integration_connection_secrets"]["Row"];
type CursorRow =
  Database["public"]["Tables"]["integration_sync_cursors"]["Row"];
type RunRow = Database["public"]["Tables"]["integration_sync_runs"]["Row"];
type DeadLetterRow =
  Database["public"]["Tables"]["integration_dead_letters"]["Row"];
type ReconciliationRow =
  Database["public"]["Tables"]["integration_reconciliation_reports"]["Row"];

function toSecretRef(row: SecretRow): ConnectionSecretRef {
  return {
    id: row.id,
    retailerId: asId<"RetailerId">(row.retailer_id),
    connectionId: row.connection_id,
    kind: row.kind as IntegrationSecretKind,
    ...(row.secret_ref ? { secretRef: row.secret_ref } : {}),
    ...(row.last_rotated_at ? { lastRotatedAt: row.last_rotated_at } : {}),
    ...(row.revoked_at ? { revokedAt: row.revoked_at } : {}),
  };
}

function toCursor(row: CursorRow): SyncCursor {
  return {
    id: row.id,
    retailerId: asId<"RetailerId">(row.retailer_id),
    connectionId: row.connection_id,
    resource: row.resource,
    cursorValue: (row.cursor_value as Record<string, unknown>) ?? {},
    ...(row.last_synced_at ? { lastSyncedAt: row.last_synced_at } : {}),
  };
}

function toRun(row: RunRow): SyncRun {
  return {
    id: row.id,
    retailerId: asId<"RetailerId">(row.retailer_id),
    connectionId: row.connection_id,
    triggerKind: row.trigger_kind as SyncRunTriggerKind,
    status: row.status as SyncRunStatus,
    startedAt: row.started_at,
    ...(row.finished_at ? { finishedAt: row.finished_at } : {}),
    recordsProcessed: row.records_processed,
    recordsFailed: row.records_failed,
    ...(row.error_summary ? { errorSummary: row.error_summary } : {}),
  };
}

function toDeadLetter(row: DeadLetterRow): DeadLetter {
  return {
    id: row.id,
    retailerId: asId<"RetailerId">(row.retailer_id),
    connectionId: row.connection_id,
    ...(row.run_id ? { runId: row.run_id } : {}),
    ...(row.provider_event_id
      ? { providerEventId: row.provider_event_id }
      : {}),
    failureReason: row.failure_reason as DeadLetterFailureReason,
    failureDetail: (row.failure_detail as Record<string, unknown>) ?? {},
    retryCount: row.retry_count,
    firstFailedAt: row.first_failed_at,
    lastAttemptedAt: row.last_attempted_at,
    ...(row.resolved_at ? { resolvedAt: row.resolved_at } : {}),
    ...(row.resolution
      ? { resolution: row.resolution as DeadLetterResolution }
      : {}),
  };
}

function toReconciliationReport(row: ReconciliationRow): ReconciliationReport {
  return {
    id: row.id,
    retailerId: asId<"RetailerId">(row.retailer_id),
    connectionId: row.connection_id,
    ...(row.run_id ? { runId: row.run_id } : {}),
    resource: row.resource,
    matchedCount: row.matched_count,
    conflictCount: row.conflict_count,
    staleCount: row.stale_count,
    deadLetterCount: row.dead_letter_count,
    generatedAt: row.generated_at,
  };
}

export type TransitionConnectionResult =
  | { readonly ok: true; readonly nextState: ConnectionOperationalState }
  | {
      readonly ok: false;
      readonly reason: "already_in_state" | "transition_not_allowed";
    };

export class IntegrationLifecycleRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  /**
   * The one method here that does NOT take a retailerId: an inbound
   * provider webhook only ever carries a connectionId in its URL, so this
   * is how the route handler discovers which retailer that connection
   * belongs to before it can call anything else in this class. Must only
   * ever be called with a service-role client — the row it returns still
   * carries retailer_id for every subsequent call to check against.
   */
  async findConnectionByIdForWebhook(connectionId: string): Promise<{
    readonly id: string;
    readonly retailerId: RetailerId;
    readonly operationalState: ConnectionOperationalState;
  } | null> {
    const { data, error } = await this.client
      .from("integration_connections")
      .select("id, retailer_id, operational_state")
      .eq("id", connectionId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      id: data.id,
      retailerId: asId<"RetailerId">(data.retailer_id),
      operationalState: data.operational_state as ConnectionOperationalState,
    };
  }

  /**
   * Applies an operator-requested pause/resume/disconnect. Delegates the
   * legality check to the domain layer (planConnectionOperationalTransition)
   * so a route handler and this repository can never disagree about which
   * transitions are allowed.
   */
  async transitionConnection(args: {
    readonly retailerId: RetailerId;
    readonly connectionId: string;
    readonly requestedState: ConnectionOperationalState;
    readonly reason?: string;
    readonly changedByStaffId?: string;
  }): Promise<TransitionConnectionResult> {
    const { data: row, error: fetchError } = await this.client
      .from("integration_connections")
      .select("operational_state")
      .eq("id", args.connectionId)
      .eq("retailer_id", args.retailerId)
      .single();
    if (fetchError) throw fetchError;

    const currentState = row.operational_state as ConnectionOperationalState;
    const planned = planConnectionOperationalTransition({
      currentState,
      requestedState: args.requestedState,
    });
    if (!planned.ok) return planned;

    const { error: updateError } = await this.client
      .from("integration_connections")
      .update({
        operational_state: planned.nextState,
        operational_state_reason: args.reason ?? null,
        operational_state_changed_at: new Date().toISOString(),
        operational_state_changed_by: args.changedByStaffId ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", args.connectionId)
      .eq("retailer_id", args.retailerId);
    if (updateError) throw updateError;

    return planned;
  }

  /**
   * Active Shopify connections eligible for scheduled delta sync (PHASE 9.2).
   * Service-role only — scans all tenants for the cron orchestrator.
   */
  async listActiveShopifyConnectionsForScheduledSync(): Promise<
    readonly {
      readonly retailerId: RetailerId;
      readonly connectionId: string;
    }[]
  > {
    const { data, error } = await this.client
      .from("integration_connections")
      .select("id, retailer_id")
      .eq("provider", "shopify")
      .eq("operational_state", "active")
      .is("deleted_at", null);
    if (error) throw error;
    return (data ?? []).map((row) => ({
      retailerId: asId<"RetailerId">(row.retailer_id),
      connectionId: row.id,
    }));
  }

  async getOperationalState(args: {
    readonly retailerId: RetailerId;
    readonly connectionId: string;
  }): Promise<ConnectionOperationalState> {
    const { data, error } = await this.client
      .from("integration_connections")
      .select("operational_state")
      .eq("id", args.connectionId)
      .eq("retailer_id", args.retailerId)
      .single();
    if (error) throw error;
    return data.operational_state as ConnectionOperationalState;
  }

  /** True only while a connection is in the "active" operational state. */
  async connectionAcceptsIngestNow(args: {
    readonly retailerId: RetailerId;
    readonly connectionId: string;
  }): Promise<boolean> {
    return connectionAcceptsIngest(await this.getOperationalState(args));
  }

  async upsertConnectionSecretRef(args: {
    readonly retailerId: RetailerId;
    readonly connectionId: string;
    readonly kind: IntegrationSecretKind;
    readonly secretRef?: string;
  }): Promise<ConnectionSecretRef> {
    const { data, error } = await this.client
      .from("integration_connection_secrets")
      .upsert(
        {
          retailer_id: args.retailerId,
          connection_id: args.connectionId,
          kind: args.kind,
          secret_ref: args.secretRef ?? null,
          last_rotated_at: new Date().toISOString(),
          revoked_at: null,
        },
        { onConflict: "connection_id,kind" },
      )
      .select("*")
      .single();
    if (error) throw error;
    return toSecretRef(data);
  }

  async revokeConnectionSecret(args: {
    readonly retailerId: RetailerId;
    readonly connectionId: string;
    readonly kind: IntegrationSecretKind;
  }): Promise<void> {
    const { error } = await this.client
      .from("integration_connection_secrets")
      .update({ revoked_at: new Date().toISOString() })
      .eq("connection_id", args.connectionId)
      .eq("retailer_id", args.retailerId)
      .eq("kind", args.kind);
    if (error) throw error;
  }

  async listConnectionSecretRefs(args: {
    readonly retailerId: RetailerId;
    readonly connectionId: string;
  }): Promise<readonly ConnectionSecretRef[]> {
    const { data, error } = await this.client
      .from("integration_connection_secrets")
      .select("*")
      .eq("connection_id", args.connectionId)
      .eq("retailer_id", args.retailerId);
    if (error) throw error;
    return (data ?? []).map(toSecretRef);
  }

  async getSyncCursor(args: {
    readonly retailerId: RetailerId;
    readonly connectionId: string;
    readonly resource: string;
  }): Promise<SyncCursor | null> {
    const { data, error } = await this.client
      .from("integration_sync_cursors")
      .select("*")
      .eq("connection_id", args.connectionId)
      .eq("retailer_id", args.retailerId)
      .eq("resource", args.resource)
      .maybeSingle();
    if (error) throw error;
    return data ? toCursor(data) : null;
  }

  async upsertSyncCursor(args: {
    readonly retailerId: RetailerId;
    readonly connectionId: string;
    readonly resource: string;
    readonly cursorValue: Record<string, unknown>;
  }): Promise<SyncCursor> {
    const { data, error } = await this.client
      .from("integration_sync_cursors")
      .upsert(
        {
          retailer_id: args.retailerId,
          connection_id: args.connectionId,
          resource: args.resource,
          cursor_value: args.cursorValue as Json,
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: "connection_id,resource" },
      )
      .select("*")
      .single();
    if (error) throw error;
    return toCursor(data);
  }

  async startSyncRun(args: {
    readonly retailerId: RetailerId;
    readonly connectionId: string;
    readonly triggerKind: SyncRunTriggerKind;
  }): Promise<SyncRun> {
    const { data, error } = await this.client
      .from("integration_sync_runs")
      .insert({
        retailer_id: args.retailerId,
        connection_id: args.connectionId,
        trigger_kind: args.triggerKind,
        status: "running",
      })
      .select("*")
      .single();
    if (error) throw error;
    return toRun(data);
  }

  async finishSyncRun(args: {
    readonly retailerId: RetailerId;
    readonly runId: string;
    readonly status: Exclude<SyncRunStatus, "running">;
    readonly recordsProcessed: number;
    readonly recordsFailed: number;
    readonly errorSummary?: string;
  }): Promise<SyncRun> {
    const { data, error } = await this.client
      .from("integration_sync_runs")
      .update({
        status: args.status,
        finished_at: new Date().toISOString(),
        records_processed: args.recordsProcessed,
        records_failed: args.recordsFailed,
        error_summary: args.errorSummary ?? null,
      })
      .eq("id", args.runId)
      .eq("retailer_id", args.retailerId)
      .select("*")
      .single();
    if (error) throw error;
    return toRun(data);
  }

  async listSyncRuns(args: {
    readonly retailerId: RetailerId;
    readonly connectionId: string;
    readonly limit?: number;
  }): Promise<readonly SyncRun[]> {
    const { data, error } = await this.client
      .from("integration_sync_runs")
      .select("*")
      .eq("connection_id", args.connectionId)
      .eq("retailer_id", args.retailerId)
      .order("started_at", { ascending: false })
      .limit(args.limit ?? 20);
    if (error) throw error;
    return (data ?? []).map(toRun);
  }

  async recordDeadLetter(args: {
    readonly retailerId: RetailerId;
    readonly connectionId: string;
    readonly runId?: string;
    readonly providerEventId?: string;
    readonly failureReason: DeadLetterFailureReason;
    readonly failureDetail?: Record<string, unknown>;
  }): Promise<DeadLetter> {
    const { data, error } = await this.client
      .from("integration_dead_letters")
      .insert({
        retailer_id: args.retailerId,
        connection_id: args.connectionId,
        run_id: args.runId ?? null,
        provider_event_id: args.providerEventId ?? null,
        failure_reason: args.failureReason,
        failure_detail: (args.failureDetail ?? {}) as Json,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toDeadLetter(data);
  }

  async resolveDeadLetter(args: {
    readonly retailerId: RetailerId;
    readonly deadLetterId: string;
    readonly resolution: DeadLetterResolution;
  }): Promise<DeadLetter> {
    const { data, error } = await this.client
      .from("integration_dead_letters")
      .update({
        resolved_at: new Date().toISOString(),
        resolution: args.resolution,
      })
      .eq("id", args.deadLetterId)
      .eq("retailer_id", args.retailerId)
      .select("*")
      .single();
    if (error) throw error;
    return toDeadLetter(data);
  }

  async listUnresolvedDeadLetters(args: {
    readonly retailerId: RetailerId;
    readonly connectionId: string;
    readonly limit?: number;
  }): Promise<readonly DeadLetter[]> {
    const { data, error } = await this.client
      .from("integration_dead_letters")
      .select("*")
      .eq("connection_id", args.connectionId)
      .eq("retailer_id", args.retailerId)
      .is("resolved_at", null)
      .order("first_failed_at", { ascending: false })
      .limit(args.limit ?? 50);
    if (error) throw error;
    return (data ?? []).map(toDeadLetter);
  }

  async recordReconciliationReport(args: {
    readonly retailerId: RetailerId;
    readonly connectionId: string;
    readonly runId?: string;
    readonly resource: string;
    readonly matchedCount: number;
    readonly conflictCount: number;
    readonly staleCount: number;
    readonly deadLetterCount: number;
  }): Promise<ReconciliationReport> {
    const { data, error } = await this.client
      .from("integration_reconciliation_reports")
      .insert({
        retailer_id: args.retailerId,
        connection_id: args.connectionId,
        run_id: args.runId ?? null,
        resource: args.resource,
        matched_count: args.matchedCount,
        conflict_count: args.conflictCount,
        stale_count: args.staleCount,
        dead_letter_count: args.deadLetterCount,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toReconciliationReport(data);
  }

  async listReconciliationReports(args: {
    readonly retailerId: RetailerId;
    readonly connectionId: string;
    readonly limit?: number;
  }): Promise<readonly ReconciliationReport[]> {
    const { data, error } = await this.client
      .from("integration_reconciliation_reports")
      .select("*")
      .eq("connection_id", args.connectionId)
      .eq("retailer_id", args.retailerId)
      .order("generated_at", { ascending: false })
      .limit(args.limit ?? 10);
    if (error) throw error;
    return (data ?? []).map(toReconciliationReport);
  }
}

/** Re-exported for callers that only need the row shape, not the class. */
export type { ConnectionRow as IntegrationConnectionRow };
