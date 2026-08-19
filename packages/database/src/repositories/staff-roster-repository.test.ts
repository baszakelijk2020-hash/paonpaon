import { asId } from "@paon/domain";
import type { StaffTimeEntry } from "@paon/domain";
import { describe, expect, it } from "vitest";

import { totalHours } from "./staff-roster-repository";

const RETAILER_ID = asId<"RetailerId">("11111111-1111-4111-8111-111111111111");
const STAFF_ID = asId<"StaffId">("22222222-2222-4222-8222-222222222222");

function entry(clockInAt: string, clockOutAt?: string): StaffTimeEntry {
  return {
    id: asId<"StaffTimeEntryId">("33333333-3333-4333-8333-333333333333"),
    retailerId: RETAILER_ID,
    staffId: STAFF_ID,
    clockInAt,
    ...(clockOutAt ? { clockOutAt } : {}),
    createdAt: clockInAt,
    updatedAt: clockOutAt ?? clockInAt,
    deletedAt: null,
  };
}

describe("totalHours", () => {
  it("sums a single closed entry's clocked duration", () => {
    const hours = totalHours([
      entry("2026-08-06T09:00:00.000Z", "2026-08-06T12:00:00.000Z"),
    ]);
    expect(hours).toBe(3);
  });

  it("sums multiple closed entries across a day", () => {
    const hours = totalHours([
      entry("2026-08-06T09:00:00.000Z", "2026-08-06T12:00:00.000Z"),
      entry("2026-08-06T13:00:00.000Z", "2026-08-06T17:30:00.000Z"),
    ]);
    expect(hours).toBeCloseTo(7.5, 5);
  });

  it("does not count a still-open entry (no clock-out) as any hours", () => {
    const hours = totalHours([entry("2026-08-06T09:00:00.000Z")]);
    expect(hours).toBe(0);
  });

  it("ignores an open entry while still summing closed ones", () => {
    const hours = totalHours([
      entry("2026-08-06T09:00:00.000Z", "2026-08-06T11:00:00.000Z"),
      entry("2026-08-06T14:00:00.000Z"),
    ]);
    expect(hours).toBe(2);
  });

  it("returns 0 for no entries", () => {
    expect(totalHours([])).toBe(0);
  });
});
