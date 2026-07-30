import { describe, expect, it } from "vitest";

import { asId } from "../shared/branded-id";

import {
  branchLocalDayUtcBounds,
  findBranchCoverageGaps,
  formatInstantInBranchTimezone,
  isValidIanaTimezone,
  validateBranchCalendarEntryDraft,
} from "./branch-calendar";

const branchId = asId<"BranchId">("aaaaaaaa-aaaa-4aaa-8aaa-000000000001");
const customerId = asId<"CustomerId">("33333333-3333-4333-8333-333333333333");
const staffId = asId<"StaffId">("44444444-4444-4444-8444-444444444444");

describe("branch calendar", () => {
  it("accepts valid IANA timezones and rejects unknown zones", () => {
    expect(isValidIanaTimezone("America/New_York")).toBe(true);
    expect(isValidIanaTimezone("Europe/Amsterdam")).toBe(true);
    expect(isValidIanaTimezone("Not/AZone")).toBe(false);
  });

  it("formats instants in branch-local time honestly", () => {
    const formatted = formatInstantInBranchTimezone({
      instant: "2026-07-30T16:00:00.000Z",
      timezone: "America/New_York",
      locale: "en-US",
    });
    expect(formatted).toMatch(/Jul/);
    expect(formatted.length).toBeGreaterThan(5);
  });

  it("derives UTC bounds for a branch-local calendar day", () => {
    const bounds = branchLocalDayUtcBounds({
      localDate: "2026-07-30",
      timezone: "UTC",
    });
    expect(bounds.startUtc).toBe("2026-07-30T00:00:00.000Z");
    expect(bounds.endUtc).toBe("2026-07-30T23:59:59.999Z");
  });

  it("requires customer for recurring moments and staff for coverage", () => {
    expect(
      validateBranchCalendarEntryDraft({
        entryType: "recurring_moment",
        startsAt: "2026-07-30T10:00:00.000Z",
        endsAt: "2026-07-30T11:00:00.000Z",
        assignedStaffIds: [],
      }).errors,
    ).toContain("recurring_moment_requires_customer");

    expect(
      validateBranchCalendarEntryDraft({
        entryType: "coverage",
        startsAt: "2026-07-30T10:00:00.000Z",
        endsAt: "2026-07-30T18:00:00.000Z",
        assignedStaffIds: [],
      }).errors,
    ).toContain("coverage_requires_staff");

    expect(
      validateBranchCalendarEntryDraft({
        entryType: "recurring_moment",
        startsAt: "2026-07-30T10:00:00.000Z",
        endsAt: "2026-07-30T11:00:00.000Z",
        customerId,
        assignedStaffIds: [staffId],
      }).ok,
    ).toBe(true);
  });

  it("finds coverage gaps when no staff are assigned", () => {
    const gaps = findBranchCoverageGaps({
      branchId,
      entries: [
        {
          branchId,
          entryType: "coverage",
          startsAt: "2026-07-30T09:00:00.000Z",
          endsAt: "2026-07-30T17:00:00.000Z",
          title: "Saturday floor",
          assignedStaffIds: [],
        },
        {
          branchId,
          entryType: "coverage",
          startsAt: "2026-07-31T09:00:00.000Z",
          endsAt: "2026-07-31T17:00:00.000Z",
          title: "Covered shift",
          assignedStaffIds: [staffId],
        },
      ],
    });
    expect(gaps).toHaveLength(1);
    expect(gaps[0]?.title).toBe("Saturday floor");
  });
});
