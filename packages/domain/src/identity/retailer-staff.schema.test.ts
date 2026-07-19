import { describe, expect, it } from "vitest";

import { inviteRetailerStaffInputSchema } from "./retailer-staff.schema";

describe("inviteRetailerStaffInputSchema", () => {
  it("accepts a valid payload and normalizes email casing", () => {
    const result = inviteRetailerStaffInputSchema.parse({
      fullName: "Sam Sales",
      email: "Sam@Atelier.com",
      role: "sales_associate",
    });
    expect(result.email).toBe("sam@atelier.com");
  });

  it("rejects an unknown role", () => {
    const result = inviteRetailerStaffInputSchema.safeParse({
      fullName: "Sam Sales",
      email: "sam@atelier.com",
      role: "ceo",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing full name", () => {
    const result = inviteRetailerStaffInputSchema.safeParse({
      fullName: "",
      email: "sam@atelier.com",
      role: "sales_associate",
    });
    expect(result.success).toBe(false);
  });

  it("requires a workshop scope for workshop identities", () => {
    expect(
      inviteRetailerStaffInputSchema.safeParse({
        fullName: "Tailor One",
        email: "tailor@example.com",
        role: "worker",
      }).success,
    ).toBe(false);
    expect(
      inviteRetailerStaffInputSchema.safeParse({
        fullName: "Tailor One",
        email: "tailor@example.com",
        role: "worker",
        workshopId: "11111111-1111-1111-1111-111111111111",
      }).success,
    ).toBe(true);
  });
});
