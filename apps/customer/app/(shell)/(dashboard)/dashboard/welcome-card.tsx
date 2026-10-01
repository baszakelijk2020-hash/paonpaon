"use client";

import { gsap } from "gsap";
import Image from "next/image";
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { useHomeLocation } from "../morning-routine/home-location";

import { HIGHLIGHT } from "./highlight";
import { WeatherIcon } from "./stat-icons";

import "./overview.css";

/**
 * The greeting card: folds the customer's local weather into one sentence and
 * introduces the day's highlight, which `HighlightCard` shows in full.
 *
 * The weather is Breda's — the customer's home — so the sentence reads the
 * same wherever the page is opened.
 */

/* The highlight lives in ./highlight (a plain module) so the server page can
   read it as a value; it is re-exported here for anything that imported it
   from this file. */

export { HIGHLIGHT };

type LocalWeather = {
  tempC: number;
  code: number;
  isDay: boolean;
  /** Tomorrow's high and sky, for the evening greeting. */
  tomorrow: { tempC: number; code: number } | null;
};

/** From this hour the greeting looks ahead to tomorrow. */
const EVENING_HOUR = 18;

/** The hour, 0–23, at the customer's home. */
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
 * The greeting sets itself one word at a time, each rising out of its own mask.
 *
 * The words are split at render, not by walking the paragraph afterwards: the
 * sentence rebuilds itself when the weather lands, and a split done to the DOM
 * would be thrown away by that re-render. Whitespace is deliberately left
 * outside the spans so the line still wraps and justifies normally.
 */
