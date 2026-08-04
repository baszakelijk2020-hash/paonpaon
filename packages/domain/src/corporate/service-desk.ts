/**
 * Corporate service desk (BD-108 / PHASE 18.8).
 *
 * Extends `corporate_exceptions` (14.1) rather than forking a second
 * ticketing table for the same shape of problem — see this file's
 * `CorporateExceptionKind` additions in `corporate-programme.ts`. The
 * one genuinely new concept here is the audit trail
 * (`corporate_exception_events`): every state change is recorded there,
 * append-only, so "who assigned this, and when did the priority
 * change" is never a question only the current row can half-answer.
 */

export const CORPORATE_EXCEPTION_PRIORITIES = [
  "low",
  "normal",
  "high",
  "urgent",
] as const;
export type CorporateExceptionPriority =
  (typeof CORPORATE_EXCEPTION_PRIORITIES)[number];

/** Fixed, published SLA hours per priority — the whole SLA formula. A
 * change is a code change and a PHASE.md addendum, not a silent runtime
 * tuning knob (the same discipline `SIGNAL_SOURCE_WEIGHTS` in
 * `business-development.ts` already applies to opportunity scoring). */
export const SLA_HOURS_BY_PRIORITY: Record<CorporateExceptionPriority, number> =
  {
    urgent: 4,
    high: 24,
    normal: 72,
    low: 168,
  };

/** Computed once at creation (or whenever priority changes) — never
 * recomputed silently from "now", or a ticket's due date would drift
 * every time someone merely opened it. */
export function computeExceptionDueAt(args: {
  readonly priority: CorporateExceptionPriority;
  readonly fromIso: string;
}): string {
  const hours = SLA_HOURS_BY_PRIORITY[args.priority];
  return new Date(
    Date.parse(args.fromIso) + hours * 60 * 60 * 1000,
  ).toISOString();
}

/** An overdue ticket is one still unresolved past its own due date —
 * never inferred from priority alone, so a ticket someone already
 * extended or resolved is never shown as overdue when it isn't. */
export function isExceptionOverdue(args: {
  readonly dueAt?: string;
  readonly resolvedAt?: string;
  readonly now: string;
}): boolean {
  if (args.resolvedAt) return false;
  if (!args.dueAt) return false;
  return Date.parse(args.now) > Date.parse(args.dueAt);
}

export const CORPORATE_EXCEPTION_EVENT_TYPES = [
  "created",
  "assigned",
  "priority_changed",
  "resolved",
] as const;
export type CorporateExceptionEventType =
  (typeof CORPORATE_EXCEPTION_EVENT_TYPES)[number];

export interface CorporateExceptionEvent {
  readonly id: string;
  readonly exceptionId: string;
  readonly eventType: CorporateExceptionEventType;
  readonly detail?: string;
  readonly actorStaffId?: string;
  readonly createdAt: string;
}
