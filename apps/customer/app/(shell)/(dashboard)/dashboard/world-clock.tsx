"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { usePaonEnvironment } from "../../environment-store";

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
    /* Zoomed out 20% from the original widget's 2.0: the bridge was cropped
       too tight. 1.6 still covers the stage and still pushes the player's
       own chrome off the top. */
    frame: {
      scale: 1.6,
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
    /* 20% out from the original 1.33. */
    frame: { scale: 1.064, x: "-4%", y: "2%" },
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
    /* 15% out from the original 1.65, then 10% back in. */
    frame: { scale: 1.54, x: "20%", y: "8%", rotate: "0.5deg" },
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

/** The large viewer shows every stream 20% further out than its chip. */
const STAGE_ZOOM_OUT = 0.8;

/**
 * The smallest scale at which a frame still covers the stage.
 *
 * The morning stylesheet sizes the iframe to cover at 120% of the stage on
 * its tighter axis, so the stage is at most 0.833 of the frame's width and
 * of its height, whatever the stage's shape. (It was 1.6× the width for the
 * original 4:3 stage, and a bound of 0.625 across then; kept, that left a
 * black strip down the side of any stream shifted sideways, Tokyo's and
 * Sydney's.) Scaled about its centre and then shifted by its own x/y (a
 * percentage of its unscaled size), it keeps covering only while
 * s ≥ 0.833 + 2|x| across and s ≥ 0.833 + 2|y| down. A little is added for
 * the rotations and skews some cities carry.
 */
function stageCoverScale(frame: NonNullable<WorldCity["frame"]>): number {
  const x = Math.abs(parseFloat(frame.x)) / 100;
  const y = Math.abs(parseFloat(frame.y)) / 100;
  return 0.8333 + 2 * Math.max(x, y) + 0.03;
}

/**
 * The crop transform for a stream. `onStage` zooms it out for the large
 * viewer — never past the point where the picture stops covering the stage,
 * because a black band is worse than a tighter crop.
 */
function frameTransform(city: WorldCity, onStage = false): string {
  const frame = city.frame;
  if (!frame) return "translate(-50%, -50%)";
  const scale = onStage
    ? Math.max(frame.scale * STAGE_ZOOM_OUT, stageCoverScale(frame))
    : frame.scale;
  return [
    `translate(calc(-50% + ${frame.x}), calc(-50% + ${frame.y}))`,
    `scale(${scale.toFixed(3)})`,
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
    /*
     * No `loop`/`playlist`.
     *
     * Those two turn the embed into a one-video playlist that restarts when
     * it ends — which is meaningless for a camera that never ends, and is
     * read by the player as a cue to re-seek. Pressing play on a looped live
     * embed made it jump and re-buffer, which is the flicker. A live stream
     * simply runs.
     */
    playsinline: "1",
    modestbranding: "1",
    rel: "0",
    iv_load_policy: "3",
    fs: "0",
    disablekb: "1",
    vq: "hd720",
    // The viewer's pause button drives every player over postMessage.
    enablejsapi: "1",
  };
  if (typeof window !== "undefined") params.origin = window.location.origin;
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
  const [nearViewport, setNearViewport] = useState(false);
  /* The overview is also pre-rendered behind the storefront so switching to
     the Wardrobe is instant. Covered there, it still intersects the
     viewport, so without this its six players loaded under the store's home
     grid and starved it. */
  const environment = usePaonEnvironment(usePathname());
  const inView = nearViewport && environment === "customer";
  /* Paused by default: the overview opens on a still frame of every city
     rather than five players negotiating at once. The viewer presses play
     when they want the cameras running. */
  const [paused, setPaused] = useState(true);
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
      setNearViewport(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setNearViewport(Boolean(entry?.isIntersecting)),
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

  // The chips mount on their own stagger, then follow the stage: one pause
  // button holds all six players — the stage and the five thumbnails — and
  // one play releases them together.
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

  /**
   * One button, every player in the module: the stage AND the five city
   * thumbnails. Pause holds them all where they are.
   *
   * Play is not symmetrical with it. The stage carries all five cities
   * stacked and shows one — the other four sit at `visibility: hidden`, and
   * a hidden YouTube player decodes exactly as hard as a visible one. Playing
   * the lot meant ten live decoders fighting for the machine, and the picture
   * you were actually looking at stuttered for it. Only the city on show
   * plays; the four behind it stay held, and are released the moment they are
   * brought forward.
   */
  const playableFrames = useCallback(() => {
    const root = sectionRef.current;
    if (!root) return [];
    return [...root.querySelectorAll<HTMLIFrameElement>("iframe")].filter(
      (frame) =>
        !frame.classList.contains("paon-world-frame") ||
        frame.classList.contains("is-active"),
    );
  }, []);

  const applyPause = useCallback(
    (next: boolean) => {
      const root = sectionRef.current;
      if (!root) return;
      const wanted = next
        ? [...root.querySelectorAll<HTMLIFrameElement>("iframe")]
        : playableFrames();
      /* On play, everything that is NOT playable is held rather than left to
       its own autoplay — a stage frame that was never on show has been
       running since it mounted. */
      if (!next) {
        for (const frame of root.querySelectorAll<HTMLIFrameElement>(
          "iframe",
        )) {
          if (wanted.includes(frame)) continue;
          frame.contentWindow?.postMessage(
            JSON.stringify({ event: "command", func: "pauseVideo", args: [] }),
            "*",
          );
        }
      }
      for (const frame of wanted) {
        const send = (func: string, args: unknown[] = []) =>
          frame.contentWindow?.postMessage(
            JSON.stringify({ event: "command", func, args }),
            "*",
          );
        if (next) {
          send("pauseVideo");
        } else {
          /*
           * Play, and nothing else.
           *
           * This used to seek to a number past any live head first, to land
           * the player back on "now". A YouTube live player answers that by
           * tearing its buffer down and re-handshaking, which is the twitch
           * and flicker you see on every press — and it is unnecessary: a
           * paused live player already resumes at the edge on its own.
           */
          send("playVideo");
        }
      }
    },
    [playableFrames],
  );

  const toggleStreams = useCallback(() => {
    const next = !paused;
    setPaused(next);
    applyPause(next);
  }, [applyPause, paused]);

  /* Switching city while the streams run hands the picture to a player that
     was being held. Re-applying play releases the new one and holds the old.

     Only on an actual change of city: it used to run on every change of
     `paused` too, so a press of play sent the active player two playVideo
     commands 60ms apart and it re-buffered between them. */
  const lastCity = useRef(selectedIndex);
  useEffect(() => {
    const changed = lastCity.current !== selectedIndex;
    lastCity.current = selectedIndex;
    if (paused || !changed) return;
    const settle = window.setTimeout(() => applyPause(false), 60);
    return () => window.clearTimeout(settle);
  }, [applyPause, paused, selectedIndex]);

  /* Players mount on a stagger and every embed carries autoplay=1, so one
     that arrives while the viewer is paused would start on its own. Re-send
     the hold whenever either set grows — this is also what holds the default
     paused state as the six players come up. */
  useEffect(() => {
    if (!paused) return;
    applyPause(true);
    /* A YouTube embed ignores postMessage until its player has finished
       booting, which is well after the iframe is in the document and can take
       a few seconds on a cold load. One command on insert is therefore not
       enough — keep re-sending the hold for a few seconds so every player
       catches it whenever it happens to become ready. */
    let sent = 0;
    const settle = window.setInterval(() => {
      applyPause(true);
      if (++sent >= 10) window.clearInterval(settle);
    }, 800);
    return () => window.clearInterval(settle);
  }, [applyPause, mountedChips, mountedFrames, paused]);

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
      {/* The module names itself, under the rule that closes the greeting
          above it — the same small voice the readings strip and the STORE /
          WARDROBE toggle use. */}
      <h2 className="paon-world-heading">World clock</h2>
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
                style={{ transform: frameTransform(item, true) }}
                /* Held unless it is the city on show — see applyPause. */
                paused={paused || item.code !== city.code}
              />
            ) : (
              <iframe
                key={item.code}
                className={frameClass}
                title={`${item.name} live view`}
                src={embedUrl(item)}
                allow="autoplay; encrypted-media; picture-in-picture"
                referrerPolicy="strict-origin-when-cross-origin"
                style={{ transform: frameTransform(item, true) }}
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

        {/* Shown on hover, and kept shown while paused. One glyph turns
            into the other: the bars fold into the triangle. */}
        {live ? (
          <button
            type="button"
            className={["paon-world-pause", paused ? "is-paused" : ""].join(
              " ",
            )}
            aria-label={paused ? "Play all streams" : "Pause all streams"}
            aria-pressed={paused}
            data-no-press
            onClick={toggleStreams}
          >
            <span className="paon-world-pause-glyph" aria-hidden="true">
              <svg className="paon-world-pause-bars" viewBox="0 0 24 24">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
              <svg className="paon-world-pause-play" viewBox="0 0 24 24">
                <path d="M8 5.2v13.6l11.2-6.8z" />
              </svg>
            </span>
          </button>
        ) : null}

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
            {/* The city and its local time read first, then the view:
                the strip is a list of cities that happens to carry
                pictures, not a row of pictures that happens to be
                labelled. */}
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
            <span className="paon-world-chip-thumb">
              {mountedChips.has(item.code) && item.hlsUrl ? (
                <HlsVideo
                  className="paon-world-chip-frame"
                  title={`${item.name} thumbnail`}
                  src={item.hlsUrl}
                  style={{ transform: frameTransform(item) }}
                  paused={paused}
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
              {/* The chip is the live view of its city, and it holds the
                  same still the stage does when the viewer pauses: one
                  button, six players. */}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
