import "server-only";

import type { WeatherProvider, WeatherSnapshot } from "@paon/domain";

import { env } from "./env";

/** OpenWeather adapter shared by admin MorningRoutine delivery cron. */
export class OpenWeatherProvider implements WeatherProvider {
  async getCurrentWeather(query: {
    readonly locationLabel: string;
  }): Promise<WeatherSnapshot | null> {
    const apiKey = env.openWeatherApiKey;
    if (!apiKey) return null;

    try {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(query.locationLabel)}&units=metric&appid=${apiKey}`,
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
