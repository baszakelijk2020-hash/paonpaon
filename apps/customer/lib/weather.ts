import "server-only";

import { env } from "./env";

export interface WeatherSnapshot {
  temperatureCelsius: number;
  description: string;
}

/**
 * Returns `null`, not a throw, when `OPENWEATHER_API_KEY` isn't
 * configured or the request fails — Today's Pick renders without a
 * weather line rather than crashing, same non-faking treatment every
 * other unconfigured provider in this codebase gets. A plain `fetch`
 * call, not a wrapping package — OpenWeatherMap has no SDK to isolate
 * (ADR-001's isolation rule is for provider SDKs, not a bare REST call).
 */
export async function getWeather(
  city: string,
): Promise<WeatherSnapshot | null> {
  const apiKey = env.openWeatherApiKey;
  if (!apiKey) return null;

  try {
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${apiKey}`,
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
    };
  } catch {
    return null;
  }
}
