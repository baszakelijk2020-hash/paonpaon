import { describe, expect, it } from "vitest";

import { asId } from "../shared/branded-id";

import {
  buildFadenFixtureIngestInput,
  FADEN_READ_ONLY_ORDER_WEBHOOK_FIXTURE,
} from "./faden-readonly-fixture";
import {
  buildFadenDeepLinkHandoff,
  evaluateSourceAuthorityAction,
  planFadenReadOnlyIngest,
  type SourceAuthorityPolicy,
} from "./source-authority";

const retailerId = asId<"RetailerId">("11111111-1111-4111-8111-111111111111");
const now = "2026-07-30T12:00:00.000Z";

function policy(
  overrides: Partial<SourceAuthorityPolicy> = {},
): SourceAuthorityPolicy {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000001",
    retailerId,
    connectionId: "bbbbbbbb-bbbb-4bbb-8bbb-000000000001",
    domain: "order",
    fieldGroup: "order.status",
    authority: "external",
    allowedDirections: ["ingest"],
    mappingVersion: "faden-order-v1",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("source authority", () => {
  it("rejects write-back when write_api is not allowed", () => {
    const result = evaluateSourceAuthorityAction({
      policy: policy(),
      direction: "write_api",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.conflict.code).toBe("write_api_not_allowed");
  });

  it("rejects ingest that would overwrite PAON-owned fields", () => {
    const result = evaluateSourceAuthorityAction({
      policy: policy({ authority: "paon" }),
      direction: "ingest",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.conflict.code).toBe("authority_conflict");
  });

  it("fails visibly on stale external versions", () => {
    const result = evaluateSourceAuthorityAction({
      policy: policy(),
      direction: "ingest",
      externalUpdatedAt: "2026-07-01T00:00:00.000Z",
      knownExternalUpdatedAt: "2026-07-15T00:00:00.000Z",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.conflict.code).toBe("stale_source");
  });

  it("plans Faden read-only ingest with deep-link and no write-back claim", () => {
    const planned = planFadenReadOnlyIngest({
      retailerId,
      connectionId: "bbbbbbbb-bbbb-4bbb-8bbb-000000000001",
      providerEventId: "evt_100",
      payloadHash: "sha256:abc",
      receivedAt: now,
      mappingVersion: "faden-order-v1",
      externalObjectType: "order",
      externalId: "FAD-ORDER-9",
      externalUpdatedAt: now,
      canonicalObjectType: "order",
      canonicalId: "cccccccc-cccc-4ccc-8ccc-000000000001",
      policy: policy(),
      deepLinkBaseUrl: "https://app.faden.example",
    });
    expect(planned.ok).toBe(true);
    expect(planned.writeBackClaimed).toBe(false);
    expect(planned.deepLink?.url).toBe(
      "https://app.faden.example/orders/FAD-ORDER-9",
    );
    expect(planned.deepLink?.writeBackClaimed).toBe(false);
  });

  it("builds deep-link handoff that never claims write-back", () => {
    const handoff = buildFadenDeepLinkHandoff({
      connectionId: "bbbbbbbb-bbbb-4bbb-8bbb-000000000001",
      deepLinkBaseUrl: "https://app.faden.example/",
      externalObjectType: "client",
      externalId: "CL-42",
    });
    expect(handoff.writeBackClaimed).toBe(false);
    expect(handoff.url).toContain("/clients/CL-42");
  });

  it("exercises the Faden read-only fixture without write-back", () => {
    const input = buildFadenFixtureIngestInput({
      retailerId,
      connectionId: "bbbbbbbb-bbbb-4bbb-8bbb-000000000001",
      canonicalOrderId: "cccccccc-cccc-4ccc-8ccc-000000000001",
    });
    const planned = planFadenReadOnlyIngest(input);
    expect(planned.ok).toBe(true);
    expect(planned.writeBackClaimed).toBe(false);
    expect(planned.deepLink?.url).toContain(
      FADEN_READ_ONLY_ORDER_WEBHOOK_FIXTURE.order.externalId,
    );
  });
});
