import { describe, expect, it } from "vitest";

import {
  retailerRoleAtLeast,
  retailerRoleHasAlterationsPermission,
} from "./role";

describe("retailerRoleAtLeast", () => {
  it("returns true when the role meets the minimum", () => {
    expect(retailerRoleAtLeast("manager", "sales_associate")).toBe(true);
  });

  it("returns true when the role exactly matches the minimum", () => {
    expect(retailerRoleAtLeast("owner", "owner")).toBe(true);
  });

  it("returns false when the role is below the minimum", () => {
    expect(retailerRoleAtLeast("read_only", "manager")).toBe(false);
  });
});

describe("alterations capabilities", () => {
  it("keeps workshop identities outside the retailer hierarchy", () => {
    expect(retailerRoleAtLeast("workshop_manager", "sales_associate")).toBe(
      false,
    );
    expect(retailerRoleAtLeast("worker", "production_staff")).toBe(false);
  });

  it("gives workers only assigned-task capability", () => {
    expect(
      retailerRoleHasAlterationsPermission("worker", "work_assigned_tasks"),
    ).toBe(true);
    expect(retailerRoleHasAlterationsPermission("worker", "oversight")).toBe(
      false,
    );
    expect(
      retailerRoleHasAlterationsPermission("worker", "approve_pricing"),
    ).toBe(false);
  });

  it("separates workshop proposals from retailer approval", () => {
    expect(
      retailerRoleHasAlterationsPermission(
        "workshop_manager",
        "manage_assigned_workshop",
      ),
    ).toBe(true);
    expect(
      retailerRoleHasAlterationsPermission(
        "workshop_manager",
        "approve_pricing",
      ),
    ).toBe(false);
    expect(
      retailerRoleHasAlterationsPermission("manager", "approve_pricing"),
    ).toBe(true);
  });
});
