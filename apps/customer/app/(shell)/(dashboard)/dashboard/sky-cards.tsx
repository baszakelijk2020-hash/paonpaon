"use client";

import { useEffect, useState } from "react";

import { HOME_LOCATION } from "../morning-routine/local-widgets";

import { AirIcon, SunriseIcon, SunsetIcon, WindIcon } from "./stat-icons";

import "./overview.css";

/**
 * Readings for the top row, all for home (Breda), all from Open-Meteo
 * (keyless):
 *
 * - the sun — sunset while it is still daytime, the next sunrise once the sun
 *   is down;
 * - the European air-quality index;
 * - wind, as a Beaufort force with the direction it blows from.
 *
 * None of these is a tile of its own any more. The row used to be six narrow
 * tiles with one number each, most of them wasting their width; it is three
 * now. Sun, air and wind all ride in the weather tile beside the temperature,
 * so that tile is a reading of one *thing* — the sky — rather than one
 * number. Each export is a `.paon-stat-extra` fragment for its host tile to
 * place; the fetching is unchanged.
 */

type Sun = { sunrise: string; sunset: string }[];

function aqiLabel(aqi: number): string {
  if (aqi <= 20) return "Good";
  if (aqi <= 40) return "Fair";
  if (aqi <= 60) return "Moderate";
  if (aqi <= 80) return "Poor";
  if (aqi <= 100) return "Very poor";
  return "Extremely poor";
}

function clockOf(iso: string): string {
  // Open-Meteo returns local wall time for the requested zone, no offset.
  return iso.slice(11, 16);
}

export function SunCard() {
  const [sun, setSun] = useState<Sun | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const tick = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    let disposed = false;
    const { lat, lon } = HOME_LOCATION.coords;
    const zone = encodeURIComponent(HOME_LOCATION.timeZone);
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=sunrise,sunset&timezone=${zone}&forecast_days=2`,
    )
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (data: { daily?: { sunrise: string[]; sunset: string[] } } | null) => {
          const daily = data?.daily;
          if (disposed || !daily) return;
          setSun(
            daily.sunrise.map((sunrise, index) => ({
              sunrise,
              sunset: daily.sunset[index] ?? sunrise,
            })),
          );
        },
      )
      .catch(() => undefined);
    return () => {
      disposed = true;
    };
  }, []);

  // Local wall clock at home, as "HH:MM", to compare against Open-Meteo's
  // local timestamps.
  const homeNow = now
    ? now.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: HOME_LOCATION.timeZone,
      })
    : null;

  const today = sun?.[0];
  const tomorrow = sun?.[1];
  const afterSunset =
    today && homeNow ? homeNow >= clockOf(today.sunset) : false;
  const beforeSunrise =
    today && homeNow ? homeNow < clockOf(today.sunrise) : false;

  const reading = !today
    ? null
    : beforeSunrise
      ? { label: "Sunrise", time: clockOf(today.sunrise) }
      : afterSunset
        ? { label: "Sunrise", time: clockOf((tomorrow ?? today).sunrise) }
        : { label: "Sunset", time: clockOf(today.sunset) };

  return (
    <div className="paon-stat-extra paon-stat-extra-sun" aria-label="Sun">
      {reading?.label === "Sunrise" ? (
        <SunriseIcon className="paon-stat-icon" />
      ) : (
        <SunsetIcon className="paon-stat-icon" />
      )}
      <span className="paon-stat-extra-value">{reading?.time ?? "--:--"}</span>
      <span className="paon-stat-extra-meta">
        <span className="paon-stat-label">{reading?.label ?? "Sun"}</span>
        <span className="paon-stat-detail">
          {reading?.label === "Sunrise" && afterSunset ? "Tomorrow" : "Today"}
        </span>
      </span>
    </div>
  );
}

export function AirCard() {
  const [aqi, setAqi] = useState<number | null>(null);

  useEffect(() => {
    let disposed = false;
    const { lat, lon } = HOME_LOCATION.coords;
    fetch(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi`,
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { current?: { european_aqi?: number } } | null) => {
        const value = data?.current?.european_aqi;
        if (disposed || value === undefined) return;
        setAqi(Math.round(value));
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
    };
  }, []);

  return (
    <div
      className={[
        "paon-stat-extra paon-stat-extra-air",
        aqi === null ? "paon-stat-value-idle" : "",
      ].join(" ")}
      aria-label="Air quality"
    >
      <AirIcon className="paon-stat-icon" />
      <span className="paon-stat-extra-value">{aqi ?? "—"}</span>
      <span className="paon-stat-extra-meta">
        <span className="paon-stat-label">Air quality</span>
        <span className="paon-stat-detail">
          {aqi === null ? "Loading…" : aqiLabel(aqi)}
        </span>
      </span>
    </div>
  );
}

/** Beaufort force from a 10 m wind speed in m/s. */
function beaufort(ms: number): number {
  const limits = [
    0.3, 1.6, 3.4, 5.5, 8, 10.8, 13.9, 17.2, 20.8, 24.5, 28.5, 32.7,
  ];
  return limits.findIndex((limit) => ms < limit) === -1
    ? 12
    : limits.findIndex((limit) => ms < limit);
}

const BEAUFORT_NAMES = [
  "Calm",
  "Light air",
  "Light breeze",
  "Gentle breeze",
  "Moderate breeze",
  "Fresh breeze",
  "Strong breeze",
  "Near gale",
  "Gale",
  "Strong gale",
  "Storm",
  "Violent storm",
  "Hurricane",
];

function compass(degrees: number): string {
  const points = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return points[Math.round(degrees / 45) % 8] ?? "N";
}

export function WindCard() {
  const [wind, setWind] = useState<{ ms: number; from: number } | null>(null);

  useEffect(() => {
    let disposed = false;
    const { lat, lon } = HOME_LOCATION.coords;
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms`,
    )
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (
          data: {
            current?: { wind_speed_10m?: number; wind_direction_10m?: number };
          } | null,
        ) => {
          const current = data?.current;
          if (disposed || current?.wind_speed_10m === undefined) return;
          setWind({
            ms: current.wind_speed_10m,
            from: current.wind_direction_10m ?? 0,
          });
        },
      )
      .catch(() => undefined);
    return () => {
      disposed = true;
    };
  }, []);

  const force = wind ? beaufort(wind.ms) : null;

  return (
    <div
      className={[
        "paon-stat-extra paon-stat-extra-wind",
        wind ? "" : "paon-stat-value-idle",
      ].join(" ")}
      aria-label="Wind"
    >
      {/* The arrow points the way the wind blows: from `from`, so + 180. */}
      <WindIcon
        className="paon-stat-icon"
        style={
          wind
            ? { transform: `rotate(${(wind.from + 180) % 360}deg)` }
            : undefined
        }
      />
      <span className="paon-stat-extra-value">
        {force ?? "—"}
        <small>Bft</small>
      </span>
      <span className="paon-stat-extra-meta">
        <span className="paon-stat-label">
          {wind ? `Wind ${compass(wind.from)}` : "Wind"}
        </span>
        <span className="paon-stat-detail">
          {force === null
            ? "Loading…"
            : `${BEAUFORT_NAMES[force]} · ${Math.round(wind!.ms * 3.6)} km/h`}
        </span>
      </span>
    </div>
  );
}
