import { asId } from "@paon/domain";
import { describe, expect, it, vi } from "vitest";

import {
  activateCampaignToStaffMissions,
  rehearseCampaignActivation,
} from "./campaign-activation-orchestrator";
import type { PaonSupabaseClient } from "./client-type";

const retailerId = asId<"RetailerId">("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
const campaignId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function createBuilder(resolve: () => { data: unknown; error: null }) {
  const builder: Record<string, unknown> = {};
  const self = new Proxy(builder, {
    get(target, prop) {
      if (prop === "then") {
        return (onFulfilled: (v: unknown) => unknown) =>
          Promise.resolve(resolve()).then(onFulfilled);
      }
      if (!(prop in target)) {
        target[prop as string] = vi.fn(() => self);
      }
      return target[prop as string];
    },
  });
  return self;
}

/**
 * A retailer with zero portal customers is the simplest real case the
 * gatherCandidates fan-out can hit — it proves the whole audience/consent/
 * style-profile/contact-pressure chain resolves cleanly to an empty
 * rehearsal report instead of hanging or throwing on an empty list, without
 * needing to mock every per-customer repository call this orchestrator
 * fans out to (already covered at the pure-logic level by
 * evaluateCampaignRehearsal's own tests).
 */
function createEmptyRetailerClient() {
  const from = vi.fn((table: string) => {
    if (table === "customers") {
      return createBuilder(() => ({ data: [], error: null }));
    }
    if (table === "campaign_audience_rules") {
      return createBuilder(() => ({ data: [], error: null }));
    }
    return createBuilder(() => ({ data: [], error: null }));
  });
  return { from } as unknown as PaonSupabaseClient;
}

describe("rehearseCampaignActivation", () => {
  it("returns an empty report for a retailer with no portal customers", async () => {
    const client = createEmptyRetailerClient();
    const report = await rehearseCampaignActivation(client, {
      retailerId,
      campaignId,
      now: "2026-08-01T00:00:00.000Z",
    });
    expect(report).toEqual({
      eligibleCount: 0,
      excludedCount: 0,
      contactPressureCount: 0,
      outcomes: [],
    });
  });
});

describe("activateCampaignToStaffMissions", () => {
  it("creates zero missions and still returns the rehearsal report when nobody is eligible", async () => {
    const client = createEmptyRetailerClient();
    const result = await activateCampaignToStaffMissions(client, {
      retailerId,
      campaignId,
      campaignTitle: "Member Fabric Preview",
      staffMission: "Invite to preview the new fabric collection in-store.",
      now: "2026-08-01T00:00:00.000Z",
    });
    expect(result.missionsCreated).toBe(0);
    expect(result.report.eligibleCount).toBe(0);
  });
});
