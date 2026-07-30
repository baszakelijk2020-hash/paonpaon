import { describe, expect, it } from "vitest";

import { buildMigrationDryRunReport } from "../migration/staged-file-migration";
import { asId } from "../shared/branded-id";

import {
  buildFadenWebhookFixtureEnvelope,
  mapShopifyFixtureToStagedRows,
  planFadenWebhookIngestFromFixture,
  verifyFadenWebhookFixture,
} from "./provider-adapters";
import type { SourceAuthorityPolicy } from "./source-authority";

const retailerId = asId<"RetailerId">("11111111-1111-4111-8111-111111111111");

const policy: SourceAuthorityPolicy = {
  id: "pol-1",
  retailerId,
  connectionId: "conn-1",
  domain: "order",
  fieldGroup: "order.status",
  authority: "external",
  allowedDirections: ["ingest"],
  mappingVersion: "faden-webhook-adapter-v1",
  createdAt: "2026-07-30T11:00:00.000Z",
  updatedAt: "2026-07-30T11:00:00.000Z",
};

describe("provider adapters (9.2)", () => {
  it("maps Shopify fixture deltas into staged migration rows", () => {
    const rows = mapShopifyFixtureToStagedRows();
    const report = buildMigrationDryRunReport(rows);
    expect(report.counts.customer).toBe(1);
    expect(report.counts.product).toBe(1);
    expect(report.counts.stock).toBe(1);
    expect(report.counts.order).toBe(1);
    expect(report.expectedOrderMoneyMinor).toBe(52000);
  });

  it("verifies Faden fixture webhook signatures and rejects replay tampering", () => {
    const envelope = buildFadenWebhookFixtureEnvelope();
    expect(verifyFadenWebhookFixture(envelope)).toBe(true);
    expect(
      verifyFadenWebhookFixture({
        ...envelope,
        signature: "sha256:tampered",
      }),
    ).toBe(false);
  });

  it("plans Faden read-only ingest with deep-link and no write-back", () => {
    const planned = planFadenWebhookIngestFromFixture({
      retailerId,
      connectionId: "conn-1",
      policy,
      canonicalOrderId: "cccccccc-cccc-4ccc-8ccc-000000000001",
    });
    expect(planned.ok).toBe(true);
    expect(planned.writeBackClaimed).toBe(false);
    expect(planned.deepLink?.url).toContain("FAD-ORD-2002");
  });
});
