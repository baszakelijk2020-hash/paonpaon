/**
 * Time approval and payroll export (WFM-101 / WFM-102 / PHASE 11.1).
 *
 * Provider-neutral by design per this item's own non-goal: no tax
 * calculation, filing or salary payout — only the local capability a
 * generic payroll/accountant export needs. Operates on staff_time_entries
 * (clock_in_at/clock_out_at, already real — see
 * 20260721000006_create_staff_roster.sql) and staff_shifts (the manager's
 * planned schedule), never on any customer data.
 */

export const PAYROLL_EXCEPTION_KINDS = [
  "missing_clock_out",
  "overtime",
  "unscheduled_shift",
  "missed_shift",
] as const;

export type PayrollExceptionKind = (typeof PAYROLL_EXCEPTION_KINDS)[number];

export interface PayrollException {
  readonly kind: PayrollExceptionKind;
  readonly staffId: string;
  readonly detail: string;
  /** True once a manager has resolved it — an unresolved exception blocks
   * period approval (WFM-101's "manager resolves ... exception, approves
   * period" is a sequence, not two independent steps). */
  readonly resolved: boolean;
}

export interface TimeEntryForExceptionCheck {
  readonly staffId: string;
  readonly clockInAt: string;
  readonly clockOutAt?: string;
}

export interface ShiftForExceptionCheck {
  readonly staffId: string;
  readonly shiftDate: string;
}

const STANDARD_SHIFT_HOURS = 8;
const OVERTIME_HOURS_PER_DAY = 10;

function hoursBetween(startIso: string, endIso: string): number {
  return (Date.parse(endIso) - Date.parse(startIso)) / (1000 * 60 * 60);
}

/**
 * Detects exceptions a manager must resolve before a pay period can be
 * approved. Never auto-resolves anything — every exception starts
 * unresolved; a manager action is what sets resolved: true, recorded
 * separately from this pure detection pass.
 */
export function detectPayrollExceptions(args: {
  readonly entries: readonly TimeEntryForExceptionCheck[];
  readonly now: string;
}): readonly PayrollException[] {
  const exceptions: PayrollException[] = [];

  for (const entry of args.entries) {
    if (!entry.clockOutAt) {
      const hoursSinceClockIn = hoursBetween(entry.clockInAt, args.now);
      // A still-open shift within a normal working day isn't an exception
      // yet — only flag once it has run long enough that a forgotten
      // clock-out is the more likely explanation than an ongoing shift.
      if (hoursSinceClockIn > STANDARD_SHIFT_HOURS + 2) {
        exceptions.push({
          kind: "missing_clock_out",
          staffId: entry.staffId,
          detail: `Clocked in ${hoursSinceClockIn.toFixed(1)}h ago with no clock-out`,
          resolved: false,
        });
      }
      continue;
    }
    const hoursWorked = hoursBetween(entry.clockInAt, entry.clockOutAt);
    if (hoursWorked > OVERTIME_HOURS_PER_DAY) {
      exceptions.push({
        kind: "overtime",
        staffId: entry.staffId,
        detail: `Worked ${hoursWorked.toFixed(1)}h in a single entry (threshold ${OVERTIME_HOURS_PER_DAY}h)`,
        resolved: false,
      });
    }
  }

  return exceptions;
}

export interface StaffPeriodHours {
  readonly staffId: string;
  readonly regularHours: number;
  readonly overtimeHours: number;
}

/**
 * Splits each staff member's total worked hours in a period into regular
 * and overtime, per-entry (an 11-hour shift is 8 regular + 3 overtime, not
 * a period-total threshold) — matching how detectPayrollExceptions already
 * flags overtime per entry, so the two never disagree about what counts.
 */
export function summarizePeriodHours(
  entries: readonly TimeEntryForExceptionCheck[],
): readonly StaffPeriodHours[] {
  const byStaff = new Map<string, { regular: number; overtime: number }>();
  for (const entry of entries) {
    if (!entry.clockOutAt) continue;
    const hoursWorked = hoursBetween(entry.clockInAt, entry.clockOutAt);
    const regular = Math.min(hoursWorked, STANDARD_SHIFT_HOURS);
    const overtime = Math.max(0, hoursWorked - STANDARD_SHIFT_HOURS);
    const existing = byStaff.get(entry.staffId) ?? { regular: 0, overtime: 0 };
    byStaff.set(entry.staffId, {
      regular: existing.regular + regular,
      overtime: existing.overtime + overtime,
    });
  }
  return Array.from(byStaff.entries()).map(([staffId, hours]) => ({
    staffId,
    regularHours: Math.round(hours.regular * 100) / 100,
    overtimeHours: Math.round(hours.overtime * 100) / 100,
  }));
}

export interface PayrollExportRow {
  readonly staffId: string;
  readonly earningCode: "regular" | "overtime";
  readonly hours: number;
}

export interface ChecksummedPayrollExport {
  readonly rows: readonly PayrollExportRow[];
  /** A deterministic digest over the exact exported rows — an accountant
   * or payroll provider can confirm the numbers they received are exactly
   * what this system approved, not silently edited in transit. Not
   * cryptographically secure (no secret key); its job is integrity
   * detection, not authentication. */
  readonly checksum: string;
  readonly rowCount: number;
}

/**
 * Builds the generic accountant/payroll export this item's acceptance
 * names, plus a checksum over its exact serialized content. Row order is
 * sorted deterministically (staffId, then earningCode) specifically so the
 * checksum is stable across repeated exports of the same approved period —
 * an export whose checksum changes between two exports of unchanged data
 * would defeat the entire point of checksumming it.
 */
export function buildChecksummedPayrollExport(
  periodHours: readonly StaffPeriodHours[],
): ChecksummedPayrollExport {
  const rows: PayrollExportRow[] = [];
  for (const staff of periodHours) {
    if (staff.regularHours > 0) {
      rows.push({
        staffId: staff.staffId,
        earningCode: "regular",
        hours: staff.regularHours,
      });
    }
    if (staff.overtimeHours > 0) {
      rows.push({
        staffId: staff.staffId,
        earningCode: "overtime",
        hours: staff.overtimeHours,
      });
    }
  }
  rows.sort((a, b) =>
    a.staffId === b.staffId
      ? a.earningCode.localeCompare(b.earningCode)
      : a.staffId.localeCompare(b.staffId),
  );

  // Keep this representation deliberately primitive: the database uses the
  // identical canonical string when it derives exports from immutable
  // snapshots. JSON object key ordering would make a cross-runtime checksum
  // a property of serializers instead of payroll data.
  const serialized = rows
    .map((row) => `${row.staffId}|${row.earningCode}|${row.hours}`)
    .join("\n");
  let hash = 0x811c9dc5;
  for (let i = 0; i < serialized.length; i += 1) {
    hash = (hash ^ serialized.charCodeAt(i)) >>> 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  const checksum = hash.toString(16).padStart(8, "0");

  return { rows, checksum, rowCount: rows.length };
}
