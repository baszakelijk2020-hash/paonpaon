import { describe, expect, it } from "vitest";

import { asId } from "../shared/branded-id";

import {
  buildFadenFixtureIngestPlan,
  buildFadenOrderDeepLink,
  FADEN_FIXTURE_EXTERNAL_ORDER_ID,
  FADEN_FIXTURE_ORDER,
} from "./faden-fixture";

const retailerId = asId<"RetailerId">("11111111-1111-1111-1111-111111111111");
const connectionId = asId<"SourceConnectionId">(
  "22222222-2222-2222-2222-222222222222",
);

describe("Faden fixture", () => {
  it("builds a deep link without write-back", () => {
    expect(buildFadenOrderDeepLink(FADEN_FIXTURE_EXTERNAL_ORDER_ID)).toBe(
      "https://app.faden.tech/orders/FAD-ORD-10042",
    );
  });

  it("plans read-only ingest with matched reconciliation on first run", () => {
    const plan = buildFadenFixtureIngestPlan({
      retailerId,
      connectionId,
    });
    expect(plan.writeBackPermitted).toBe(false);
    expect(plan.reconciliation.state).toBe("pending");
    expect(plan.rawPayload.order).toEqual(FADEN_FIXTURE_ORDER);
    expect(plan.deepLinkUrl).toContain("FAD-ORD-10042");
  });

  it("surfaces conflict when remapping canonical id", () => {
    const plan = buildFadenFixtureIngestPlan({
      retailerId,
      connectionId,
      existingIdentity: {
        canonicalId: "33333333-3333-3333-3333-333333333333",
        externalVersion: "3",
        mappingVersion: "faden-readonly-v1",
      },
      canonicalOrderId: "44444444-4444-4444-4444-444444444444",
    });
    expect(plan.reconciliation.state).toBe("conflict");
    expect(plan.reconciliation.shouldUpdate).toBe(false);
  });
});
