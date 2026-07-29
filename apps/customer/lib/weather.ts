import "server-only";

import type { WeatherProvider, WeatherSnapshot } from "@paon/domain";

import { env } from "./env";

/**
 * OpenWeather adapter for MorningRoutine. Returns null when the key is
 * missing or the request fails — never fabricates weather (MR-001).
 */
export class OpenWeatherProvider implements WeatherProvider {
  async getCurrentWeather(query: {
    readonly locationLabel: string;
  }): Promise<WeatherSnapshot | null> {
    const apiKey = env.openWeatherApiKey;
    if (!apiKey) return null;

    try {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(query.locationLabel)}&units=metric&appid=${apiKey}`,
        { next: { revalidate: 1800 } },
      );
      if (!response.ok) return null;
      const data = (await response.json()) as {
        main?: { temp?: number };
        weather?: { description?: string }[];
      };
      if (typeof data.main?.temp !== "number") return null;
      return {
        temperatureCelsius: Math.round(data.main.temp),
        description: data.weather?.[0]?.description ?? "",
        locationLabel: query.locationLabel,
        status: "live",
        observedAt: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }
}

/** @deprecated Prefer OpenWeatherProvider — kept for Today's Pick compatibility. */
export async function getWeather(
  city: string,
): Promise<{ temperatureCelsius: number; description: string } | null> {
  const snapshot = await new OpenWeatherProvider().getCurrentWeather({
    locationLabel: city,
  });
  if (!snapshot) return null;
  return {
    temperatureCelsius: snapshot.temperatureCelsius,
    description: snapshot.description,
  };
}
