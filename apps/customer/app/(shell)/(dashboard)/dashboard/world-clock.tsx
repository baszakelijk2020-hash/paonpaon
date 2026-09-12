"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import { HlsVideo } from "./hls-video";

import "./overview.css";

/**
 * The founder's live city-feed widget, ported into the overview's bento
 * system: one large feed panel with telemetry overlays, a huge local
 * readout, and a strip of cities that each carry their own local time.
 *
 * Deviations from the original standalone widget, on purpose:
 * - Only the selected city runs an iframe. The original mounts five at once,
 *   which costs five live video players on every dashboard visit.
 * - Weather comes from Open-Meteo (keyless) rather than OpenWeatherMap, so
 *   no API key ships to the browser.
 */

type WorldCity = {
  code: string;
  name: string;
  country: string;
  timeZone: string;
  lat: number;
  lon: number;
  poster?: string;
  /** Direct stream cities are not YouTube embeds. */
  streamUrl?: string;
  /** Raw HLS camera, played by hls.js rather than an embed. */
  hlsUrl?: string;
  youtubeId?: string;
  /**
   * Crop transform, carried over from the original widget's per-city CSS
   * variables. Scaling the iframe past its frame pushes YouTube's own chrome
   * — the title bar, the controls, the watermark — outside the visible area,
   * which is the only reliable way to hide it on an embed.
   */
  frame?: {
    scale: number;
    x: string;
    y: string;
    rotate?: string;
    skewX?: string;
  };
};

const WORLD_CITIES: readonly WorldCity[] = [
  {
    code: "NYC",
    name: "New York",
    country: "USA",
    timeZone: "America/New_York",
    lat: 40.71,
    lon: -74.01,
    poster: "https://img.youtube.com/vi/5C9oM7C2Q9k/maxresdefault.jpg",
    youtubeId: "5C9oM7C2Q9k",
    frame: { scale: 1.6, x: "6%", y: "-4%" },
  },
  {
    code: "RTM",
    name: "Rotterdam",
    country: "NL",
    timeZone: "Europe/Amsterdam",
    lat: 51.92,
    lon: 4.48,
    poster: "https://img.youtube.com/vi/nFozEhYTEMo/maxresdefault.jpg",
    youtubeId: "nFozEhYTEMo",
    frame: {
      scale: 2.0,
      x: "12%",
      y: "18%",
      rotate: "0.9deg",
      skewX: "0.5deg",
    },
  },
  {
    code: "AMS",
    name: "Amsterdam",
    country: "NL",
    timeZone: "Europe/Amsterdam",
    lat: 52.37,
    lon: 4.89,
    hlsUrl: "https://bouwapp.bouw.live/zuidasdok-wtc.m3u8",
  },
  {
    code: "TYO",
    name: "Tokyo",
    country: "JPN",
    timeZone: "Asia/Tokyo",
    lat: 35.68,
    lon: 139.69,
    poster: "https://img.youtube.com/vi/_k-5U7IeK8g/maxresdefault.jpg",
    youtubeId: "_k-5U7IeK8g",
    frame: { scale: 1.33, x: "-4%", y: "2%" },
  },
  {
    code: "SYD",
    name: "Sydney",
    country: "AUS",
    timeZone: "Australia/Sydney",
    lat: -33.87,
    lon: 151.21,
    poster: "https://img.youtube.com/vi/5uZa3-RMFos/maxresdefault.jpg",
    youtubeId: "5uZa3-RMFos",
    frame: { scale: 1.65, x: "20%", y: "8%", rotate: "0.5deg" },
  },
];

/** Tokyo, as in the original widget. */
const DEFAULT_CITY_INDEX = 3;
const WEATHER_TTL_MS = 30 * 60_000;

type CityWeather = { tempC: number; code: number; isDay: boolean };

const WEATHER_LABELS: Record<number, string> = {
  0: "Clear sky",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Freezing fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  80: "Rain showers",
  81: "Rain showers",
  82: "Violent showers",
  95: "Thunderstorm",
  96: "Thunderstorm",
  99: "Thunderstorm",
};

function weatherLabel(code: number | undefined): string {
  if (code === undefined) return "Conditions unavailable";
  return WEATHER_LABELS[code] ?? "Cloudy";
}

