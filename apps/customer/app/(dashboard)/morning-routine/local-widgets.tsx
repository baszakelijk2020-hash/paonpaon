"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const CITY_STREAMS_ENABLED = true;

const WORLD_CLOCKS: { city: string; timeZone: string }[] = [
  { city: "New York", timeZone: "America/New_York" },
  { city: "London", timeZone: "Europe/London" },
  { city: "Dubai", timeZone: "Asia/Dubai" },
  { city: "Hong Kong", timeZone: "Asia/Hong_Kong" },
  { city: "Tokyo", timeZone: "Asia/Tokyo" },
  { city: "Sydney", timeZone: "Australia/Sydney" },
];

const CITY_CAMERAS = [
  {
    city: "New York",
    code: "NYC",
    timeZone: "America/New_York",
    poster: "https://img.youtube.com/vi/MtP2lyZ8jQk/maxresdefault.jpg",
    src: "https://www.youtube.com/embed/MtP2lyZ8jQk?autoplay=1&mute=1&controls=0&loop=1&playlist=MtP2lyZ8jQk&playsinline=1&modestbranding=1&rel=0",
  },
  {
    city: "Rotterdam",
    code: "RTM",
    timeZone: "Europe/Amsterdam",
    poster: "https://img.youtube.com/vi/nFozEhYTEMo/maxresdefault.jpg",
    src: "https://www.youtube.com/embed/nFozEhYTEMo?autoplay=1&mute=1&controls=0&loop=1&playlist=nFozEhYTEMo&playsinline=1&modestbranding=1&rel=0",
  },
  {
    city: "Amsterdam",
    code: "AMS",
    timeZone: "Europe/Amsterdam",
    poster: "https://www.nebelspiegel.com/images/smaller/6065.webp",
    src: "https://stream.nebelspiegel.com",
  },
  {
    city: "Tokyo",
    code: "TYO",
    timeZone: "Asia/Tokyo",
    poster: "https://img.youtube.com/vi/_k-5U7IeK8g/maxresdefault.jpg",
    src: "https://www.youtube.com/embed/_k-5U7IeK8g?autoplay=1&mute=1&controls=0&loop=1&playlist=_k-5U7IeK8g&playsinline=1&modestbranding=1&rel=0",
  },
  {
    city: "Sydney",
    code: "SYD",
    timeZone: "Australia/Sydney",
    poster: "https://img.youtube.com/vi/5uZa3-RMFos/maxresdefault.jpg",
    src: "https://www.youtube.com/embed/5uZa3-RMFos?autoplay=1&mute=1&controls=0&loop=1&playlist=5uZa3-RMFos&playsinline=1&modestbranding=1&rel=0",
  },
] as const;

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

