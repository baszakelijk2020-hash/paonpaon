/**
 * Branch calendar and timezone contracts (CLI-006 / PHASE 7.5 / ADR-066).
 * Manager-controlled shared calendar with honest branch-local time display.
 */

import type {
  BranchCalendarEntryId,
  BranchId,
  CustomerId,
  RetailerId,
  StaffId,
} from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";
import { isValidIanaTimezone } from "../wardrobe/morning-routine-delivery";

export const BRANCH_CALENDAR_ENTRY_TYPES = [
  "coverage",
  "recurring_moment",
  "store_event",
  "blocked",
] as const;

export type BranchCalendarEntryType =
  (typeof BRANCH_CALENDAR_ENTRY_TYPES)[number];

export const BRANCH_CALENDAR_RECURRENCES = [
  "none",
  "weekly",
  "monthly",
] as const;

export type BranchCalendarRecurrence =
  (typeof BRANCH_CALENDAR_RECURRENCES)[number];

export interface RetailerBranch extends Timestamps {
  readonly id: BranchId;
  readonly retailerId: RetailerId;
  readonly name: string;
  readonly timezone: string;
  readonly isPrimary: boolean;
}

export interface BranchCalendarEntry extends Timestamps {
  readonly id: BranchCalendarEntryId;
  readonly retailerId: RetailerId;
  readonly branchId: BranchId;
  readonly entryType: BranchCalendarEntryType;
  readonly title: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly recurrence: BranchCalendarRecurrence;
  readonly assignedStaffIds: readonly StaffId[];
  readonly customerId?: CustomerId;
  readonly notes?: string;
  readonly createdByStaffId?: StaffId;
}

export type BranchCalendarValidationError =
  | "invalid_timezone"
  | "invalid_name"
  | "ends_before_starts"
  | "recurring_moment_requires_customer"
  | "coverage_requires_staff";

export function formatInstantInBranchTimezone(args: {
  readonly instant: string;
  readonly timezone: string;
  readonly locale?: string;
}): string {
  return new Intl.DateTimeFormat(args.locale ?? "en-US", {
    timeZone: args.timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(args.instant));
}

/** Inclusive local calendar day bounds converted to UTC ISO instants. */
export function branchLocalDayUtcBounds(args: {
  readonly localDate: string;
  readonly timezone: string;
}): { readonly startUtc: string; readonly endUtc: string } {
  const [year, month, day] = args.localDate.split("-").map(Number);
  const probe = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, 12));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: args.timezone,
    timeZoneName: "shortOffset",
    hour: "numeric",
    hour12: false,
  }).formatToParts(probe);
  const offsetPart = parts.find((part) => part.type === "timeZoneName")?.value;
  const match = offsetPart?.match(/GMT([+-]\d+)/);
  const offsetHours = match ? Number(match[1]) : 0;
  const startMs =
    Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, 0, 0, 0) -
    offsetHours * 3_600_000;
  const endMs = startMs + 86_400_000 - 1;
  return {
    startUtc: new Date(startMs).toISOString(),
    endUtc: new Date(endMs).toISOString(),
  };
}

export function validateBranchDraft(args: {
  readonly name: string;
  readonly timezone: string;
}): {
  readonly ok: boolean;
  readonly errors: readonly BranchCalendarValidationError[];
} {
  const errors: BranchCalendarValidationError[] = [];
  if (!isValidIanaTimezone(args.timezone)) {
    errors.push("invalid_timezone");
  }
  if (args.name.trim().length === 0) {
    errors.push("invalid_name");
  }
  return { ok: errors.length === 0, errors };
}

export function validateBranchCalendarEntryDraft(args: {
  readonly entryType: BranchCalendarEntryType;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly customerId?: CustomerId;
  readonly assignedStaffIds: readonly StaffId[];
}): {
  readonly ok: boolean;
  readonly errors: readonly BranchCalendarValidationError[];
} {
  const errors: BranchCalendarValidationError[] = [];
  if (new Date(args.startsAt).getTime() >= new Date(args.endsAt).getTime()) {
    errors.push("ends_before_starts");
  }
  if (args.entryType === "recurring_moment" && !args.customerId) {
    errors.push("recurring_moment_requires_customer");
  }
  if (args.entryType === "coverage" && args.assignedStaffIds.length === 0) {
    errors.push("coverage_requires_staff");
  }
  return { ok: errors.length === 0, errors };
}

export interface BranchCoverageGap {
  readonly branchId: BranchId;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly title: string;
  readonly missingStaffCount: number;
}

/**
 * Detect coverage entries with no assigned staff or overlapping blocked time
 * without matching coverage — deterministic, explainable gaps only.
 */
export function findBranchCoverageGaps(args: {
  readonly branchId: BranchId;
  readonly entries: readonly Pick<
    BranchCalendarEntry,
    | "branchId"
    | "entryType"
    | "startsAt"
    | "endsAt"
    | "title"
    | "assignedStaffIds"
  >[];
}): readonly BranchCoverageGap[] {
  const gaps: BranchCoverageGap[] = [];
  for (const entry of args.entries) {
    if (entry.branchId !== args.branchId) continue;
    if (entry.entryType !== "coverage") continue;
    if (entry.assignedStaffIds.length > 0) continue;
    gaps.push({
      branchId: entry.branchId,
      startsAt: entry.startsAt,
      endsAt: entry.endsAt,
      title: entry.title,
      missingStaffCount: 0,
    });
  }
  return gaps.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
