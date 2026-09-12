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

import { HOME_LOCATION } from "../morning-routine/local-widgets";

import { WeatherIcon } from "./stat-icons";

import "./overview.css";

/**
 * The greeting card: folds the customer's local weather into one sentence and
 * introduces the day's highlight, which `HighlightCard` shows in full.
 *
 * The weather is Breda's — the customer's home — so the sentence reads the
 * same wherever the page is opened.
 */

const HIGHLIGHT = {
  image: "https://www.nebelspiegel.com/images/smaller/6054.webp",
  alt: "Ecru silk double-breasted suit from the S/S 2026 collection",
  copy: "This highlight from our S/S 2026 collection is cut from 100% silk by Zegna, offering a distinct hand feel.",
};

type LocalWeather = { tempC: number; code: number; isDay: boolean };

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
  const [weather, setWeather] = useState<LocalWeather | null>(null);
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
  }, [play, firstName, weather]);

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
      if ((event as CustomEvent<string>).detail === "customer") play();
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
    const load = (lat: number, lon: number) =>
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day`,
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
            } | null,
          ) => {
            const current = data?.current;
            if (disposed || current?.temperature_2m === undefined) return;
            setWeather({
              tempC: current.temperature_2m,
              code: current.weather_code ?? 0,
              isDay: current.is_day !== 0,
            });
          },
        )
        .catch(() => undefined);

    void load(HOME_LOCATION.coords.lat, HOME_LOCATION.coords.lon);

    return () => {
      disposed = true;
    };
  }, []);

  return (
    <section className="paon-welcome-message" aria-label="Welcome">
      <p className="paon-welcome-copy is-pending" ref={copyRef}>
        <Words text={`Hi ${firstName},`} />{" "}
        {weather ? (
          <>
            <Words text={`with ${Math.round(weather.tempC)}°C and`} />{" "}
            <span className="paon-welcome-word">
              <WeatherIcon
                code={weather.code}
                isDay={weather.isDay}
                className="paon-welcome-weather-icon"
              />
            </span>{" "}
            <Words text="today calls for something special." />{" "}
          </>
        ) : (
          <>
            <Words text="today calls for something special." />{" "}
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
