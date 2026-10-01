"use client";

import Image from "next/image";
import Link from "next/link";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { SunIcon, WeatherIcon } from "../dashboard/stat-icons";

import {
  GUEST_COMMUTE_MINUTES,
  HOME_LOCATION,
  useHomeLocation,
} from "./home-location";

const CITY_STREAMS_ENABLED = true;

const WORLD_CLOCKS = [
  { city: "New York", timeZone: "America/New_York" },
  { city: "London", timeZone: "Europe/London" },
  { city: "Dubai", timeZone: "Asia/Dubai" },
  { city: "Hong Kong", timeZone: "Asia/Hong_Kong" },
  { city: "Tokyo", timeZone: "Asia/Tokyo" },
  { city: "Sydney", timeZone: "Australia/Sydney" },
] as const;

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

interface Coords {
  lat: number;
  lon: number;
}

export const WORK_ADDRESS_STORAGE_KEY = "paon-work-address";
export const HOME_ADDRESS_STORAGE_KEY = "paon-home-address";

/** Within this distance of home or of work, the customer is taken to be there. */
const NEAR_KM = 1;
/** Away from both, the drive shown turns homeward from this hour on. */
const HOMEWARD_FROM_HOUR = 14;
/** How often the live drive time is read again. */
const COMMUTE_REFRESH_MS = 5 * 60_000;

// Re-exported: the watch face and the sky cards import the home base from here.
export { HOME_LOCATION } from "./home-location";

/**
 * The province or state, two letters, from a Nominatim reverse lookup.
 *
 * It prefers the ISO 3166-2 subdivision code the API returns — NL-NB, DE-BY,
 * US-NY — and takes the half after the dash, which is the code a local would
 * write. Where the API has no code it makes one from the initials of the
 * state's name, so "Noord-Brabant" still comes back NB.
 */
function regionCode(address: Record<string, unknown> | undefined): string {
  const iso = address?.["ISO3166-2-lvl4"];
  if (typeof iso === "string" && iso.includes("-"))
    return iso.slice(iso.indexOf("-") + 1).toUpperCase();
  const state = address?.state;
  if (typeof state !== "string") return "";
  return state
    .split(/[\s-]+/)
    .map((word) => word[0] ?? "")
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

/** "Breda, NB" — the city, and the province after it. */
function placeLabel(city: string, region: string): string {
  return region ? `${city}, ${region}` : city;
}
export const DEFAULT_WORK_ADDRESS = HOME_LOCATION.workAddress;

/**
 * Where the car photograph's ink ends, as a fraction of the file's height.
 * Measured off /images/front-car.png: it fills the file across but carries
 * 12% of clear film above and below, so its box bottom is not where the car
 * is. A raster has no getBBox, hence the constant.
 */
const CAR_INK_BOTTOM = 0.879;

/**
 * How far above the car's line the sky glyph's body stands: none — the two
 * marks share one baseline. (A 3px lift once stood here, asked for while the
 * glyph was visibly 3px low. That low was the re-run bug below, fixed at the
 * same time, so the lift double-corrected and left the cloud 3px high.)
 */
const SKY_LIFT_PX = 0;

/**
 * Driving time now. Live — the road network with current traffic — through
 * /api/commute when the server holds a traffic key; otherwise a real road
 * route from OSRM (keyless, no traffic); a straight-line estimate only if
 * neither answers.
 */
async function driveTime(
  from: Coords,
  to: Coords,
): Promise<{ km: number; minutes: number; routed: boolean; live: boolean }> {
  try {
    const res = await fetch(
      `/api/commute?from=${from.lat},${from.lon}&to=${to.lat},${to.lon}`,
      { cache: "no-store" },
    );
    if (res.status === 200) {
      const live = (await res.json()) as { minutes?: number; km?: number };
      if (typeof live.minutes === "number")
        return {
          km: live.km ?? 0,
          minutes: live.minutes,
          routed: true,
          live: true,
        };
    }
  } catch {
    // No live source; the road route below.
  }
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false`,
    );
    const data = (await res.json()) as {
      routes?: { duration: number; distance: number }[];
    };
    const route = data.routes?.[0];
    if (route) {
      return {
        km: Math.round(route.distance / 100) / 10,
        minutes: Math.max(1, Math.round(route.duration / 60)),
        routed: true,
        live: false,
      };
    }
  } catch {
    // Router unreachable — estimate below.
  }
  const km = haversineKm(from, to);
  return {
    km: Math.round(km * 10) / 10,
    minutes: Math.max(4, Math.round((km / 28) * 60)),
    routed: false,
    live: false,
  };
}

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

/** The hour, 0–23, at the customer's home — the clock the overview keeps. */
function homeHour(date: Date, timeZone: string): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone,
    }).format(date),
  );
}

/**
 * Which drive the commute reading shows, and from where.
 *
 * Within a kilometre of home the customer is at home, so it is the drive to
 * work; within a kilometre of work, the drive home. Anywhere else — or with
 * no location at all — the time of day decides: before two in the afternoon
 * the drive to work, from two on the drive home. It starts from where the
 * customer is when that is known, and from the other end of the commute
 * when it is not.
 */
export function commuteLeg(
  here: Coords | null,
  home: Coords,
  work: Coords,
  now: Date,
  timeZone: string = HOME_LOCATION.timeZone,
): { from: Coords; to: "work" | "home" } {
  if (here && haversineKm(here, home) <= NEAR_KM)
    return { from: here, to: "work" };
  if (here && haversineKm(here, work) <= NEAR_KM)
    return { from: here, to: "home" };
  return homeHour(now, timeZone) >= HOMEWARD_FROM_HOUR
    ? { from: here ?? work, to: "home" }
    : { from: here ?? home, to: "work" };
}

export function formatCommuteMinutes(minutes: number): string {
  if (minutes <= 60) return `${minutes}m`;
  if (minutes > 24 * 60) return `${Math.round(minutes / (24 * 60))}d`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder
    ? `${hours}h${String(remainder).padStart(2, "0")}`
    : `${hours}h`;
}

async function geocode(address: string): Promise<Coords | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`,
      { headers: { Accept: "application/json" } },
    );
    const hit = (await res.json())?.[0];
    return hit ? { lat: Number(hit.lat), lon: Number(hit.lon) } : null;
  } catch {
    return null;
  }
}