function Words({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\s+)/).map((part, index) =>
        /\S/.test(part) ? (
          <span className="paon-welcome-word" key={index}>
            <span>{part}</span>
          </span>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}

export function WelcomeCard({ firstName }: { firstName: string }) {
  const home = useHomeLocation();
  const [weather, setWeather] = useState<LocalWeather | null>(null);
  const [evening, setEvening] = useState(false);
  const copyRef = useRef<HTMLParagraphElement>(null);

  const play = useCallback(() => {
    const node = copyRef.current;
    if (!node) return;
    const words = node.querySelectorAll<HTMLElement>(".paon-welcome-word > *");
    if (words.length === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      node.classList.remove("is-pending");
      gsap.set(words, { yPercent: 0, opacity: 1, clearProps: "willChange" });
      return;
    }
    // gsap.fromTo writes the `from` state synchronously, so dropping the class
    // here cannot expose the words for even one frame.
    gsap.set(words, { yPercent: 115, opacity: 0 });
    node.classList.remove("is-pending");
    gsap.fromTo(
      words,
      { yPercent: 115, opacity: 0 },
      {
        yPercent: 0,
        opacity: 1,
        duration: 0.62,
        ease: "power3.out",
        stagger: 0.016,
        force3D: true,
        // A replay must not race the tween it is replacing, or half the line
        // settles at one offset and half at another.
        overwrite: "auto",
        onComplete: () => gsap.set(words, { clearProps: "willChange" }),
      },
    );
  }, []);

  /*
   * Before paint, so the finished sentence is never shown for a frame first,
   * and again whenever the sentence changes shape — the weather arrives after
   * mount and rewrites the middle of it.
   */
  useLayoutEffect(() => {
    play();
  }, [play, firstName, weather, evening]);

  /* From six in the evening the greeting looks ahead to tomorrow. Checked
     every minute so it turns over on an open page, and only in the browser:
     the hour is the customer's, not the server's. */
  useEffect(() => {
    const check = () =>
      setEvening(homeHour(new Date(), home.timeZone) >= EVENING_HOUR);
    check();
    const tick = window.setInterval(check, 60_000);
    return () => window.clearInterval(tick);
  }, [home]);

  /*
   * And every time the customer crosses back into the wardrobe. The card stays
   * mounted underneath the storefront, so without this the greeting would only
   * ever set itself once per page load.
   *
   * It takes two events, not one. `entering` fires before the panel moves,
   * while this card is still behind the storefront, and is where the words are
   * put back to nothing — arming that on `settled` instead meant the finished
   * sentence was already on screen, so it flashed whole, snapped back to empty
   * and only then wrote itself. `settled` just starts the tween.
   */
  useEffect(() => {
    const arm = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== "customer") return;
      const node = copyRef.current;
      if (!node) return;
      const words = node.querySelectorAll<HTMLElement>(
        ".paon-welcome-word > *",
      );
      if (words.length === 0) return;
      gsap.set(words, { yPercent: 115, opacity: 0 });
    };
    const onSettled = (event: Event) => {
      if ((event as CustomEvent<string>).detail === "customer") {
        play();
      }
    };
    window.addEventListener("paon:environment-entering", arm);
    window.addEventListener("paon:environment-settled", onSettled);
    return () => {
      window.removeEventListener("paon:environment-entering", arm);
      window.removeEventListener("paon:environment-settled", onSettled);
    };
  }, [play]);

  useEffect(() => {
    let disposed = false;
    /*
     * The greeting is about the day ahead, so the figure it carries is the
     * day's HIGH, not the reading out of the window — "with 21°C today calls
     * for something special" is a sentence about what to wear, and what to
     * wear is decided by how warm it will get. The strip above keeps the
     * current temperature; the two are meant to differ.
     *
     * The sky glyph beside it still follows the current conditions: it says
     * what it is doing outside now, which is the other half of the decision.
     */
    const load = (lat: number, lon: number) =>
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
          `&current=temperature_2m,weather_code,is_day` +
          `&daily=temperature_2m_max,weather_code&forecast_days=2&timezone=${encodeURIComponent(home.timeZone)}`,
      )
        .then((res) => (res.ok ? res.json() : null))
        .then(
          (
            data: {
              current?: {
                temperature_2m?: number;
                weather_code?: number;
                is_day?: number;
              };
              daily?: {
                temperature_2m_max?: number[];
                weather_code?: number[];
              };
            } | null,
          ) => {
            const current = data?.current;
            if (disposed || current?.temperature_2m === undefined) return;
            /* The high where there is one, and the current reading as the
               fallback — a missing forecast should not empty the sentence. */
            const high = data?.daily?.temperature_2m_max?.[0];
            const nextHigh = data?.daily?.temperature_2m_max?.[1];
            const nextCode = data?.daily?.weather_code?.[1];
            setWeather({
              tempC: typeof high === "number" ? high : current.temperature_2m,
              code: current.weather_code ?? 0,
              isDay: current.is_day !== 0,
              tomorrow:
                typeof nextHigh === "number"
                  ? {
                      tempC: nextHigh,
                      code: typeof nextCode === "number" ? nextCode : 0,
                    }
                  : null,
            });
          },
        )
        .catch(() => undefined);

    void load(home.coords.lat, home.coords.lon);

    return () => {
      disposed = true;
    };
  }, [home]);

  /**
   * Stands the sky glyph on the sentence's baseline.
   *
   * An inline-block sits on the baseline by its bottom margin edge, not by
   * its drawing — and every sky code inks its 16-grid to a different depth,
   * so a single `vertical-align` is right for one of them and wrong for the
   * rest. The glyph's own ink bottom is measured and the box is dropped by
   * exactly the clear space beneath it, which puts the drawing on the line
   * the type stands on whatever the weather is.
   */
  const skyRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = skyRef.current;
    if (!svg) return;
    const place = () => {
      try {
        const grid = svg.viewBox.baseVal.width || 16;
        const ink = svg.getBBox();
        if (!ink.height) return;
        /* By the glyph's LOWEST ink — rain drops and snowflakes included.
           That lowest point sits exactly where m and n end; nothing of the
           sky mark reaches below the line the type stands on. */
        const clearBelow = (grid - (ink.y + ink.height)) / grid;
        /*
         * Hung by its margin, not pushed by vertical-align.
         *
         * An inline-block SVG sits on the baseline by its bottom MARGIN edge.
         * A negative bottom margin the size of the clear space under the
         * cloud moves that edge up to the cloud's own bottom, so the cloud
         * stands on the baseline — where m and n end — and the drops hang
         * below it like a descender, without adding any depth to the line.
         *
         * Lowering it with vertical-align instead made the line box deeper,
         * and the word wrapper around it is bottom-aligned, so that extra
         * depth pushed the whole wrapper up and the cloud rose with it.
         */
        svg.style.verticalAlign = "baseline";
        svg.style.marginBottom = `${-(clearBelow * svg.getBoundingClientRect().height).toFixed(2)}px`;
      } catch {
        // No layout box yet; the glyph keeps the stylesheet's own alignment.
      }
    };
    place();
    /* FitCopy resizes the type, and the glyph is sized in em. */
    const watcher = new ResizeObserver(place);
    watcher.observe(svg);
    return () => watcher.disconnect();
  }, [weather, evening]);

  /* After six the day is done, so the sentence is about tomorrow: tomorrow's
     high and tomorrow's sky. The strip above still reads the temperature
     outside now. */
  const day = evening && (!weather || weather.tomorrow) ? "tomorrow" : "today";
  const reading =
    day === "tomorrow" && weather?.tomorrow
      ? { ...weather.tomorrow, isDay: true }
      : weather
        ? { tempC: weather.tempC, code: weather.code, isDay: weather.isDay }
        : null;

  return (
    <section className="paon-welcome-message" aria-label="Welcome">
      <p className="paon-welcome-copy is-pending" ref={copyRef}>
        {/* No name when no one is signed in: just "Hi,". */}
        <Words text={firstName ? `Hi ${firstName},` : "Hi,"} />{" "}
        {reading ? (
          <>
            <Words text={`with ${Math.round(reading.tempC)}°C and`} />{" "}
            <span className="paon-welcome-word">
              <span className="paon-welcome-weather-reveal">
                <WeatherIcon
                  ref={skyRef}
                  code={reading.code}
                  isDay={reading.isDay}
                  className="paon-welcome-weather-icon"
                />
              </span>
            </span>{" "}
            <Words text={`${day} calls for something special.`} />{" "}
          </>
        ) : (
          <>
            <Words text={`${day} calls for something special.`} />{" "}
          </>
        )}
        <Words text={HIGHLIGHT.copy} />
      </p>
    </section>
  );
}

/** The day's highlight — the whole outfit, head to shoes, never cropped. */
export function HighlightCard() {
  return (
    <section className="paon-welcome-look" aria-label="Today’s highlight">
      <Image
        src={HIGHLIGHT.image}
        alt={HIGHLIGHT.alt}
        width={1800}
        height={3463}
        unoptimized
        sizes="(max-width: 900px) 100vw, 50vw"
        priority
      />
    </section>
  );
}
