import { describe, expect, it } from "vitest";

import { asId } from "../shared/branded-id";

import {
  canStaffAccessCustomerRelationshipData,
  isCustomerAssignedToStaff,
  isManagementRole,
  maskEmail,
  maskPhone,
} from "./customer-access";

const staffA = asId<"StaffId">("11111111-1111-1111-1111-111111111111");
const staffB = asId<"StaffId">("22222222-2222-2222-2222-222222222222");

describe("maskPhone", () => {
  it("keeps the country code and last 3 digits, masks the rest", () => {
    expect(maskPhone("+84 91 234 5238")).toBe("+84 ••• ••• 238");
  });
  it("does not leak length when digit count varies", () => {
    expect(maskPhone("+1 5551234")).toBe("+1 ••• ••• 234");
    expect(maskPhone("+44 20 7946 0958")).toBe("+44 ••• ••• 958");
  });
});

describe("maskEmail", () => {
  it("keeps the first character and full domain, masks the rest of the local part", () => {
    expect(maskEmail("jane@company.com")).toBe("j••••@company.com");
  });
  it("does not leak the real local-part length", () => {
    expect(maskEmail("j@company.com")).toBe("j••••@company.com");
    expect(maskEmail("jonathan@company.com")).toBe("j••••@company.com");
  });
});

describe("isCustomerAssignedToStaff", () => {
  it("matches only the exact assigned staff id", () => {
    expect(isCustomerAssignedToStaff({ assignedStaffId: staffA }, staffA)).toBe(
      true,
    );
    expect(isCustomerAssignedToStaff({ assignedStaffId: staffA }, staffB)).toBe(
      false,
    );
    expect(isCustomerAssignedToStaff({}, staffA)).toBe(false);
  });
});

describe("canStaffAccessCustomerRelationshipData", () => {
  it("grants management roles regardless of assignment", () => {
    expect(
      canStaffAccessCustomerRelationshipData(
        "manager",
        { assignedStaffId: staffB },
        staffA,
      ),
    ).toBe(true);
  });
  it("grants the assigned advisor", () => {
    expect(
      canStaffAccessCustomerRelationshipData(
        "sales_associate",
        { assignedStaffId: staffA },
        staffA,
      ),
    ).toBe(true);
  });
  it("denies an unassigned non-management staff member", () => {
    expect(
      canStaffAccessCustomerRelationshipData(
        "sales_associate",
        { assignedStaffId: staffB },
        staffA,
      ),
    ).toBe(false);
  });
  it("denies a staff member with no resolvable staff id", () => {
    expect(
      canStaffAccessCustomerRelationshipData("sales_associate", {}, undefined),
    ).toBe(false);
  });
});

describe("isManagementRole", () => {
  it("matches owner/admin/manager only", () => {
    expect(isManagementRole("owner")).toBe(true);
    expect(isManagementRole("admin")).toBe(true);
    expect(isManagementRole("manager")).toBe(true);
    expect(isManagementRole("sales_associate")).toBe(false);
    expect(isManagementRole("read_only")).toBe(false);
  });
});