/**
 * Weather via Open-Meteo, geocoding via OSM Nominatim, driving time via
 * OSRM — all free and keyless. The drive time is a real road-network route;
 * it does not include live congestion, which no keyless service provides.
 */
export function LocalWidgets({
  variant = "routine",
  skyExtras,
}: {
  variant?: "dashboard" | "routine";
  /** The real daily MorningRoutine selection, shown only as an image in
   * the rightmost strip cell — no text, no greeting (contract §4). */
  recommendation?: { name: string; imageUrl?: string };
  /**
   * Further sky readings (air quality, wind) rendered inside the dashboard
   * weather tile, beside the temperature. Passed in rather than imported:
   * sky-cards.tsx already imports HOME_LOCATION from this file, and pulling
   * its cards back in here would close an import cycle.
   */
  skyExtras?: ReactNode;
}) {
  const home = useHomeLocation();
  const [coords, setCoords] = useState<Coords | null>(home.coords);
  const [locationLabel, setLocationLabel] = useState<string>(
    placeLabel(home.label, home.region),
  );
  const [weather, setWeather] = useState<{
    tempC: number;
    label: string;
    code: number;
  } | null>(null);
  // The forecast remains opt-in until the browser has granted location access.
  const locationDenied = home.locationStatus === "denied";
  const locationGranted = home.locationStatus === "granted";
  const [locationRequested, setLocationRequested] = useState(false);
  const [weatherError, setWeatherError] = useState(false);
  const [workAddress, setWorkAddress] = useState("");
  const [workInput, setWorkInput] = useState("");
  const [commute, setCommute] = useState<{
    km: number;
    minutes: number;
    routed: boolean;
    live: boolean;
  } | null>(null);
  /** Which way the commute reading points: to work, or home. */
  const [commuteTo, setCommuteTo] = useState<"work" | "home">("work");
  const [homeAddress, setHomeAddress] = useState("");
  const [homeCoords, setHomeCoords] = useState<Coords>(home.coords);
  const [workCoords, setWorkCoords] = useState<Coords | null>(null);
  /** Where the customer is — only once they have granted location access. */
  const [here, setHere] = useState<Coords | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [activeCameras, setActiveCameras] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [loadedCameras, setLoadedCameras] = useState<ReadonlySet<string>>(
    new Set(),
  );

  /**
   * The sky glyphs are drawn on a 24-grid and none of them reaches its own
   * left edge — a cloud's arc starts around x=3.5, a sun ray around x=3 — so
   * the drawing sits a few per cent inside its box and the reading looks
   * indented against the label under it. Measured rather than guessed: every
   * weather code draws a different shape, so a fixed nudge would be right for
   * one of them and wrong for the rest. getBBox gives the ink's real left
   * edge, and the box is pulled back by exactly that.
   */
  const weatherIconRef = useRef<SVGSVGElement>(null);
  const commuteIconRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const svg = weatherIconRef.current;
    if (!svg) return;

    const place = () => {
      try {
        /* The glyph's own grid, read off the element — the sky marks are on a
           16-grid and the house's line marks on a 24-grid. */
        const grid = svg.viewBox.baseVal.width || 24;
        const ink = svg.getBBox();
        if (!ink.width) return;
        /* getBBox ignores the stroke, which straddles the path; half of a
           1.75 stroke hangs outside the geometry. Solid glyphs have none. */
        const overhang = svg.getAttribute("stroke") === "none" ? 0 : 0.875;
        const inset = Math.max(0, ink.x - overhang);
        /* In pixels of the glyph's own box. It was an em, and an em here is
           the FIGURE's font size, not the icon's — so the pull-back grew and
           shrank with the temperature's type rather than with the drawing. */
        const boxWidth = svg.getBoundingClientRect().width;
        svg.style.marginLeft = `${(-(inset / grid) * boxWidth).toFixed(2)}px`;

        /* And the same on the vertical: stand the sky mark on the line the
           car stands on. Every sky code inks its grid to a different depth —
           an overcast cloud stops well short of the bottom edge where a
           cloud-and-sun runs right to it — so the drop is measured for
           whichever glyph is showing rather than set once. */
        const car = commuteIconRef.current;
        if (!car) return;
        const box = svg.getBoundingClientRect();
        const carBox = car.getBoundingClientRect();
        if (!box.height || !carBox.height) return;
        /* By the glyph's LOWEST ink — rain drops, snowflakes and bolts
           included — never by the cloud above them. Nothing in the sky mark
           may reach below the car's wheels: the two marks end on one line. */
        const inkBottom = box.top + ((ink.y + ink.height) / grid) * box.height;
        const carInkBottom = carBox.top + CAR_INK_BOTTOM * carBox.height;
        /* Added to the offset already on it, not written over it: the rect
           being measured already includes that offset, so the difference is
           what is still missing. Writing it over the offset threw the
           correction away on every re-run — a resize, the fonts landing, the
           observer's own first call — and the glyph settled back ~3px off. */
        const applied = parseFloat(svg.style.top) || 0;
        svg.style.top = `${(applied + carInkBottom - SKY_LIFT_PX - inkBottom).toFixed(2)}px`;
      } catch {
        // No layout box yet (a hidden panel); the glyph keeps its own edge.
      }
    };

    place();
    /* The readings are sized in container units, so both marks change size
       with the column. */
    const watcher = new ResizeObserver(place);
    watcher.observe(svg);
    if (commuteIconRef.current) watcher.observe(commuteIconRef.current);
    return () => watcher.disconnect();
  }, [weather]);

  useEffect(() => {
    setNow(new Date());
    const tick = setInterval(() => setNow(new Date()), 1_000);
    return () => clearInterval(tick);
  }, []);

  /* The commute's two ends are the ones saved on the profile; a guest gets
     the demo persona's. */
  useEffect(() => {
    setWorkAddress(home.workAddress);
    setWorkInput(home.workAddress);
    setHomeAddress(home.homeAddress);
  }, [home.workAddress, home.homeAddress]);

  /* The weather follows the home base, which moves to where the viewer is
     once location access is granted. */
  useEffect(() => {
    setCoords(home.coords);
  }, [home.coords]);

  const { requestLocation: askForLocation } = home;
  const requestLocation = useCallback(() => {
    setLocationRequested(true);
    setWeatherError(false);
    askForLocation();
  }, [askForLocation]);

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
        } else {
          setWeatherError(true);
        }
      })
      .catch(() => {
        // Network/API unavailable — the strip shows a readable
        // "weather unavailable" state, never a bare em dash.
        if (!cancelled) setWeatherError(true);
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
        if (city) setLocationLabel(placeLabel(city, regionCode(data?.address)));
      })
      .catch(() => {
        // Reverse geocoding unavailable — keep the generic label.
      });
    return () => {
      cancelled = true;
    };
  }, [coords]);

  function saveWorkAddress(address: string) {
    setWorkAddress(address);
  }

  /* Home and work as points on the map. Home without an address of its own
     is the overview's home base. */
  useEffect(() => {
    let cancelled = false;
    if (!homeAddress) setHomeCoords(home.coords);
    else
      void geocode(homeAddress).then((hit) => {
        if (!cancelled && hit) setHomeCoords(hit);
      });
    return () => {
      cancelled = true;
    };
  }, [homeAddress, home]);
  useEffect(() => {
    if (!workAddress) return;
    let cancelled = false;
    void geocode(workAddress).then((hit) => {
      if (!cancelled) setWorkCoords(hit);
    });
    return () => {
      cancelled = true;
    };
  }, [workAddress]);

  /*
   * Where the customer is, followed — but only once they have ALREADY
   * granted location access. This never asks: the overview does not open on
   * a permission prompt. "Use my location" asks, and a grant given there
   * starts it. Rounded to about 100 m, so moving about the house does not
   * re-route.
   */
  useEffect(() => {
    if (!navigator.geolocation || !navigator.permissions?.query) return;
    let watch = -1;
    let disposed = false;
    let status: PermissionStatus | null = null;
    const follow = () => {
      if (disposed || watch !== -1 || status?.state !== "granted") return;
      watch = navigator.geolocation.watchPosition(
        (position) => {
          const next = {
            lat: Math.round(position.coords.latitude * 1000) / 1000,
            lon: Math.round(position.coords.longitude * 1000) / 1000,
          };
          setHere((prev) =>
            prev && prev.lat === next.lat && prev.lon === next.lon
              ? prev
              : next,
          );
        },
        () => undefined,
        { maximumAge: 60_000, timeout: 15_000 },
      );
    };
    navigator.permissions
      .query({ name: "geolocation" })
      .then((result) => {
        status = result;
        follow();
        result.onchange = () => {
          if (result.state === "granted") {
            follow();
            return;
          }
          if (watch !== -1) navigator.geolocation.clearWatch(watch);
          watch = -1;
          setHere(null);
        };
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
      if (status) status.onchange = null;
      if (watch !== -1) navigator.geolocation.clearWatch(watch);
    };
  }, []);

  /* The reading: which way, then how long by road right now. Re-read every
     few minutes, which also lets the two o'clock turn happen on an open
     page. */
  useEffect(() => {
    if (home.guest || !workCoords) return;
    let cancelled = false;
    const read = async () => {
      const leg = commuteLeg(
        here,
        homeCoords,
        workCoords,
        new Date(),
        home.timeZone,
      );
      const time = await driveTime(
        leg.from,
        leg.to === "work" ? workCoords : homeCoords,
      );
      if (cancelled) return;
      setCommuteTo(leg.to);
      setCommute(time);
    };
    void read();
    const refresh = window.setInterval(read, COMMUTE_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(refresh);
    };
  }, [here, homeCoords, workCoords, home]);

  if (variant === "dashboard") {
    /* A guest sees the demo persona's drive. Signed in, the drive needs a
       work address on the profile and location access; until then the tile
       asks for whichever is missing. */
    const commuteNeeds = home.guest
      ? null
      : !home.workAddress
        ? "work-address"
        : !locationGranted
          ? "location"
          : null;
    const commuteMinutes = home.guest
      ? GUEST_COMMUTE_MINUTES
      : commuteNeeds
        ? null
        : (commute?.minutes ?? null);
    const commuteDuration =
      commuteMinutes === null ? null : formatCommuteMinutes(commuteMinutes);
    /* The commute's mark is the founder's own car glyph (white on
       transparent), not the line icon the other readings use. */
    /* The car's headlights are holes in the glyph, so they showed the grey
       behind it. A lit layer sits over the car cut to exactly those two
       shapes (front-car-headlights.png, traced from the holes themselves),
       warm white with a glow. */
    const CommuteCarIcon = () => (
      <span className="paon-car" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={commuteIconRef}
          src="/images/front-car.png"
          alt=""
          aria-hidden="true"
          className="paon-stat-icon paon-stat-icon-image"
        />
        <span className="paon-car-lights" />
      </span>
    );
    return (
      <section className="paon-overview-widget-grid" aria-label="Local context">
        <article className="paon-stat paon-stat-weather">
          {weather ? (
            <>
              <p className="paon-stat-value">
                <WeatherIcon
                  ref={weatherIconRef}
                  code={weather.code}
                  className="paon-stat-icon"
                />
                {Math.round(weather.tempC)}°
              </p>
              {/* The glyph beside the temperature already says what the
                  sky is doing; spelling it out again was a third line in a
                  strip that has room for two. */}
              <div className="paon-stat-meta">
                <span className="paon-stat-label">{locationLabel}</span>
              </div>
            </>
          ) : (
            <>
              <p className="paon-stat-value paon-stat-value-idle">
                <SunIcon className="paon-stat-icon" />
              </p>
              <div className="paon-stat-meta">
                <span className="paon-stat-label">Local weather</span>
                <span className="paon-stat-detail">
                  {locationDenied
                    ? "Location is blocked in your browser."
                    : weatherError
                      ? "Weather is unavailable right now."
                      : locationRequested
                        ? "Finding your forecast…"
                        : "Before you step outside."}
                </span>
                <button
                  type="button"
                  className="paon-stat-action"
                  onClick={requestLocation}
                >
                  {locationDenied || weatherError
                    ? "Try again"
                    : "Use my location"}
                </button>
              </div>
            </>
          )}
          {skyExtras}
        </article>

        <article className="paon-stat paon-stat-commute">
          {commuteDuration ? (
            <p className="paon-stat-value">
              <CommuteCarIcon />
              {commuteDuration}
            </p>
          ) : (
            <p className="paon-stat-value paon-stat-value-idle">
              <CommuteCarIcon />—<small>min</small>
            </p>
          )}
          {/* The car glyph on the figure is the commute's mark, so the
              suitcase beside the word was a second icon saying the same
              thing; the distance was the third line. Minutes and the word
              are the whole reading. */}
          <div className="paon-stat-meta">
            {commuteNeeds === "work-address" ? (
              <Link href="/account" className="paon-stat-action">
                Set work address
              </Link>
            ) : commuteNeeds === "location" ? (
              <button
                type="button"
                className="paon-stat-action"
                onClick={requestLocation}
              >
                {locationDenied
                  ? "Allow location in browser"
                  : "Allow location"}
              </button>
            ) : (
              <span className="paon-stat-label">
                {home.guest || commuteTo === "work" ? "To work" : "To home"}
              </span>
            )}
          </div>
        </article>
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
                  Drive to {commuteTo}
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
                      : "Drive time by road"}
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
            {CITY_STREAMS_ENABLED && activeCameras.has("AMS") ? (
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
                    Start the live Amsterdam view when you are ready.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setActiveCameras((current) => new Set([...current, "AMS"]))
                  }
                  className="min-h-[52px] rounded-full border border-white/40 px-4 text-xs text-white"
                >
                  Open live view
                </button>
              </div>
            )}
          </div>
        </div>
        <div
          data-morning-stream-slot
          className="relative hidden min-h-[22rem] border-t border-white/10 bg-black lg:block lg:min-h-0 lg:border-l lg:border-t-0"
        >
          {CITY_STREAMS_ENABLED && activeCameras.has("AMS") ? (
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
                <span className="text-xs text-white/35">Ready on request</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  setActiveCameras((current) => new Set([...current, "AMS"]))
                }
                className="min-h-[52px] w-fit rounded-full border border-white/40 px-5 text-sm text-white"
              >
                Open Amsterdam live view
              </button>
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
                {CITY_STREAMS_ENABLED && activeCameras.has(camera.code) ? (
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
                  <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/70 to-transparent p-3">
                    <button
                      type="button"
                      onClick={() =>
                        setActiveCameras(
                          (current) => new Set([...current, camera.code]),
                        )
                      }
                      className="min-h-[52px] rounded-full border border-white/55 bg-black/35 px-4 text-xs text-white backdrop-blur-sm"
                    >
                      Open live view
                    </button>
                  </div>
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
