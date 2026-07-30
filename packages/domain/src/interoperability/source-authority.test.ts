import { describe, expect, it } from "vitest";

import {
  assertWritePermitted,
  detectStaleSource,
  reconcileExternalIdentity,
  summarizeConnectionHealth,
} from "./source-authority";

describe("assertWritePermitted", () => {
  it("blocks write_api when authority is external", () => {
    const result = assertWritePermitted({
      authorityMode: "external",
      direction: "write_api",
      allowedDirections: ["ingest", "write_api"],
      fieldGroup: "order_status",
      domain: "production",
    });
    expect(result.permitted).toBe(false);
    expect(result.reason).toContain("deep-link handoff");
  });

  it("allows ingest for co_managed production status", () => {
    const result = assertWritePermitted({
      authorityMode: "co_managed",
      direction: "ingest",
      allowedDirections: ["ingest"],
      fieldGroup: "order_status",
      domain: "production",
    });
    expect(result.permitted).toBe(true);
  });
});

describe("detectStaleSource", () => {
  it("returns true when incoming version is older", () => {
    expect(
      detectStaleSource({
        incomingExternalVersion: "2",
        lastSeenExternalVersion: "3",
      }),
    ).toBe(true);
  });

  it("returns false for first observation", () => {
    expect(
      detectStaleSource({
        incomingExternalVersion: "1",
      }),
    ).toBe(false);
  });
});

describe("reconcileExternalIdentity", () => {
  it("creates pending state for first observation", () => {
    expect(
      reconcileExternalIdentity({
        incoming: {
          canonicalId: "11111111-1111-1111-1111-111111111111",
          externalVersion: "1",
          mappingVersion: "faden-readonly-v1",
        },
      }),
    ).toEqual({ state: "pending", shouldUpdate: true });
  });

  it("fails visibly when canonical id conflicts under same external key", () => {
    const result = reconcileExternalIdentity({
      existing: {
        canonicalId: "11111111-1111-1111-1111-111111111111",
        externalVersion: "2",
        mappingVersion: "faden-readonly-v1",
      },
      incoming: {
        canonicalId: "22222222-2222-2222-2222-222222222222",
        externalVersion: "2",
        mappingVersion: "faden-readonly-v1",
      },
    });
    expect(result.state).toBe("conflict");
    expect(result.shouldUpdate).toBe(false);
    expect(result.conflictReason).toContain("already maps");
  });

  it("marks stale versions without updating", () => {
    const result = reconcileExternalIdentity({
      existing: {
        canonicalId: "11111111-1111-1111-1111-111111111111",
        externalVersion: "3",
        mappingVersion: "faden-readonly-v1",
      },
      incoming: {
        canonicalId: "11111111-1111-1111-1111-111111111111",
        externalVersion: "2",
        mappingVersion: "faden-readonly-v1",
      },
    });
    expect(result.state).toBe("stale");
    expect(result.shouldUpdate).toBe(false);
  });
});

describe("summarizeConnectionHealth", () => {
  it("reports degraded when conflicts are open", () => {
    expect(
      summarizeConnectionHealth({
        status: "active",
        openConflictCount: 2,
        fixtureMode: true,
      }),
    ).toBe("degraded");
  });
});
