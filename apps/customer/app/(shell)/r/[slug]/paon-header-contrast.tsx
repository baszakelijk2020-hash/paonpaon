"use client";

import { useEffect } from "react";

/**
 * The header's marks read what is behind them and switch: light over a dark
 * frame, dark over a pale one.
 *
 * `mix-blend-mode` cannot do this here. Two stacking contexts sit between the
 * marks and the feed — `#paon-icons-bar` carries a transform with
 * `will-change: transform`, and `.paon-template-root` sets
 * `isolation: isolate` — so a blend only ever mixes with a transparent group
 * and renders the flat source colour, whatever is underneath.
 *
 * So the luminance is measured instead. The cards under a mark name their
 * own photograph; each one is sampled once at 16px through Next's image
 * optimizer (the founder's domain sends no CORS header, so a canvas that has
 * drawn the original cannot be read back — the optimizer makes it
 * same-origin) and cached by URL.
 *
 * Every mark is measured against what is behind *it*, not against the header
 * as a whole: the search control on the left sits over a different card from
 * the three icons on the right, and each carries its own flag.
 */

/** Above this mean luminance (0–255) the backdrop counts as light. */
const LIGHT_THRESHOLD = 140;
/** Hysteresis, so a card edge drifting past the threshold cannot flicker. */
const MARGIN = 12;
const FLAG = "data-paon-on-light";

/** Each of these reads its own backdrop and carries its own flag. */
const MARKS = [
  "#paon-icons-bar .header-icon",
  "#header .header-icon",
  ".paon-search-toggle",
  ".filters-btn",
  "#paon-search-field",
].join(", ");

const luminanceByUrl = new Map<string, number | null>();

function sample(url: string): Promise<number | null> {
  const cached = luminanceByUrl.get(url);
  if (cached !== undefined) return Promise.resolve(cached);

  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      let value: number | null = null;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 16;
        canvas.height = 16;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (context) {
          context.drawImage(image, 0, 0, 16, 16);
          const { data } = context.getImageData(0, 0, 16, 16);
          let total = 0;
          for (let i = 0; i < data.length; i += 4) {
            total +=
              0.2126 * (data[i] ?? 0) +
              0.7152 * (data[i + 1] ?? 0) +
              0.0722 * (data[i + 2] ?? 0);
          }
          value = total / (data.length / 4);
        }
      } catch {
        // Still tainted (an image the optimizer would not take): unknown.
      }
      luminanceByUrl.set(url, value);
      resolve(value);
    };
    image.onerror = () => {
      luminanceByUrl.set(url, null);
      resolve(null);
    };
    image.src = `/_next/image?url=${encodeURIComponent(url)}&w=16&q=25`;
  });
}

export function PaonHeaderContrast() {
  useEffect(() => {
    let disposed = false;
    let stop: (() => void) | undefined;

    // The template builds its icons bar after hydration, so the element is
    // not there when this mounts; wait for it rather than giving up.
    const waitForBar = window.setInterval(() => {
      const root = document.querySelector<HTMLElement>(".paon-template-root");
      const bar = document.querySelector<HTMLElement>("#paon-icons-bar");
      if (disposed || !root || !bar) return;
      window.clearInterval(waitForBar);
      stop = watch(root, bar);
    }, 200);

    function watch(_root: HTMLElement, _bar: HTMLElement) {
      let frame = 0;
      // Per mark, so one drifting past the threshold cannot flip another.
      const lit = new WeakMap<Element, boolean>();

      const measure = async () => {
        if (disposed) return;
        const marks = [...document.querySelectorAll<HTMLElement>(MARKS)].filter(
          (mark) => {
            const box = mark.getBoundingClientRect();
            return box.width > 0 && box.height > 0;
          },
        );
        if (marks.length === 0) return;

        const photographs = [
          ...document.querySelectorAll<HTMLImageElement>(
            ".home-feed-card img, #main img",
          ),
        ].map((image) => ({
          box: image.getBoundingClientRect(),
          url: image.currentSrc || image.src,
        }));

        await Promise.all(
          marks.map(async (mark) => {
            const strip = mark.getBoundingClientRect();
            // Every photograph this mark sits over, and how much of the mark
            // each one accounts for.
            const weighted = photographs.flatMap(({ box, url }) => {
              if (box.bottom < strip.top || box.top > strip.bottom) return [];
              const overlap =
                Math.min(box.right, strip.right) -
                Math.max(box.left, strip.left);
              if (overlap <= 0 || !url || url.startsWith("data:")) return [];
              return [{ url, weight: overlap }];
            });
            if (weighted.length === 0) return;

            const samples = await Promise.all(
              weighted.map(async (entry) => ({
                weight: entry.weight,
                luminance: await sample(entry.url),
              })),
            );
            if (disposed) return;

            let total = 0;
            let weight = 0;
            for (const entry of samples) {
              if (entry.luminance === null) continue;
              total += entry.luminance * entry.weight;
              weight += entry.weight;
            }
            if (weight === 0) return;

            const mean = total / weight;
            const wasLit = lit.get(mark) ?? mark.hasAttribute(FLAG);
            const next = wasLit
              ? mean > LIGHT_THRESHOLD - MARGIN
              : mean > LIGHT_THRESHOLD + MARGIN;
            if (next === wasLit && mark.hasAttribute(FLAG) === next) return;
            lit.set(mark, next);
            if (next) mark.setAttribute(FLAG, "");
            else mark.removeAttribute(FLAG);
          }),
        );
      };

      const schedule = () => {
        if (frame) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          void measure();
        });
      };

      void measure();
      const scroller = document.querySelector("#main") ?? window;
      scroller.addEventListener("scroll", schedule, { passive: true });
      window.addEventListener("scroll", schedule, { passive: true });
      window.addEventListener("resize", schedule);
      // The feed fills in after mount, and again whenever a category changes.
      const settle = window.setTimeout(schedule, 1_200);
      window.addEventListener("paon:storefront-location", schedule);

      return () => {
        if (frame) cancelAnimationFrame(frame);
        window.clearTimeout(settle);
        scroller.removeEventListener("scroll", schedule);
        window.removeEventListener("scroll", schedule);
        window.removeEventListener("resize", schedule);
        window.removeEventListener("paon:storefront-location", schedule);
        document
          .querySelectorAll(MARKS)
          .forEach((mark) => mark.removeAttribute(FLAG));
      };
    }

    return () => {
      disposed = true;
      window.clearInterval(waitForBar);
      stop?.();
    };
  }, []);

  return null;
}
