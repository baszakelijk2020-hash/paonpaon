import { describe, expect, it } from "vitest";

import {
  buildChecksummedPayrollExport,
  detectPayrollExceptions,
  detectPayrollScheduleExceptions,
  summarizePeriodHours,
} from "./payroll-period";

describe("detectPayrollExceptions", () => {
  it("does not flag a normal completed shift", () => {
    const exceptions = detectPayrollExceptions({
      entries: [
        {
          staffId: "staff-1",
          clockInAt: "2026-08-01T09:00:00.000Z",
          clockOutAt: "2026-08-01T17:00:00.000Z",
        },
      ],
      now: "2026-08-01T18:00:00.000Z",
    });
    expect(exceptions).toEqual([]);
  });

  it("does not flag a shift still reasonably in progress", () => {
    const exceptions = detectPayrollExceptions({
      entries: [{ staffId: "staff-1", clockInAt: "2026-08-01T09:00:00.000Z" }],
      now: "2026-08-01T13:00:00.000Z",
    });
    expect(exceptions).toEqual([]);
  });

  it("flags a clock-in with no clock-out well past a normal shift length", () => {
    const exceptions = detectPayrollExceptions({
      entries: [{ staffId: "staff-1", clockInAt: "2026-08-01T09:00:00.000Z" }],
      now: "2026-08-01T20:00:00.000Z",
    });
    expect(exceptions).toHaveLength(1);
    expect(exceptions[0]).toMatchObject({
      kind: "missing_clock_out",
      staffId: "staff-1",
      resolved: false,
    });
  });

  it("flags a single entry exceeding the overtime threshold", () => {
    const exceptions = detectPayrollExceptions({
      entries: [
        {
          staffId: "staff-1",
          clockInAt: "2026-08-01T08:00:00.000Z",
          clockOutAt: "2026-08-01T19:00:00.000Z",
        },
      ],
      now: "2026-08-01T20:00:00.000Z",
    });
    expect(exceptions).toHaveLength(1);
    expect(exceptions[0]?.kind).toBe("overtime");
  });

  it("every detected exception starts unresolved", () => {
    const exceptions = detectPayrollExceptions({
      entries: [
        {
          staffId: "staff-1",
          clockInAt: "2026-08-01T08:00:00.000Z",
          clockOutAt: "2026-08-01T20:00:00.000Z",
        },
      ],
      now: "2026-08-01T21:00:00.000Z",
    });
    expect(exceptions.every((e) => e.resolved === false)).toBe(true);
  });
});

describe("detectPayrollScheduleExceptions", () => {
  const scheduledShift = {
    shiftId: "snapshot-shift-1",
    staffId: "staff-1",
    scheduledStartAt: "2026-08-01T09:00:00.000Z",
    scheduledEndAt: "2026-08-01T17:00:00.000Z",
  };

  it("reports both a missed scheduled shift and an unscheduled completed entry", () => {
    const exceptions = detectPayrollScheduleExceptions({
      scheduledShifts: [scheduledShift],
      entries: [
        {
          staffId: "staff-2",
          clockInAt: "2026-08-01T09:00:00.000Z",
          clockOutAt: "2026-08-01T17:00:00.000Z",
        },
      ],
    });

    expect(exceptions).toEqual([
      expect.objectContaining({
        kind: "missed_shift",
        staffId: "staff-1",
        detail: expect.stringContaining("snapshot-shift-1"),
      }),
      expect.objectContaining({
        kind: "unscheduled_shift",
        staffId: "staff-2",
      }),
    ]);
  });

  it("treats partial overlap as attendance but adjacent half-open windows as exceptions", () => {
    const partial = detectPayrollScheduleExceptions({
      scheduledShifts: [scheduledShift],
      entries: [
        {
          staffId: "staff-1",
          clockInAt: "2026-08-01T16:59:00.000Z",
          clockOutAt: "2026-08-01T18:00:00.000Z",
        },
      ],
    });
    expect(partial).toEqual([]);

    const adjacent = detectPayrollScheduleExceptions({
      scheduledShifts: [scheduledShift],
      entries: [
        {
          staffId: "staff-1",
          clockInAt: "2026-08-01T17:00:00.000Z",
          clockOutAt: "2026-08-01T18:00:00.000Z",
        },
      ],
    });
    expect(adjacent.map((exception) => exception.kind)).toEqual([
      "missed_shift",
      "unscheduled_shift",
    ]);
  });
});

describe("summarizePeriodHours", () => {
  it("splits an 11-hour shift into 8 regular and 3 overtime", () => {
    const summary = summarizePeriodHours([
      {
        staffId: "staff-1",
        clockInAt: "2026-08-01T08:00:00.000Z",
        clockOutAt: "2026-08-01T19:00:00.000Z",
      },
    ]);
    expect(summary).toEqual([
      { staffId: "staff-1", regularHours: 8, overtimeHours: 3 },
    ]);
  });

  it("aggregates multiple entries for the same staff member across a period", () => {
    const summary = summarizePeriodHours([
      {
        staffId: "staff-1",
        clockInAt: "2026-08-01T09:00:00.000Z",
        clockOutAt: "2026-08-01T17:00:00.000Z",
      },
      {
        staffId: "staff-1",
        clockInAt: "2026-08-02T09:00:00.000Z",
        clockOutAt: "2026-08-02T17:00:00.000Z",
      },
    ]);
    expect(summary).toEqual([
      { staffId: "staff-1", regularHours: 16, overtimeHours: 0 },
    ]);
  });

  it("ignores an entry with no clock-out — it is an open exception, not payable hours", () => {
    const summary = summarizePeriodHours([
      { staffId: "staff-1", clockInAt: "2026-08-01T09:00:00.000Z" },
    ]);
    expect(summary).toEqual([]);
  });
});

describe("buildChecksummedPayrollExport", () => {
  it("produces one row per non-zero earning code", () => {
    const result = buildChecksummedPayrollExport([
      { staffId: "staff-1", regularHours: 40, overtimeHours: 5 },
      { staffId: "staff-2", regularHours: 32, overtimeHours: 0 },
    ]);
    expect(result.rowCount).toBe(3);
    expect(result.rows).toEqual([
      { staffId: "staff-1", earningCode: "overtime", hours: 5 },
      { staffId: "staff-1", earningCode: "regular", hours: 40 },
      { staffId: "staff-2", earningCode: "regular", hours: 32 },
    ]);
  });

  it("produces an identical checksum for the same data regardless of input order", () => {
    const a = buildChecksummedPayrollExport([
      { staffId: "staff-1", regularHours: 40, overtimeHours: 0 },
      { staffId: "staff-2", regularHours: 32, overtimeHours: 0 },
    ]);
    const b = buildChecksummedPayrollExport([
      { staffId: "staff-2", regularHours: 32, overtimeHours: 0 },
      { staffId: "staff-1", regularHours: 40, overtimeHours: 0 },
    ]);
    expect(a.checksum).toBe(b.checksum);
  });

  it("produces a different checksum when the underlying hours change", () => {
    const a = buildChecksummedPayrollExport([
      { staffId: "staff-1", regularHours: 40, overtimeHours: 0 },
    ]);
    const b = buildChecksummedPayrollExport([
      { staffId: "staff-1", regularHours: 41, overtimeHours: 0 },
    ]);
    expect(a.checksum).not.toBe(b.checksum);
  });
});
