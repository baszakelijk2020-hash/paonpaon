import { asId } from "@paon/domain";
import { describe, expect, it, vi } from "vitest";

import { orchestrateIntegrationScheduledSyncs } from "./integration-scheduled-sync-orchestrator";
import { IntegrationLifecycleRepository } from "./repositories/integration-lifecycle-repository";
import * as shopifyOrchestrator from "./shopify-delta-sync-orchestrator";

const retailerId = asId<"RetailerId">("11111111-1111-1111-1111-111111111111");
const connectionA = "22222222-2222-2222-2222-222222222222";
const connectionB = "33333333-3333-3333-3333-333333333333";

describe("orchestrateIntegrationScheduledSyncs", () => {
  it("runs scheduled Shopify sync for every active connection", async () => {
    const listSpy = vi
      .spyOn(
        IntegrationLifecycleRepository.prototype,
        "listActiveShopifyConnectionsForScheduledSync",
      )
      .mockResolvedValue([
        { retailerId, connectionId: connectionA },
        { retailerId, connectionId: connectionB },
      ]);

    const syncSpy = vi
      .spyOn(shopifyOrchestrator, "orchestrateShopifyDeltaSync")
      .mockResolvedValueOnce({
        runId: "run-a",
        jobId: "job-a",
        status: "succeeded",
        recordsProcessed: 3,
        recordsFailed: 0,
      })
      .mockResolvedValueOnce({
        runId: "run-b",
        jobId: "",
        status: "failed",
        recordsProcessed: 0,
        recordsFailed: 1,
        errorSummary: "connection is not active",
      });

    const result = await orchestrateIntegrationScheduledSyncs({} as never);

    expect(result).toEqual({
      considered: 2,
      succeeded: 1,
      failed: 1,
      skipped: 0,
    });
    expect(syncSpy).toHaveBeenCalledTimes(2);
    expect(syncSpy).toHaveBeenNthCalledWith(
      1,
      {},
      {
        retailerId,
        connectionId: connectionA,
        triggerKind: "scheduled",
      },
    );
    expect(syncSpy).toHaveBeenNthCalledWith(
      2,
      {},
      {
        retailerId,
        connectionId: connectionB,
        triggerKind: "scheduled",
      },
    );

    listSpy.mockRestore();
    syncSpy.mockRestore();
  });

  it("returns zero counts when no active Shopify connections exist", async () => {
    const listSpy = vi
      .spyOn(
        IntegrationLifecycleRepository.prototype,
        "listActiveShopifyConnectionsForScheduledSync",
      )
      .mockResolvedValue([]);

    const syncSpy = vi.spyOn(
      shopifyOrchestrator,
      "orchestrateShopifyDeltaSync",
    );

    const result = await orchestrateIntegrationScheduledSyncs({} as never);

    expect(result).toEqual({
      considered: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
    });
    expect(syncSpy).not.toHaveBeenCalled();

    listSpy.mockRestore();
    syncSpy.mockRestore();
  });
});