function weatherSymbol(code: number | undefined): string {
  if (code === 95) return "⛈";
  if (code !== undefined && [51, 61, 63, 65, 80].includes(code)) return "☔";
  if (code !== undefined && [1, 2, 3, 45, 48].includes(code)) return "☁";
  return "☀";
}

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
export function LocalWidgets({
  variant = "routine",
  recommendation,
}: {
  variant?: "dashboard" | "routine";
  recommendation?: { name: string; imageUrl?: string };
}) {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locationLabel, setLocationLabel] = useState("Your location");
  const [weather, setWeather] = useState<{
    tempC: number;
    label: string;
    code: number;
  } | null>(null);
  const [workAddress, setWorkAddress] = useState("");
  const [workInput, setWorkInput] = useState("");
  const [commute, setCommute] = useState<{
    km: number;
    minutes: number;
  } | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [streamReady, setStreamReady] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [loadedCameras, setLoadedCameras] = useState<ReadonlySet<string>>(
    new Set(),
  );

  useEffect(() => {
    setNow(new Date());
    const tick = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
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
            code: typeof code === "number" ? code : -1,
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

  useEffect(() => {
    if (!CITY_STREAMS_ENABLED) return;
    const node = Array.from(
      document.querySelectorAll<HTMLElement>("[data-morning-stream-slot]"),
    ).find(
      (candidate) => window.getComputedStyle(candidate).display !== "none",
    );
    if (!node || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setStreamReady(true);
          observer.disconnect();
        }
      },
      { rootMargin: "700px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

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

  if (variant === "dashboard") {
    return (
      <section className="overflow-hidden border-b border-black/10 bg-[linear-gradient(100deg,#dce3d6_0%,#c5d0c0_58%,#aebdab_100%)] text-[var(--customer-ink)] lg:h-[100px]">
        <div className="grid h-full grid-cols-2 divide-x divide-black/10 lg:grid-cols-[1.15fr_0.55fr_1.35fr_1.45fr_1.2fr]">
          <div className="flex min-h-24 items-center gap-4 px-5 lg:min-h-0">
            <div>
              <p className="customer-kicker text-[#596157]">Local context</p>
              <p className="mt-2 text-sm text-[#2f352e]">
                {now?.toLocaleDateString(undefined, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                }) ?? "Today"}
              </p>
            </div>
            <div className="ml-auto text-right">
              <p className="font-display flex items-center justify-end gap-2 text-3xl leading-none">
                <span className="font-sans text-2xl" aria-hidden="true">
                  {weatherSymbol(weather?.code)}
                </span>
                {weather ? `${Math.round(weather.tempC)}°` : "—"}
              </p>
              <p className="mt-1 max-w-28 truncate text-xs text-[#596157]">
                {weather
                  ? `${weather.label} · ${[51, 61, 63, 65, 80, 95].includes(weather.code) ? "Rain likely" : "Dry"}`
                  : locationLabel}
              </p>
            </div>
          </div>

          <div className="flex min-h-24 flex-col justify-center px-5 lg:min-h-0">
            <p className="customer-kicker text-[#596157]">Here & now</p>
            <p className="font-display mt-2 text-2xl tabular-nums leading-none">
              {now?.toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              }) ?? "—"}
            </p>
          </div>

          <div className="col-span-2 flex min-h-24 items-center px-5 lg:col-span-1 lg:min-h-0">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                saveWorkAddress(workInput.trim());
              }}
              className="w-full"
            >
              <p className="customer-kicker text-[#596157]">Leave well</p>
              <div className="mt-2 flex items-center gap-2 border-b border-black/25 pb-1">
                <input
                  aria-label="Work address"
                  value={workInput}
                  onChange={(event) => setWorkInput(event.target.value)}
                  placeholder="Work address"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#596157]"
                />
                <button
                  type="submit"
                  className="customer-kicker text-[#31372f]"
                >
                  Save
                </button>
              </div>
              <p className="mt-1 truncate text-[10px] text-[#596157]">
                {commute
                  ? `About ${commute.minutes} min · ${commute.km} km`
                  : workAddress
                    ? `Finding ${workAddress}…`
                    : "Personal estimate · no live traffic"}
              </p>
            </form>
          </div>

          <div className="col-span-2 hidden min-h-24 items-center gap-4 px-5 lg:col-span-1 lg:min-h-0 xl:flex">
            <p className="customer-kicker shrink-0 text-[#596157]">Elsewhere</p>
            <div className="grid flex-1 grid-cols-3 gap-x-3 gap-y-1">
              {WORLD_CLOCKS.map((clock) => (
                <p
                  key={clock.city}
                  className="min-w-0 text-[10px] text-[#596157]"
                >
                  <span className="block truncate">{clock.city}</span>
                  <span className="block font-medium tabular-nums text-[#222720]">
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

          <div className="relative col-span-2 hidden overflow-hidden bg-white/20 lg:col-span-1 lg:flex">
            {CITY_STREAMS_ENABLED && streamReady && isDesktop ? (
              <div className="absolute inset-0 grid grid-cols-3 gap-px bg-[#c5d0c0]">
                {CITY_CAMERAS.slice(0, 3).map((camera) => (
                  <iframe
                    key={camera.code}
                    title={`${camera.city} live camera`}
                    src={camera.src}
                    className="h-full w-full border-0 object-cover opacity-80"
                    allow="autoplay; fullscreen"
                  />
                ))}
              </div>
            ) : recommendation?.imageUrl ? (
              <Image
                src={recommendation.imageUrl}
                alt=""
                fill
                unoptimized
                className="object-contain object-right"
              />
            ) : null}
            <div className="relative z-10 flex max-w-[70%] flex-col justify-end px-4 py-3 text-white [text-shadow:0_1px_12px_rgba(0,0,0,.7)]">
              <p className="customer-kicker text-[#596157]">Today’s look</p>
              <p className="mt-2 line-clamp-2 text-xs leading-4 text-[#2b302a]">
                {recommendation?.name ?? "A considered recommendation"}
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden bg-[#171613] text-[#f6f2e9] shadow-[0_24px_70px_rgba(31,27,20,0.12)]">
      <div className="lg:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.6fr)]">
        <div className="grid lg:min-h-[34rem] lg:grid-rows-[1fr_auto]">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
            <div className="relative min-h-[290px] overflow-hidden border-b border-white/10 p-6 sm:p-8 lg:border-b-0 lg:border-r">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(187,157,105,0.25),transparent_38%),linear-gradient(135deg,#2a2924,#171613_70%)]" />
              <div className="relative flex h-full flex-col justify-between">
                <div className="flex items-center justify-between">
                  <p className="font-accent text-[10px] uppercase tracking-[0.22em] text-[#c9b890]">
                    Morning instrument
                  </p>
                  <span className="rounded-full border border-white/15 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-white/60">
                    Local context
                  </span>
                </div>
                <div>
                  <p className="font-accent text-xs uppercase tracking-[0.16em] text-white/50">
                    Weather · {locationLabel}
                  </p>
                  {weather ? (
                    <p className="font-display mt-3 text-6xl tracking-[-0.04em] text-white">
                      {Math.round(weather.tempC)}°
                      <span className="ml-3 text-xl font-normal tracking-normal text-white/55">
                        {weather.label}
                      </span>
                    </p>
                  ) : (
                    <p className="font-display mt-3 max-w-sm text-3xl leading-tight text-white">
                      Set the scene for your day.
                    </p>
                  )}
                  <p className="mt-3 max-w-sm text-sm leading-6 text-white/55">
                    {weather
                      ? "A quiet read on the conditions before you step out."
                      : "Allow location access for local weather. Nothing is stored without consent."}
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-px bg-white/10">
              <div className="bg-[#1d1c19] p-5">
                <p className="font-accent text-[10px] uppercase tracking-[0.16em] text-white/45">
                  Local time
                </p>
                <p className="font-display mt-4 text-3xl">
                  {now?.toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                  }) ?? "—"}
                </p>
                <p className="mt-1 text-xs text-white/45">
                  {now?.toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  }) ?? ""}
                </p>
              </div>
              <div className="bg-[#1d1c19] p-5">
                <p className="font-accent text-[10px] uppercase tracking-[0.16em] text-white/45">
                  Drive to work
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveWorkAddress(workInput.trim());
                  }}
                  className="mt-3 flex gap-1"
                >
                  <input
                    value={workInput}
                    onChange={(e) => setWorkInput(e.target.value)}
                    placeholder="Work address"
                    className="w-full min-w-0 border-b border-white/20 bg-transparent px-0 py-1 text-xs text-white outline-none placeholder:text-white/35"
                  />
                  <button type="submit" className="text-xs text-[#c9b890]">
                    Set
                  </button>
                </form>
                {commute ? (
                  <p className="font-display mt-4 text-3xl">
                    ~{commute.minutes}
                    <span className="ml-1 text-sm font-normal text-white/50">
                      min
                    </span>
                  </p>
                ) : (
                  <p className="mt-4 text-xs leading-5 text-white/45">
                    {workAddress
                      ? `Locating ${workAddress}…`
                      : "Estimated distance · no live traffic"}
                  </p>
                )}
              </div>
              <div className="col-span-2 bg-[#1d1c19] p-5">
                <p className="font-accent text-[10px] uppercase tracking-[0.16em] text-white/45">
                  World clock
                </p>
                <div className="mt-4 grid grid-cols-3 gap-x-4 gap-y-3">
                  {WORLD_CLOCKS.map((clock) => (
                    <p key={clock.city} className="flex flex-col gap-1">
                      <span className="text-xs text-white/45">
                        {clock.city}
                      </span>
                      <span className="text-sm font-medium">
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
          </div>
          <div
            data-morning-stream-slot
            className="relative border-t border-white/10 bg-black lg:hidden"
          >
            {CITY_STREAMS_ENABLED && streamReady && !isDesktop ? (
              <iframe
                title="Live city stream"
                src="https://stream.nebelspiegel.com"
                className="h-52 w-full border-0 opacity-80 lg:h-56"
                allow="autoplay; fullscreen"
              />
            ) : (
              <div className="flex h-32 items-center justify-between px-6">
                <div>
                  <p className="font-accent text-[10px] uppercase tracking-[0.18em] text-[#c9b890]">
                    City signal
                  </p>
                  <p className="mt-2 text-sm text-white/55">
                    Live streams are temporarily paused.
                  </p>
                </div>
                <span className="text-xs text-white/35">Stream · paused</span>
              </div>
            )}
          </div>
        </div>
        <div
          data-morning-stream-slot
          className="relative hidden min-h-[22rem] border-t border-white/10 bg-black lg:block lg:min-h-0 lg:border-l lg:border-t-0"
        >
          {CITY_STREAMS_ENABLED && streamReady && isDesktop ? (
            <iframe
              title="Live city stream desktop"
              src="https://stream.nebelspiegel.com"
              className="absolute inset-0 h-full w-full border-0 opacity-80"
              allow="autoplay; fullscreen"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col justify-between bg-[radial-gradient(circle_at_68%_22%,rgba(187,157,105,0.2),transparent_35%),linear-gradient(145deg,#25241f,#11110f)] p-7">
              <div className="flex items-center justify-between">
                <p className="font-accent text-[10px] uppercase tracking-[0.2em] text-[#c9b890]">
                  City signal
                </p>
                <span className="text-xs text-white/35">Stream · paused</span>
              </div>
              <p className="font-display max-w-xs text-3xl leading-tight text-white">
                A city window, held beside your day.
              </p>
            </div>
          )}
          {CITY_STREAMS_ENABLED ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/65 to-transparent px-7 pb-6 pt-16">
              <p className="font-accent text-[10px] uppercase tracking-[0.18em] text-white/70">
                Nebel &amp; Spiegel / city desk
              </p>
              <span className="text-xs text-white/50">Live view</span>
            </div>
          ) : null}
        </div>
      </div>
      <div className="border-t border-white/10 bg-[#12110f] px-5 py-6 sm:px-8 lg:px-10">
        <div className="mb-4 flex items-center justify-between gap-4">
          <p className="font-accent text-[10px] uppercase tracking-[0.2em] text-[#c9b890]">
            City cameras
          </p>
          <p className="text-xs text-white/45">
            Live streams temporarily paused
          </p>
        </div>
        <div className="flex snap-x gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
          {CITY_CAMERAS.map((camera) => (
            <article
              key={camera.code}
              className="w-[15rem] shrink-0 snap-start overflow-hidden rounded-2xl bg-white/[0.07] sm:w-[18rem]"
            >
              <div className="relative aspect-video bg-black">
                <Image
                  src={camera.poster}
                  alt={`${camera.city} camera preview`}
                  fill
                  unoptimized
                  className="object-cover opacity-65"
                />
                {CITY_STREAMS_ENABLED && streamReady ? (
                  <iframe
                    title={`${camera.city} live camera`}
                    src={camera.src}
                    loading="lazy"
                    onLoad={() =>
                      setLoadedCameras(
                        (current) => new Set([...current, camera.code]),
                      )
                    }
                    className={`absolute inset-0 h-full w-full border-0 transition-opacity duration-500 ${loadedCameras.has(camera.code) ? "opacity-85" : "opacity-0"}`}
                    allow="autoplay; fullscreen"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                )}
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <p className="text-sm font-medium text-white">{camera.city}</p>
                <p className="text-sm tabular-nums text-white/60">
                  {now?.toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: camera.timeZone,
                  }) ?? "—"}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
