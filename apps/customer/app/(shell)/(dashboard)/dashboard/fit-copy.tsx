"use client";

import { useEffect } from "react";

import "./overview.css";

/**
 * Sizes the greeting to exactly fill the space it has been given.
 *
 * A `clamp()` cannot do this: the copy changes length when the weather lands,
 * the column changes width with the window and height with the readings and
 * the world clock below it, so any fixed ceiling is either too small on a
 * tall window or runs straight through its neighbours on a short one — which
 * is what it did.
 *
 * So it is measured. Binary search on font-size for the largest whole pixel
 * that still fits the box, re-run whenever the text or the box changes.
 */

const MIN_PX = 13;
const MAX_PX = 90;
/** Close enough that another pass would not change the rendered size. */
const PRECISION = 0.5;

function fit(copy: HTMLElement, trimPx: number) {
  const box = copy.parentElement;
  if (!box) return;
  const available = box.clientHeight;
  if (available <= 0) return;

  let low = MIN_PX;
  let high = MAX_PX;
  // The largest size that fits is what we want, so keep the last one that did
  // rather than trusting where the search lands.
  let best = MIN_PX;
  while (high - low > PRECISION) {
    const mid = (low + high) / 2;
    copy.style.fontSize = `${mid}px`;
    // Height only: the copy is block-level, so it wraps and can never be
    // wider than its box — measuring width just rejected sizes that fit.
    if (copy.scrollHeight <= available) {
      best = mid;
      low = mid;
    } else {
      high = mid;
    }
  }
  /* `trimPx` comes off the fitted size: the fit gives the largest type the
     box will take, which is not always the size the page wants it set at. */
  copy.style.fontSize = `${Math.max(MIN_PX, Math.floor(best) - trimPx)}px`;

  /*
   * What is left over, published for the layout to use.
   *
   * The fit lands in whole lines, not whole pixels: the last size that fit
   * is the one before the copy would have taken another line, so there is
   * always up to a line of empty box under the last line of type. Anything
   * that wants to sit a fixed distance under that LINE — rather than under
   * the box — has to know how much. The variable goes on the column so the
   * greeting's siblings inherit it.
   */
  const slack = Math.max(0, available - copy.scrollHeight);
  (box.parentElement ?? box).style.setProperty(
    "--paon-copy-slack",
    `${Math.round(slack)}px`,
  );
}

export function FitCopy({
  selector,
  trimPx = 0,
}: {
  selector: string;
  /** Set the copy this many pixels under the largest size that fits. */
  trimPx?: number;
}) {
  useEffect(() => {
    const copy = document.querySelector<HTMLElement>(selector);
    if (!copy || !copy.parentElement) return;

    let frame = 0;
    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => fit(copy, trimPx));
    };
    schedule();

    // The box resizes with the window; the text is rewritten when the weather
    // arrives and again when the greeting finishes setting itself.
    const boxWatcher = new ResizeObserver(schedule);
    boxWatcher.observe(copy.parentElement);
    const textWatcher = new MutationObserver(schedule);
    // `class` too: the greeting sets itself a word at a time and drops its
    // `is-pending` class when it finishes, and the height it measures to is
    // not final until then.
    //
    // `class` and NOTHING else among attributes. This used to watch every
    // attribute, and fit() itself writes `style` on the copy — eight times
    // per run, one per step of the search — so each fit queued the next one
    // and the paragraph re-laid itself out on every frame, forever: ~470
    // mutations a second. The column repainting that often is what made the
    // live picture beneath it flicker. The word reveal and the sky glyph also
    // write `style` inside the copy; none of that changes how tall it is.
    textWatcher.observe(copy, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class"],
    });
    if (document.fonts?.ready) void document.fonts.ready.then(schedule);

    return () => {
      window.cancelAnimationFrame(frame);
      boxWatcher.disconnect();
      textWatcher.disconnect();
    };
  }, [selector, trimPx]);

  return null;
}
