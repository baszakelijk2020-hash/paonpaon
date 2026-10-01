"use client";

/**
 * Eased wheel scrolling, shared by the appointment carousels, the storefront
 * grid and the category rail.
 *
 * The browser's own wheel handling moves the scroller a raw delta per event, so
 * a trackpad fling arrives as a burst of uneven jumps; where a scroll-snap is
 * also declared, the snap engine drags the position back between those jumps and
 * the result reads as stutter. Here the wheel handler only moves a target
 * number, and a single rAF loop eases the real scroll offset towards it — one
 * writer, one curve.
 *
 * Past either end the target keeps moving but the track does not: the surplus
 * becomes a damped translation of the content. It is a gesture-time effect only
 * — the first frame after the wheel stops, the track is already back on its end.
 * Without the overreach a track stops dead on the last card, which is the one
 * moment the motion is most obviously mechanical; with an eased return it reads
 * as the track hesitating before it comes home.
 *
 * Returns a controller: `detach()` unbinds it, and `nudge()` pages the same
 * distance on the same curve for arrow buttons.
 */
export interface SmoothScroller {
  readonly detach: () => void;
  readonly nudge: (amount: number) => void;
}

/** How far the content may be dragged past an end, in pixels. */
const BAND_LIMIT = 28;
/**
 * A pause at least this long means the next wheel event begins a fresh gesture
 * rather than continuing the last one. Comfortably longer than the gap between
 * trailing momentum events, comfortably shorter than a deliberate second swipe.
 */
const NEW_GESTURE_MS = 140;

