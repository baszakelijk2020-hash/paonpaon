import { asId, type RetailerId } from "@paon/domain";

import type { PaonSupabaseClient } from "./client-type";
import { IntegrationLifecycleRepository } from "./repositories/integration-lifecycle-repository";
import { orchestrateShopifyDeltaSync } from "./shopify-delta-sync-orchestrator";

export interface IntegrationScheduledSyncConnection {
  readonly retailerId: RetailerId;
  readonly connectionId: string;
}

export interface IntegrationScheduledSyncResult {
  readonly considered: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly skipped: number;
}

/**
 * Runs scheduled Shopify delta sync for every active connection (PHASE 9.2).
 * Faden ingest remains webhook-triggered via `/api/webhooks/faden/[connectionId]`.
 */
export async function orchestrateIntegrationScheduledSyncs(
  admin: PaonSupabaseClient,
): Promise<IntegrationScheduledSyncResult> {
  const lifecycle = new IntegrationLifecycleRepository(admin);
  const connections =
    await lifecycle.listActiveShopifyConnectionsForScheduledSync();

  let succeeded = 0;
  let failed = 0;

  for (const connection of connections) {
    const result = await orchestrateShopifyDeltaSync(admin, {
      retailerId: connection.retailerId,
      connectionId: connection.connectionId,
      triggerKind: "scheduled",
    });
    if (result.status === "succeeded") {
      succeeded += 1;
    } else {
      failed += 1;
    }
  }

  return {
    considered: connections.length,
    succeeded,
    failed,
    skipped: 0,
  };
}

/** Exported for unit tests that stub connection discovery. */
export function mapScheduledSyncConnections(
  rows: readonly { readonly retailer_id: string; readonly id: string }[],
): readonly IntegrationScheduledSyncConnection[] {
  return rows.map((row) => ({
    retailerId: asId<"RetailerId">(row.retailer_id),
    connectionId: row.id,
  }));
}
