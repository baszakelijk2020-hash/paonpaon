/**
 * Provider-neutral weather port for MorningRoutine (MR-001 / PHASE 4.4).
 * Domain never imports OpenWeather or any SDK; adapters live in apps.
 */

export const WEATHER_PROVIDER_STATUSES = [
  "live",
  "mock",
  "unavailable",
  "failed",
] as const;

export type WeatherProviderStatus = (typeof WEATHER_PROVIDER_STATUSES)[number];

export interface WeatherQuery {
  /** City or coarse place label — never precise coordinates in domain. */
  readonly locationLabel: string;
}

export interface WeatherSnapshot {
  readonly temperatureCelsius: number;
  readonly description: string;
  readonly locationLabel: string;
  readonly status: Exclude<WeatherProviderStatus, "unavailable" | "failed">;
  readonly observedAt: string;
}

/**
 * Returns null when credentials are absent or the request fails. Callers
 * must not fabricate weather.
 */
export interface WeatherProvider {
  getCurrentWeather(query: WeatherQuery): Promise<WeatherSnapshot | null>;
}

/** Null-object adapter for fixtures and no-credential deployments. */
export class UnavailableWeatherProvider implements WeatherProvider {
  async getCurrentWeather(
    _query: WeatherQuery,
  ): Promise<WeatherSnapshot | null> {
    return null;
  }
}

export class MockWeatherProvider implements WeatherProvider {
  constructor(
    private readonly snapshot: WeatherSnapshot | null = {
      temperatureCelsius: 12,
      description: "light rain",
      locationLabel: "Blaricum",
      status: "mock",
      observedAt: "2026-07-30T08:00:00.000Z",
    },
  ) {}

  async getCurrentWeather(
    query: WeatherQuery,
  ): Promise<WeatherSnapshot | null> {
    if (!this.snapshot) return null;
    return {
      ...this.snapshot,
      locationLabel: query.locationLabel || this.snapshot.locationLabel,
    };
  }
}
