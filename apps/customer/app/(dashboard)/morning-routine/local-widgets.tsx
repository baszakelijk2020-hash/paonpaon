"use client";

import { useEffect, useState } from "react";

const WORLD_CLOCKS: { city: string; timeZone: string }[] = [
  { city: "New York", timeZone: "America/New_York" },
  { city: "London", timeZone: "Europe/London" },
  { city: "Dubai", timeZone: "Asia/Dubai" },
  { city: "Hong Kong", timeZone: "Asia/Hong_Kong" },
  { city: "Tokyo", timeZone: "Asia/Tokyo" },
  { city: "Sydney", timeZone: "Australia/Sydney" },
];

const WEATHER_CODE_LABELS: Record<number, string> = {
  0: "Clear sky",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Fog",
  51: "Light drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  80: "Rain showers",
  95: "Thunderstorm",
};

interface Coords {
  lat: number;
  lon: number;
}

const WORK_ADDRESS_STORAGE_KEY = "paon-work-address";

function haversineKm(a: Coords, b: Coords): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Weather via Open-Meteo, geocoding via OSM Nominatim — both free and
 * keyless, so this works today. There is no free, reliable live-traffic
 * API; the "drive time" here is a straight-line-distance estimate at an
 * assumed average city speed, clearly labeled as such, not real traffic —
 * swap in a routing API (Google/Mapbox) here once a key is available.
 */
export function LocalWidgets() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locationLabel, setLocationLabel] = useState("Your location");
  const [weather, setWeather] = useState<{
    tempC: number;
    label: string;
  } | null>(null);
  const [workAddress, setWorkAddress] = useState("");
  const [workInput, setWorkInput] = useState("");
  const [commute, setCommute] = useState<{
    km: number;
    minutes: number;
  } | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const tick = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(WORK_ADDRESS_STORAGE_KEY);
      if (stored) {
        setWorkAddress(stored);
        setWorkInput(stored);
      }
    } catch {
      // localStorage unavailable — work-address memory is per-viewer only.
    }
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
      },
      () => {
        // Denied or unavailable — widgets below fall back to no-location copy.
      },
      { maximumAge: 10 * 60_000, timeout: 8_000 },
    );
  }, []);

  useEffect(() => {
    if (!coords) return;
    let cancelled = false;
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,weather_code`,
    )
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const tempC = data?.current?.temperature_2m;
        const code = data?.current?.weather_code;
        if (typeof tempC === "number") {
          setWeather({
            tempC,
            label: WEATHER_CODE_LABELS[code] ?? "Conditions unavailable",
          });
        }
      })
      .catch(() => {
        // Network/API unavailable — weather card just doesn't render.
      });
    fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lon}`,
      { headers: { Accept: "application/json" } },
    )
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const city =
          data?.address?.city ?? data?.address?.town ?? data?.address?.village;
        if (city) setLocationLabel(city);
      })
      .catch(() => {
        // Reverse geocoding unavailable — keep the generic label.
      });
    return () => {
      cancelled = true;
    };
  }, [coords]);

  async function geocodeWorkAddress(address: string) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`,
        { headers: { Accept: "application/json" } },
      );
      const data = await res.json();
      const hit = data?.[0];
      if (!hit || !coords) return;
      const workCoords = { lat: Number(hit.lat), lon: Number(hit.lon) };
      const km = haversineKm(coords, workCoords);
      // ~28 km/h average city driving speed, straight-line distance.
      const minutes = Math.max(4, Math.round((km / 28) * 60));
      setCommute({ km: Math.round(km * 10) / 10, minutes });
    } catch {
      setCommute(null);
    }
  }

  function saveWorkAddress(address: string) {
    setWorkAddress(address);
    try {
      localStorage.setItem(WORK_ADDRESS_STORAGE_KEY, address);
    } catch {
      // Per-viewer convenience only — fine if it doesn't persist.
    }
    void geocodeWorkAddress(address);
  }

  useEffect(() => {
    if (workAddress && coords) void geocodeWorkAddress(workAddress);
    // Only re-run when coords first resolve for an already-saved address.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords]);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white p-4">
        <p className="font-accent text-[10px] uppercase tracking-[0.16em] text-[var(--color-stone-500)]">
          Weather · {locationLabel}
        </p>
        {weather ? (
          <p className="font-display mt-2 text-2xl text-[var(--color-stone-900)]">
            {Math.round(weather.tempC)}°C
            <span className="ml-2 text-sm font-normal text-[var(--color-stone-500)]">
              {weather.label}
            </span>
          </p>
        ) : (
          <p className="mt-2 text-sm text-[var(--color-stone-500)]">
            Allow location access for local weather.
          </p>
        )}
      </div>

      <div className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white p-4">
        <p className="font-accent text-[10px] uppercase tracking-[0.16em] text-[var(--color-stone-500)]">
          Local time
        </p>
        <p className="font-display mt-2 text-2xl text-[var(--color-stone-900)]">
          {now?.toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
          }) ?? "—"}
        </p>
        <p className="mt-1 text-xs text-[var(--color-stone-500)]">
          {now?.toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          }) ?? ""}
        </p>
      </div>

      <div className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white p-4">
        <p className="font-accent text-[10px] uppercase tracking-[0.16em] text-[var(--color-stone-500)]">
          Drive to work
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveWorkAddress(workInput.trim());
          }}
          className="mt-2 flex gap-1"
        >
          <input
            value={workInput}
            onChange={(e) => setWorkInput(e.target.value)}
            placeholder="Set your work address"
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-stone-200)] px-2 py-1 text-xs"
          />
          <button
            type="submit"
            className="shrink-0 rounded-[var(--radius-sm)] bg-[var(--color-stone-900)] px-2 py-1 text-xs text-white"
          >
            Set
          </button>
        </form>
        {commute ? (
          <p className="font-display mt-2 text-2xl text-[var(--color-stone-900)]">
            ~{commute.minutes} min
            <span className="ml-2 text-sm font-normal text-[var(--color-stone-500)]">
              {commute.km} km, estimated
            </span>
          </p>
        ) : workAddress ? (
          <p className="mt-2 text-xs text-[var(--color-stone-500)]">
            Locating {workAddress}…
          </p>
        ) : (
          <p className="mt-2 text-xs text-[var(--color-stone-500)]">
            Estimated from straight-line distance — no live traffic yet.
          </p>
        )}
      </div>

      <div className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white p-4">
        <p className="font-accent text-[10px] uppercase tracking-[0.16em] text-[var(--color-stone-500)]">
          World clock
        </p>
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          {WORLD_CLOCKS.map((clock) => (
            <p key={clock.city} className="flex justify-between gap-2">
              <span className="text-[var(--color-stone-500)]">
                {clock.city}
              </span>
              <span className="font-medium text-[var(--color-stone-900)]">
                {now?.toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: clock.timeZone,
                }) ?? "—"}
              </span>
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
