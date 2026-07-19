import { describe, expect, it } from "vitest";

import {
  ForbiddenError,
  UnauthorizedError,
  requireCustomerSession,
  requireAlterationsPermission,
  requirePlatformOperator,
  requirePlatformSession,
  requireRetailerRole,
  requireRetailerSession,
} from "./guards";
import type { AppSession } from "./session";

function platformSession(role: AppSession["platformRole"]): AppSession {
  return {
    userId: "user-1",
    email: "a@paon.com",
    accountType: "platform",
    platformRole: role,
  } as unknown as AppSession;
}

function retailerSession(role: AppSession["retailerRole"]): AppSession {
  return {
    userId: "user-2",
    email: "a@atelier.com",
    accountType: "retailer_staff",
    retailerId: "retailer-1",
    retailerRole: role,
  } as unknown as AppSession;
}

function customerSession(): AppSession {
  return {
    userId: "user-3",
    email: "a@shopper.com",
    accountType: "customer",
  } as unknown as AppSession;
}

describe("requireRetailerRole", () => {
  it("passes when the role meets the minimum", () => {
    expect(() =>
      requireRetailerRole("manager", "sales_associate"),
    ).not.toThrow();
  });

  it("throws UnauthorizedError when role is undefined", () => {
    expect(() => requireRetailerRole(undefined, "manager")).toThrow(
      UnauthorizedError,
    );
  });

  it("throws ForbiddenError when role is below the minimum", () => {
    expect(() => requireRetailerRole("read_only", "manager")).toThrow(
      ForbiddenError,
    );
  });
});

describe("requireAlterationsPermission", () => {
  it("allows only the bounded workshop capability", () => {
    expect(() =>
      requireAlterationsPermission(
        "workshop_manager",
        "manage_assigned_workshop",
      ),
    ).not.toThrow();
    expect(() =>
      requireAlterationsPermission("workshop_manager", "configure"),
    ).toThrow(ForbiddenError);
  });

  it("keeps workers out of intake and oversight", () => {
    expect(() =>
      requireAlterationsPermission("worker", "work_assigned_tasks"),
    ).not.toThrow();
    expect(() => requireAlterationsPermission("worker", "intake")).toThrow(
      ForbiddenError,
    );
  });
});

describe("requirePlatformSession", () => {
  it("passes for any platform session", () => {
    expect(() =>
      requirePlatformSession(platformSession("support_agent")),
    ).not.toThrow();
  });

  it("throws UnauthorizedError for a null session", () => {
    expect(() => requirePlatformSession(null)).toThrow(UnauthorizedError);
  });

  it("throws ForbiddenError for a non-platform session", () => {
    expect(() => requirePlatformSession(retailerSession("owner"))).toThrow(
      ForbiddenError,
    );
  });
});

describe("requirePlatformOperator", () => {
  it("passes for platform_owner and platform_admin", () => {
    expect(() =>
      requirePlatformOperator(platformSession("platform_owner")),
    ).not.toThrow();
    expect(() =>
      requirePlatformOperator(platformSession("platform_admin")),
    ).not.toThrow();
  });

  it("throws ForbiddenError for support_agent", () => {
    expect(() =>
      requirePlatformOperator(platformSession("support_agent")),
    ).toThrow(ForbiddenError);
  });
});

describe("requireRetailerSession", () => {
  it("passes for a retailer_staff session", () => {
    expect(() =>
      requireRetailerSession(retailerSession("manager")),
    ).not.toThrow();
  });

  it("throws ForbiddenError for a platform session", () => {
    expect(() =>
      requireRetailerSession(platformSession("platform_admin")),
    ).toThrow(ForbiddenError);
  });

  it("throws UnauthorizedError for a null session", () => {
    expect(() => requireRetailerSession(null)).toThrow(UnauthorizedError);
  });
});

describe("requireCustomerSession", () => {
  it("passes for a customer session, even with no linked customer records", () => {
    expect(() => requireCustomerSession(customerSession())).not.toThrow();
  });

  it("throws ForbiddenError for a retailer_staff session", () => {
    expect(() => requireCustomerSession(retailerSession("owner"))).toThrow(
      ForbiddenError,
    );
  });

  it("throws ForbiddenError for a platform session", () => {
    expect(() =>
      requireCustomerSession(platformSession("platform_admin")),
    ).toThrow(ForbiddenError);
  });

  it("throws UnauthorizedError for a null session", () => {
    expect(() => requireCustomerSession(null)).toThrow(UnauthorizedError);
  });
});
