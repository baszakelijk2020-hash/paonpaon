import {
  mapShopifyFixtureToStagedRows,
  SHOPIFY_ADAPTER_VERSION,
  type RetailerId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "./client-type";
import { IntegrationLifecycleRepository } from "./repositories/integration-lifecycle-repository";
import { MigrationJobRepository } from "./repositories/migration-job-repository";

export interface ShopifyDeltaSyncResult {
  readonly runId: string;
  readonly jobId: string;
  readonly status: "succeeded" | "failed";
  readonly recordsProcessed: number;
  readonly recordsFailed: number;
  readonly errorSummary?: string;
}

/**
 * Executes one Shopify delta sync cycle for a connection (PHASE 9.2): runs
 * the current documented delta through 9.1's actual staged-file pipeline
 * (dry-run → publish → canonical tables), the same path a human-operated
 * migration uses, then records the cycle as a sync run and advances the
 * connection's cursor.
 *
 * The delta itself (`mapShopifyFixtureToStagedRows`) is fixture data, not a
 * live Shopify Admin API call — 9.2's non-goal is explicit that this must
 * never become an undocumented-endpoint or browser-automation connector.
 * Live credentials would replace only the fetch step; everything from
 * staging onward is already the real pipeline. This is what makes "an
 * operator can configure a local/mock connection and run initial plus delta
 * ingest" (9.2's acceptance) true today rather than aspirational.
 */
export async function orchestrateShopifyDeltaSync(
  admin: PaonSupabaseClient,
  args: {
    readonly retailerId: RetailerId;
    readonly connectionId: string;
    readonly triggerKind?: "scheduled" | "manual";
  },
): Promise<ShopifyDeltaSyncResult> {
  const lifecycle = new IntegrationLifecycleRepository(admin);
  const migrations = new MigrationJobRepository(admin);

  const acceptsIngest = await lifecycle.connectionAcceptsIngestNow({
    retailerId: args.retailerId,
    connectionId: args.connectionId,
  });

  const run = await lifecycle.startSyncRun({
    retailerId: args.retailerId,
    connectionId: args.connectionId,
    triggerKind: args.triggerKind ?? "scheduled",
  });

  if (!acceptsIngest) {
    await lifecycle.recordDeadLetter({
      retailerId: args.retailerId,
      connectionId: args.connectionId,
      runId: run.id,
      failureReason: "downstream_error",
      failureDetail: { reason: "connection_not_active" },
    });
    await lifecycle.finishSyncRun({
      retailerId: args.retailerId,
      runId: run.id,
      status: "failed",
      recordsProcessed: 0,
      recordsFailed: 1,
      errorSummary: "connection is not active",
    });
    return {
      runId: run.id,
      jobId: "",
      status: "failed",
      recordsProcessed: 0,
      recordsFailed: 1,
      errorSummary: "connection is not active",
    };
  }

  const rows = mapShopifyFixtureToStagedRows();

  try {
    const job = await migrations.createJobFromRows({
      retailerId: args.retailerId,
      displayName: `Shopify delta sync (${SHOPIFY_ADAPTER_VERSION})`,
      rows,
    });
    const published = await migrations.publishJob({
      retailerId: args.retailerId,
      jobId: job.id,
    });

    await lifecycle.upsertSyncCursor({
      retailerId: args.retailerId,
      connectionId: args.connectionId,
      resource: "shopify-delta",
      cursorValue: {
        lastJobId: published.id,
        lastSyncedRowCount: rows.length,
        adapterVersion: SHOPIFY_ADAPTER_VERSION,
      },
    });

    await lifecycle.finishSyncRun({
      retailerId: args.retailerId,
      runId: run.id,
      status: "succeeded",
      recordsProcessed: rows.length,
      recordsFailed: 0,
    });

    // Record reconciliation report per resource type (entityKind)
    const resourceCounts = new Map<string, number>();
    for (const row of rows) {
      const count = resourceCounts.get(row.entityKind) ?? 0;
      resourceCounts.set(row.entityKind, count + 1);
    }
    for (const [resource, count] of resourceCounts) {
      await lifecycle.recordReconciliationReport({
        retailerId: args.retailerId,
        connectionId: args.connectionId,
        runId: run.id,
        resource,
        matchedCount: count,
        conflictCount: 0,
        staleCount: 0,
        deadLetterCount: 0,
      });
    }

    return {
      runId: run.id,
      jobId: published.id,
      status: "succeeded",
      recordsProcessed: rows.length,
      recordsFailed: 0,
    };
  } catch (error) {
    const errorSummary =
      error instanceof Error ? error.message : "unknown Shopify sync failure";
    await lifecycle.recordDeadLetter({
      retailerId: args.retailerId,
      connectionId: args.connectionId,
      runId: run.id,
      failureReason: "downstream_error",
      failureDetail: { reason: errorSummary },
    });
    await lifecycle.finishSyncRun({
      retailerId: args.retailerId,
      runId: run.id,
      status: "failed",
      recordsProcessed: 0,
      recordsFailed: rows.length,
      errorSummary,
    });
    return {
      runId: run.id,
      jobId: "",
      status: "failed",
      recordsProcessed: 0,
      recordsFailed: rows.length,
      errorSummary,
    };
  }
}
