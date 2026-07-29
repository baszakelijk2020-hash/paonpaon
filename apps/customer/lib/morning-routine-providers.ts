import "server-only";

import type {
  MorningRoutineWeatherProvider,
  MorningRoutineWeatherRequest,
  MorningRoutineWeatherResult,
} from "@paon/domain";

import { getWeather } from "./weather";

/**
 * OpenWeather-backed MorningRoutine weather provider. Returns null weather
 * (not a throw) when credentials are missing or the request fails — selection
 * continues with provenance noting the fallback.
 */
export function createMorningRoutineWeatherProvider(): MorningRoutineWeatherProvider {
  return {
    async fetch(
      request: MorningRoutineWeatherRequest,
    ): Promise<MorningRoutineWeatherResult> {
      const city =
        request.locationGranted && request.preciseCity
          ? request.preciseCity
          : request.fallbackCity;

      if (!city) {
        return {
          weather: null,
          provenance: {
            input: "unavailable",
            used: false,
            detail: "No city available for weather lookup",
          },
        };
      }

      const weather = await getWeather(city);
      if (!weather) {
        return {
          weather: null,
          provenance: {
            input: "unavailable",
            used: false,
            detail: "Weather provider unavailable or request failed",
          },
        };
      }

      return {
        weather: {
          temperatureCelsius: weather.temperatureCelsius,
          description: weather.description,
          city,
        },
        provenance: {
          input: request.locationGranted ? "location" : "retailer_default",
          used: true,
          detail: request.locationGranted
            ? "Weather fetched for consented location"
            : "Weather fetched for retailer default city",
        },
      };
    },
  };
}
