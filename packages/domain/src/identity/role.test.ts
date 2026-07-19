import { describe, expect, it } from "vitest";

import { retailerRoleAtLeast } from "./role";

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
