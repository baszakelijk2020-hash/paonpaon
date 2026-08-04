import { describe, expect, it } from "vitest";

import { resolveAppSession } from "./session";

describe("resolveAppSession", () => {
  it("resolves a platform session from the platform_role claim", () => {
    const session = resolveAppSession({
      id: "user-1",
      email: "admin@paon.com",
      app_metadata: { platform_role: "platform_admin" },
    });

    expect(session.accountType).toBe("platform");
    expect(session.platformRole).toBe("platform_admin");
    expect(session.retailerId).toBeUndefined();
  });

  it("resolves a retailer_staff session from retailer_id + retailer_role", () => {
    const session = resolveAppSession({
      id: "user-2",
      email: "owner@atelier.com",
      app_metadata: { retailer_id: "retailer-1", retailer_role: "owner" },
    });

    expect(session.accountType).toBe("retailer_staff");
    expect(session.retailerId).toBe("retailer-1");
    expect(session.retailerRole).toBe("owner");
  });

  it("falls back to customer when no elevated claims are present", () => {
    const session = resolveAppSession({
      id: "user-3",
      email: "shopper@example.com",
      app_metadata: {},
    });

    expect(session.accountType).toBe("customer");
    expect(session.platformRole).toBeUndefined();
    expect(session.retailerId).toBeUndefined();
  });

  it("prefers platform over retailer claims if both are somehow present", () => {
    const session = resolveAppSession({
      id: "user-4",
      email: "weird@example.com",
      app_metadata: {
        platform_role: "support_agent",
        retailer_id: "retailer-1",
        retailer_role: "owner",
      },
    });

    expect(session.accountType).toBe("platform");
  });

  it("resolves a corporate_wearer session from the wearer_id claim", () => {
    const session = resolveAppSession({
      id: "user-6",
      email: "wearer@company.com",
      app_metadata: { wearer_id: "wearer-1" },
    });

    expect(session.accountType).toBe("corporate_wearer");
    expect(session.wearerId).toBe("wearer-1");
  });

  it("prefers retailer_staff over the wearer claim if both are somehow present", () => {
    const session = resolveAppSession({
      id: "user-7",
      email: "weird2@example.com",
      app_metadata: {
        retailer_id: "retailer-1",
        retailer_role: "owner",
        wearer_id: "wearer-1",
      },
    });

    expect(session.accountType).toBe("retailer_staff");
  });

  it("defaults email to an empty string when absent", () => {
    const session = resolveAppSession({
      id: "user-5",
      app_metadata: {},
    });

    expect(session.email).toBe("");
  });
});