function weatherSymbol(weather: CityWeather | null): string {
  if (!weather) return "·";
  const { code, isDay } = weather;
  if (code >= 95) return "⛈";
  if (code >= 71 && code <= 77) return "❄";
  if (code >= 51 && code <= 82) return "☔";
  if (code >= 45 && code <= 48) return "≡";
  if (code >= 1 && code <= 3) return isDay ? "⛅" : "☁";
  return isDay ? "☀" : "☾";
}

function frameTransform(city: WorldCity): string {
  const frame = city.frame;
  if (!frame) return "translate(-50%, -50%)";
  return [
    `translate(calc(-50% + ${frame.x}), calc(-50% + ${frame.y}))`,
    `scale(${frame.scale})`,
    frame.rotate ? `rotate(${frame.rotate})` : "",
    frame.skewX ? `skewX(${frame.skewX})` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function embedUrl(city: WorldCity): string {
  if (city.streamUrl) return city.streamUrl;
  const url = new URL(`https://www.youtube.com/embed/${city.youtubeId}`);
  const params: Record<string, string> = {
    autoplay: "1",
    mute: "1",
    controls: "0",
    loop: "1",
    playlist: city.youtubeId ?? "",
    playsinline: "1",
    modestbranding: "1",
    rel: "0",
    iv_load_policy: "3",
    fs: "0",
    disablekb: "1",
    vq: "hd720",
  };
  for (const [key, value] of Object.entries(params))
    url.searchParams.set(key, value);
  return url.href;
}

/**
 * Chip thumbnails run the real stream rather than YouTube's poster image:
 * the posters are branded title cards ("ERASMUSBRUG LIVE", "tokyo bay 4K")
 * and hqdefault is 4:3, so it letterboxes with black bars. Each chip loads,
 * paints a real frame, then pauses — same trick as the original widget.
 */
function thumbEmbedUrl(city: WorldCity): string {
  return embedUrl(city);
}

export function WorldClock() {
  const [now, setNow] = useState<Date | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(DEFAULT_CITY_INDEX);
  const [weatherByCity, setWeatherByCity] = useState<
    Record<string, CityWeather>
  >({});
  const [live, setLive] = useState(false);
  const [inView, setInView] = useState(false);
  const [mountedChips, setMountedChips] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [mountedFrames, setMountedFrames] = useState<ReadonlySet<string>>(
    new Set(),
  );

  const sectionRef = useRef<HTMLElement>(null);
  const weatherFetchedAt = useRef<Map<string, number>>(new Map());

  const city = WORLD_CITIES[selectedIndex] ?? WORLD_CITIES[DEFAULT_CITY_INDEX]!;
  const weather = weatherByCity[city.code] ?? null;

  useEffect(() => {
    setNow(new Date());
    const tick = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(tick);
  }, []);

  // The feed is heavy, so it only exists once the module is near the
  // viewport — and it never autostarts for reduced-motion viewers.
  useEffect(() => {
    const node = sectionRef.current;
    if (!node || !("IntersectionObserver" in window)) {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setInView(Boolean(entry?.isIntersecting)),
      { rootMargin: "600px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!inView) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setLive(true);
  }, [inView]);

  /**
   * Every city's player is mounted and kept mounted, exactly as the original
   * widget does it. Switching city then toggles which one is visible — an
   * instant cut. Mounting only the selected city looks cheaper but makes every
   * click a fresh iframe, and YouTube spends seconds handshaking before it
   * paints. They are staggered on the way in so five players never negotiate
   * at once.
   */
  useEffect(() => {
    if (!live) return;
    const timers = WORLD_CITIES.map((item, index) =>
      window.setTimeout(
        () => setMountedFrames((previous) => new Set([...previous, item.code])),
        index * 500,
      ),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [live]);

  // Chips stay playing rather than pausing after a beat: a paused YouTube
  // frame uncovers the player's own end-card and play button, which is the
  // branding the live thumbnails existed to avoid.
  useEffect(() => {
    if (!inView) return;
    const timers = WORLD_CITIES.map((item, index) =>
      window.setTimeout(
        () => setMountedChips((previous) => new Set([...previous, item.code])),
        index * 700,
      ),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [inView]);

  const loadWeather = useCallback(async (target: WorldCity) => {
    const lastFetch = weatherFetchedAt.current.get(target.code) ?? 0;
    if (Date.now() - lastFetch < WEATHER_TTL_MS) return;
    weatherFetchedAt.current.set(target.code, Date.now());
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${target.lat}&longitude=${target.lon}&current=temperature_2m,weather_code,is_day`,
      );
      if (!res.ok) throw new Error("weather unavailable");
      const data = (await res.json()) as {
        current?: {
          temperature_2m?: number;
          weather_code?: number;
          is_day?: number;
        };
      };
      const current = data.current;
      if (current?.temperature_2m === undefined) throw new Error("no reading");
      setWeatherByCity((previous) => ({
        ...previous,
        [target.code]: {
          tempC: current.temperature_2m as number,
          code: current.weather_code ?? 0,
          isDay: current.is_day !== 0,
        },
      }));
    } catch {
      // The overlay degrades to the city name alone; retry on next select.
      weatherFetchedAt.current.delete(target.code);
    }
  }, []);

  useEffect(() => {
    if (!inView) return;
    void loadWeather(city);
  }, [city, inView, loadWeather]);

  return (
    <section
      ref={sectionRef}
      className="paon-world-module"
      aria-label="World clock"
    >
      <div className={["paon-world-stage", live ? "is-live" : ""].join(" ")}>
        {live ? (
          WORLD_CITIES.map((item) => {
            if (!mountedFrames.has(item.code)) return null;
            const frameClass = [
              "paon-world-frame",
              item.code === city.code ? "is-active" : "",
            ].join(" ");
            return item.hlsUrl ? (
              <HlsVideo
                key={item.code}
                className={frameClass}
                title={`${item.name} live view`}
                src={item.hlsUrl}
                style={{ transform: frameTransform(item) }}
              />
            ) : (
              <iframe
                key={item.code}
                className={frameClass}
                title={`${item.name} live view`}
                src={embedUrl(item)}
                allow="autoplay; encrypted-media; picture-in-picture"
                referrerPolicy="strict-origin-when-cross-origin"
                style={{ transform: frameTransform(item) }}
              />
            );
          })
        ) : city.poster ? (
          <Image
            src={city.poster}
            alt={`${city.name} live view preview`}
            fill
            unoptimized
            sizes="100vw"
          />
        ) : (
          <p className="paon-world-placeholder">{city.code}</p>
        )}

        {/* The card is the feed; this floating panel carries the reading. */}
        <div className="paon-world-badge">
          <p className="paon-world-badge-temp">
            <span className="paon-world-badge-symbol" aria-hidden="true">
              {weatherSymbol(weather)}
            </span>
            {weather ? `${Math.round(weather.tempC)}°C` : "--°C"}
          </p>
          <div className="paon-world-badge-meta">
            <strong>{city.name}</strong>
            <span>
              {now
                ? new Intl.DateTimeFormat("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hourCycle: "h23",
                    timeZone: city.timeZone,
                  }).format(now)
                : "--:--"}
              {" · "}
              {weather ? weatherLabel(weather.code) : "Loading"}
            </span>
          </div>
        </div>
      </div>
      <div
        className="paon-world-strip"
        role="tablist"
        aria-label="Cities"
        data-no-press
      >
        {WORLD_CITIES.map((item, index) => (
          <button
            key={item.code}
            type="button"
            role="tab"
            aria-selected={index === selectedIndex}
            className="paon-world-chip"
            onClick={() => setSelectedIndex(index)}
          >
            <span className="paon-world-chip-thumb">
              {mountedChips.has(item.code) && item.hlsUrl ? (
                <HlsVideo
                  className="paon-world-chip-frame"
                  title={`${item.name} thumbnail`}
                  src={item.hlsUrl}
                  style={{ transform: frameTransform(item) }}
                />
              ) : mountedChips.has(item.code) ? (
                <iframe
                  className="paon-world-chip-frame"
                  title={`${item.name} thumbnail`}
                  tabIndex={-1}
                  src={thumbEmbedUrl(item)}
                  allow="autoplay; encrypted-media"
                  referrerPolicy="strict-origin-when-cross-origin"
                  style={{ transform: frameTransform(item) }}
                />
              ) : (
                <span className="paon-world-placeholder" aria-hidden="true">
                  {item.code}
                </span>
              )}
            </span>
            <span className="paon-world-chip-code">{item.code}</span>
            <span className="paon-world-chip-time">
              {now
                ? new Intl.DateTimeFormat("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hourCycle: "h23",
                    timeZone: item.timeZone,
                  }).format(now)
                : "--:--"}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
