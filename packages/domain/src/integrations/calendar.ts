/**
 * Provider-neutral calendar/occasion port for MorningRoutine (MR-001 /
 * PHASE 4.4). Adapters may project appointments or declared occasions;
 * domain never imports a calendar SDK.
 */

export const CALENDAR_OCCASION_SOURCES = [
  "appointment",
  "declared",
  "mock",
] as const;

export type CalendarOccasionSource = (typeof CALENDAR_OCCASION_SOURCES)[number];

export const CALENDAR_PROVIDER_STATUSES = [
  "live",
  "mock",
  "unavailable",
  "failed",
] as const;

export type CalendarProviderStatus =
  (typeof CALENDAR_PROVIDER_STATUSES)[number];

export interface CalendarOccasion {
  readonly label: string;
  readonly startsAt: string;
  readonly endsAt?: string;
  readonly source: CalendarOccasionSource;
  readonly appointmentId?: string;
}

export interface CalendarDayQuery {
  /** Inclusive local calendar day as YYYY-MM-DD. */
  readonly day: string;
  readonly retailerId: string;
  readonly customerId: string;
}

export interface CalendarDayResult {
  readonly status: Exclude<CalendarProviderStatus, "unavailable" | "failed">;
  readonly occasions: readonly CalendarOccasion[];
}

/**
 * Returns an empty list (not a throw) when the provider has nothing for
 * the day. Failures should surface as status via adapters that wrap this.
 */
export interface CalendarProvider {
  listOccasionsForDay(query: CalendarDayQuery): Promise<CalendarDayResult>;
}

export class UnavailableCalendarProvider implements CalendarProvider {
  async listOccasionsForDay(
    _query: CalendarDayQuery,
  ): Promise<CalendarDayResult> {
    return { status: "mock", occasions: [] };
  }
}

export class MockCalendarProvider implements CalendarProvider {
  constructor(private readonly occasions: readonly CalendarOccasion[] = []) {}

  async listOccasionsForDay(
    _query: CalendarDayQuery,
  ): Promise<CalendarDayResult> {
    return { status: "mock", occasions: this.occasions };
  }
}
