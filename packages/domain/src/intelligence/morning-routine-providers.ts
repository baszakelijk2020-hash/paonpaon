/**
 * Provider-neutral weather and calendar interfaces for MorningRoutine
 * (MR-001 / PHASE 4.4). Implementations live in apps or test fixtures;
 * domain selection never imports a specific vendor SDK.
 */

import type { CustomerId, RetailerId } from "../shared/branded-id";

export const MORNING_ROUTINE_INPUT_SOURCES = [
  "wardrobe",
  "catalogue",
  "style_profile_declared",
  "style_profile_inferred",
  "weather",
  "calendar",
  "location",
  "retailer_default",
  "unavailable",
  "withdrawn",
] as const;

export type MorningRoutineInputSource =
  (typeof MORNING_ROUTINE_INPUT_SOURCES)[number];

export interface MorningRoutineInputProvenanceEntry {
  readonly input: MorningRoutineInputSource;
  readonly used: boolean;
  readonly detail: string;
}

export interface MorningRoutineWeatherSnapshot {
  readonly temperatureCelsius: number;
  readonly description: string;
  readonly city?: string;
}

export interface MorningRoutineWeatherRequest {
  readonly retailerId: RetailerId;
  readonly fallbackCity?: string;
  readonly locationGranted: boolean;
  readonly preciseCity?: string;
}

export interface MorningRoutineWeatherResult {
  readonly weather: MorningRoutineWeatherSnapshot | null;
  readonly provenance: MorningRoutineInputProvenanceEntry;
}

export interface MorningRoutineCalendarEvent {
  readonly label: string;
  readonly startsAt: string;
  readonly source: "appointment" | "customer_declared" | "fixture";
}

export interface MorningRoutineCalendarRequest {
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly declaredOccasion?: string;
}

export interface MorningRoutineCalendarResult {
  readonly occasion: MorningRoutineCalendarEvent | null;
  readonly provenance: MorningRoutineInputProvenanceEntry;
}

export interface MorningRoutineWeatherProvider {
  fetch(
    request: MorningRoutineWeatherRequest,
  ): Promise<MorningRoutineWeatherResult>;
}

export interface MorningRoutineCalendarProvider {
  fetch(
    request: MorningRoutineCalendarRequest,
  ): Promise<MorningRoutineCalendarResult>;
}

/** Deterministic no-provider weather fallback for tests and offline runs. */
export function fixtureWeatherProvider(
  weather: MorningRoutineWeatherSnapshot | null,
  detail = "fixture weather provider",
): MorningRoutineWeatherProvider {
  return {
    async fetch(): Promise<MorningRoutineWeatherResult> {
      return {
        weather,
        provenance: {
          input: weather ? "weather" : "unavailable",
          used: weather !== null,
          detail,
        },
      };
    },
  };
}

/** Deterministic no-provider calendar fallback for tests and offline runs. */
export function fixtureCalendarProvider(
  occasion: MorningRoutineCalendarEvent | null,
  detail = "fixture calendar provider",
): MorningRoutineCalendarProvider {
  return {
    async fetch(): Promise<MorningRoutineCalendarResult> {
      return {
        occasion,
        provenance: {
          input: occasion ? "calendar" : "unavailable",
          used: occasion !== null,
          detail,
        },
      };
    },
  };
}

/** Provider failure path — selection continues without weather/occasion. */
export function failingWeatherProvider(
  message: string,
): MorningRoutineWeatherProvider {
  return {
    async fetch(): Promise<MorningRoutineWeatherResult> {
      return {
        weather: null,
        provenance: {
          input: "unavailable",
          used: false,
          detail: message,
        },
      };
    },
  };
}

export function failingCalendarProvider(
  message: string,
): MorningRoutineCalendarProvider {
  return {
    async fetch(): Promise<MorningRoutineCalendarResult> {
      return {
        occasion: null,
        provenance: {
          input: "unavailable",
          used: false,
          detail: message,
        },
      };
    },
  };
}