export function attachSmoothScroll(
  element: HTMLElement,
  axis: "x" | "y" = "x",
  options: { readonly band?: boolean } = {},
): SmoothScroller {
  const isX = axis === "x";
  const banded = options.band ?? isX;
  const prop = isX ? "scrollLeft" : "scrollTop";
  const max = () =>
    isX
      ? element.scrollWidth - element.clientWidth
      : element.scrollHeight - element.clientHeight;

  let target = element[prop];
  let frame: number | null = null;
  let band = 0;
  let bandTarget = 0;
  let lastWheel = 0;
  let lastFrame = -1;
  // Latched once the band starts coming home, so the trailing momentum of the
  // same fling cannot pull it back out. Without the latch the band shuts, the
  // next momentum event re-opens it, the frame after shuts it again — and that
  // flutter is exactly what reads as jitter.
  let settling = false;

  // The band translates the track's contents, not the track itself — the track
  // paints the timeline's rules and wash, and those must stay put while the
  // months slide under them. Absolutely positioned children (the date marker)
  // are left alone for the same reason.
  const bandNodes = () =>
    banded
      ? ([...element.children] as HTMLElement[]).filter(
          (child) => getComputedStyle(child).position !== "absolute",
        )
      : [];

  // Written to `translate`, not to `transform`. The cards carry an entrance
  // animation on `transform` with `fill: both`, and a filled animation outranks
  // an inline style — so a band written as a transform was simply discarded on
  // the one track whose children are the cards themselves. `translate` is its own
  // property and composites alongside the animation untouched.
  const paintBand = () => {
    if (!banded) return;
    const offset = Math.abs(band) < 0.1 ? "" : `${-band}px`;
    for (const node of bandNodes()) node.style.translate = offset;
  };

  /* Resistance: the first pixels past the end come easily and the rest do not,
     approaching BAND_LIMIT but never reaching it. */
  const resist = (excess: number) => {
    const sign = Math.sign(excess);
    const size = Math.abs(excess);
    return sign * BAND_LIMIT * (1 - 1 / (1 + size / BAND_LIMIT));
  };

  const step = () => {
    const limit = max();
    // Released means the fling is over: the target comes home and the band
    // closes in this one frame, never eased back over several. Once released it
    // stays released until a new gesture begins.
    // No waiting period at all: the gesture is over the moment a frame arrives
    // with no wheel event since the previous frame. Measured against the last
    // frame rather than a fixed delay, so there is nothing to tune and nothing
    // to feel. The latch below is what makes this safe — without it, the widening
    // gaps of a decaying fling would each read as an ending and the band would
    // flutter.
    const released = banded && (settling || lastWheel <= lastFrame);
    lastFrame = performance.now();
    if (released) {
      settling = true;
      target = clamp(target, 0, limit);
    }
    const clamped = clamp(target, 0, limit);
    const current = element[prop];
    const distance = clamped - current;

    if (Math.abs(distance) < 0.5) element[prop] = clamped;
    else element[prop] = current + distance * 0.22;

    bandTarget = resist(target - clamped);
    band = released ? bandTarget : band + (bandTarget - band) * 0.45;
    paintBand();

    // The loop may only stop with the band fully closed. Comparing `band` to
    // `bandTarget` alone let it settle while both were still a few pixels out,
    // which left the track parked short of its true start.
    const restingScroll = Math.abs(clamped - element[prop]) < 0.5;
    const restingBand = Math.abs(band) < 0.2 && Math.abs(bandTarget) < 0.2;
    if (restingScroll && restingBand) {
      element[prop] = clamped;
      target = clamped;
      band = 0;
      bandTarget = 0;
      // `settling` is deliberately NOT cleared here. The loop stops between the
      // widening gaps of a decaying fling, and clearing it on every rest let the
      // next momentum event stretch the band again — the flutter this latch
      // exists to prevent. Only a real pause, checked in the wheel handler,
      // starts a new gesture.
      paintBand();
      frame = null;
      return;
    }
    frame = requestAnimationFrame(step);
  };

  const run = () => {
    frame ??= requestAnimationFrame(step);
  };

  const onWheel = (event: WheelEvent) => {
    // Pinch-zoom and modifier gestures are the browser's, never ours.
    if (event.ctrlKey || event.metaKey) return;
    const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
    // A horizontal track claims horizontal gestures (and shift-wheel); a vertical
    // one claims vertical. Anything else belongs to whatever is underneath.
    if (isX ? !horizontal && !event.shiftKey : horizontal) return;
    const delta = isX
      ? horizontal
        ? event.deltaX
        : event.deltaY
      : event.deltaY;

    const limit = max();
    if (!banded) {
      const next = clamp(target + delta, 0, limit);
      // At either end, hand the gesture back so the page can take over instead of
      // the track swallowing it.
      if (next === target) return;
      event.preventDefault();
      target = next;
      run();
      return;
    }

    event.preventDefault();
    const now = performance.now();
    // A long enough pause, and this is a new swipe rather than the tail of the
    // last one, so the band is allowed to stretch again.
    if (now - lastWheel > NEW_GESTURE_MS) settling = false;
    lastWheel = now;
    if (settling) {
      // Coming home: the rest of this fling scrolls, but it may not re-stretch.
      target = clamp(target + delta, 0, limit);
    } else {
      // Travel past an end is held well inside the band's own limit, so the
      // resistance curve always has room left to express.
      target = clamp(target + delta, -BAND_LIMIT * 3, limit + BAND_LIMIT * 3);
    }
    run();
  };

  // Scrollbar drags, keyboard focus jumps and anchor scrolls move the element
  // without passing through the wheel handler; resync so the next wheel event
  // does not snap back to a stale target.
  const onScroll = () => {
    if (frame === null) target = element[prop];
  };

  element.style.scrollSnapType = "none";
  element.style[isX ? "overscrollBehaviorX" : "overscrollBehaviorY"] =
    "contain";
  element.addEventListener("wheel", onWheel, { passive: false });
  element.addEventListener("scroll", onScroll, { passive: true });

  return {
    detach() {
      element.removeEventListener("wheel", onWheel);
      element.removeEventListener("scroll", onScroll);
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      band = 0;
      bandTarget = 0;
      paintBand();
    },
    nudge(amount: number) {
      target = clamp(target + amount, 0, max());
      run();
    },
  };
}

export function clamp(value: number, min: number, maxValue: number) {
  return Math.min(Math.max(value, min), maxValue);
}
