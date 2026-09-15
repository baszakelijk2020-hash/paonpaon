"use client";

/*
 * LOCKED — founder-approved watch face ("perfection", 13 Sep 2026).
 * Do not change this file, pearl-light.tsx, or any `.paon-analogue*` rule in
 * overview.css without the founder's explicit go-ahead. A Claude Code hook
 * (scripts/watch-face-lock.sh) stops and asks before any such edit; the
 * approved reference is docs/evidence/locked/watch-face/.
 */

import { useEffect, useState } from "react";

import { HOME_LOCATION } from "../morning-routine/local-widgets";

import "./overview.css";

/**
 * A small analogue face beside the day's readings — the time as a shape
 * rather than a number, which is the one reading you take at a glance.
 *
 * It is a day-date face: the weekday sits in an arched window under twelve
 * and the date in a square window at three, under a cyclops that magnifies
 * it, exactly where a Rolex Day-Date puts them. Both are set in GTBold3, the
 * house's smallest voice, the same face the STORE / WARDROBE toggle uses.
 *
 * It draws nothing until it has mounted: the hands and both windows are the
 * reader's local time, the server has no idea what that is, and rendering a
 * guess first would snap every hand into place on hydration.
 */

const TICKS = Array.from({ length: 12 }, (_, i) => i * 30)
  /* Twelve, eleven and one fall inside the day window and three inside the
     date one; those four markers stand down rather than run into glass. Ten
     and two are clear of the narrowed window and stay. */
  .filter((angle) => ![0, 30, 90, 330].includes(angle));

/**
 * The weekday aperture: an annular sector centred on twelve, cut between
 * r=30 and r=42 and spanning 38° either side of the top. The span is cut to
 * the word: the longest name — WEDNESDAY — clears each end without leaving
 * an ornamental white wing beyond it. The band is 12 units deep, which keeps the word inside the
 * glass rather than riding its edge and leaves the dial below it free for
 * the signature. Traced by hand; an arch is the one shape SVG has no
 * primitive for.
 */
const DAY_WINDOW =
  "M24.14 16.90 A42 42 0 0 1 75.86 16.90 L68.47 26.36 A30 30 0 0 0 31.53 26.36 Z";

/**
 * The baseline the day is set on: the same arc at r=33.5, running left to
 * right over the top so the word reads upright and curves with the window
 * rather than sitting flat inside it. It sits 3.5 units off the inner edge
 * of the band, so a 6px cap lands 2.5 short of the outer one — centred in
 * the glass at every point of the arc.
 */
const DAY_BASELINE = "M30.31 22.90 A33.5 33.5 0 0 1 69.69 22.90";

/**
 * The id the weekday's textPath points at.
 *
 * A constant, not a `useId()`. The generated kind is only stable when the
 * server and the browser walk an identical tree, and this face renders inside
 * a Suspense boundary that does not — so the two sides stamped different ids
 * and React reported a hydration mismatch on every load. Every clock draws
 * the same arc at the same viewBox coordinates, so there is nothing to keep
 * unique: two faces on a page can share one path.
 */
const DAY_BASELINE_ID = "paon-analogue-day-baseline";

/** The dial's gradient ground, referenced by the stylesheet. */
const FACE_FILL_ID = "paon-analogue-face-fill";
/** The pearl's highlight and its rim shade, laid over the ground. */
const PEARL_SHEEN_ID = "paon-analogue-pearl-sheen";
const PEARL_RIM_ID = "paon-analogue-pearl-rim";

/**
 * The date aperture, cut the way a watch cuts one: the short edges bow out
 * and the corners are rounded off, rather than a plain rounded rectangle.
 */
/*
 * Cut to carry the date and no more: the widest date, "30", is 17.5 units
 * across and its figures about 7 tall, so the window is 20 × 11.5 — a unit
 * and a bit of margin round the numbers, centred on them.
 */
const DATE_WINDOW =
  "M68 46.2 Q68 44.6 70 44.4 Q78 43.8 86 44.4 Q88 44.6 88 46.2 L88 53.8 " +
  "Q88 55.4 86 55.6 Q78 56.2 70 55.6 Q68 55.4 68 53.8 Z";

/**
 * The cyclops: the magnifying bubble set into the crystal over the date. It
 * takes the window's own shape stepped out a single unit all round — close
 * enough that it reads as the lens over those two figures, not a pane.
 */
const DATE_LENS =
  "M67 45.4 Q67 43.6 69.2 43.4 Q78 42.7 86.8 43.4 Q89 43.6 89 45.4 " +
  "L89 54.6 Q89 56.4 86.8 56.6 Q78 57.3 69.2 56.6 Q67 56.4 67 54.6 Z";

/** The lens's glint: a soft crescent across its upper edge. */
const DATE_LENS_GLINT =
  "M68.6 45.6 Q68.9 44.3 70.4 44.1 Q78 43.5 85.6 44.1 Q87.1 44.3 87.4 45.6 " +
  "Q78 44.6 68.6 45.6 Z";

/** The glass's shading, referenced by the lens overlay. */
const LENS_GLASS_ID = "paon-analogue-lens-glass";

export function AnalogueClock({
  size = 46,
  timeZone = HOME_LOCATION.timeZone,
}: {
  size?: number;
  /**
   * Which clock the face keeps. It defaults to home — beside readings that
   * are all Breda's, a face on the viewer's own machine time reads as a
   * fault: at 19:00 in Breda a reader in Saigon saw the dial say SUNDAY 13
   * next to a strip saying SAT · 12 SEPT.
   *
   * The default is taken here rather than passed in from the page: the page
   * is a server component, and a plain constant exported from a "use client"
   * module reaches one as a client reference rather than as its value — the
   * prop arrived undefined and the dial quietly went back to local time.
   * This file is a client module, so the import gives it the real string.
   */
  timeZone?: string;
}) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const tick = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(tick);
  }, []);

  /* Every hand and both windows are read out of one formatting, in the
     zone the face keeps, so the dial can never disagree with itself. */
  const parts = now
    ? new Intl.DateTimeFormat("en-GB", {
        weekday: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
        ...(timeZone ? { timeZone } : {}),
      }).formatToParts(now)
    : [];
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  const num = (type: Intl.DateTimeFormatPartTypes) => Number(part(type)) || 0;

  const seconds = num("second");
  const minutes = num("minute") + seconds / 60;
  const hours = (num("hour") % 12) + minutes / 60;

  /* The day in full — SATURDAY, not SAT — which is what the arc is for. */
  const weekday = part("weekday").toUpperCase();
  const monthDay = part("day");

  return (
    <svg
      className="paon-analogue"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label={
        now
          ? `Analogue clock showing ${part("hour")}:${part("minute")}`
          : "Analogue clock"
      }
    >
      {/* The dial's ground: the same fade the chosen piece wears in the
          third column — the seconds hand's blue at 30% over white on the
          left, white on the right — mixed down to opaque stops so it reads
          the same over any column ground. A fixed id, like the day's
          baseline, so the server and the browser agree on it. */}
      <defs>
        {/* Top to bottom, turned 45° counter-clockwise: the blue comes in
            from between ten and eleven and falls to white towards half past
            four. A negative rotation is counter-clockwise in SVG's y-down
            space; objectBoundingBox units turn it about the dial's centre. */}
        <linearGradient
          id={FACE_FILL_ID}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
          gradientTransform="rotate(-45 0.5 0.5)"
        >
          {/* Mother-of-pearl: the seconds-hand blue at its palest, drifting
              through a breath of lilac and of mint into a warm pearl white —
              the hue shift is what reads as nacre rather than a tint. */}
          <stop offset="0%" stopColor="#cbe4f5" />
          <stop offset="30%" stopColor="#e2ebfa" />
          <stop offset="52%" stopColor="#efeaf9" />
          <stop offset="72%" stopColor="#e6f4f2" />
          <stop offset="100%" stopColor="#fdfaf5" />
        </linearGradient>
        {/* The sheen: a soft white bloom where the light catches the dial,
            up and to the left. */}
        <radialGradient id={PEARL_SHEEN_ID} cx="0.32" cy="0.28" r="0.6">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="45%" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        {/* A cool shade just inside the rim, so the dial reads as a curved
            surface catching light rather than a flat disc. */}
        <radialGradient id={PEARL_RIM_ID} cx="0.5" cy="0.5" r="0.5">
          <stop offset="78%" stopColor="#6c8cad" stopOpacity="0" />
          <stop offset="100%" stopColor="#6c8cad" stopOpacity="0.16" />
        </radialGradient>
        {/* The crystal over the date: brightest at the top where it catches
            the light, clear through the middle, a breath of shade at the
            foot where the bubble curves away. */}
        <linearGradient id={LENS_GLASS_ID} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.75" />
          <stop offset="45%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.07" />
        </linearGradient>
      </defs>
      <circle className="paon-analogue-face" cx="50" cy="50" r="47" />
      <circle cx="50" cy="50" r="47" fill={`url(#${PEARL_SHEEN_ID})`} />
      <circle cx="50" cy="50" r="47" fill={`url(#${PEARL_RIM_ID})`} />

      {/* The weekday, spelt out along the half-circle under twelve. */}
      <path className="paon-analogue-window" d={DAY_WINDOW} />
      <path id={DAY_BASELINE_ID} d={DAY_BASELINE} fill="none" stroke="none" />
      <text className="paon-analogue-day">
        {/* Fitted to the arc rather than trusted to fit it: the day names
            run from MONDAY to WEDNESDAY and the arc is a fixed length, so
            every day keeps the typeface's natural spacing. The aperture is
            cut around WEDNESDAY, so shorter names remain compact instead of
            being stretched across the window. */}
        <textPath href={`#${DAY_BASELINE_ID}`} startOffset="50%">
          {weekday}
        </textPath>
      </text>

      {/* The house signs the dial where a watchmaker signs one: the upper
          half, clear of the day window above it and the hands below. Fitted
          to a fixed width so it never runs into the window's shoulders. */}
      {/* y is in viewBox units; the face renders at 72px, so 2.8 units is
          the 2px lift on screen. */}
      <text className="paon-analogue-brand" x="50" y="37.3" textLength="37.8">
        Nebel &amp; Spiegel
      </text>

      {/* The date, at three. The aperture and nothing else — no ring drawn
          around it — with the figure inside set larger than the weekday,
          which is what the magnification actually looks like. */}
      {/* The lens seat and the window under it, both white — the date
          reads through a white aperture beneath clear glass. */}
      <path className="paon-analogue-lens" d={DATE_LENS} />
      <path className="paon-analogue-datewin" d={DATE_WINDOW} />
      <text className="paon-analogue-date" x="78" y="53.6">
        {monthDay}
      </text>
      {/* The cyclops's glass over the date. Drawn before the ticks and the
          hands: SVG stacks in document order, and the hands sit on top of
          everything else on the dial. */}
      <path className="paon-analogue-lens-glass" d={DATE_LENS} />
      <path className="paon-analogue-lens-glint" d={DATE_LENS_GLINT} />

      {TICKS.map((angle) => (
        <line
          key={angle}
          className={
            angle % 90 === 0
              ? "paon-analogue-tick is-hour"
              : "paon-analogue-tick"
          }
          x1="50"
          y1={angle % 90 === 0 ? 9 : 11}
          x2="50"
          y2={angle % 90 === 0 ? 18 : 16}
          transform={`rotate(${angle} 50 50)`}
        />
      ))}
      {now ? (
        <>
          <line
            className="paon-analogue-hand is-hour"
            x1="50"
            y1="54"
            x2="50"
            y2="28"
            transform={`rotate(${hours * 30} 50 50)`}
          />
          <line
            className="paon-analogue-hand is-minute"
            x1="50"
            y1="55"
            x2="50"
            y2="17"
            transform={`rotate(${minutes * 6} 50 50)`}
          />
          <line
            className="paon-analogue-hand is-second"
            x1="50"
            y1="58"
            x2="50"
            y2="15"
            transform={`rotate(${seconds * 6} 50 50)`}
          />
        </>
      ) : null}
      <circle className="paon-analogue-pin" cx="50" cy="50" r="3" />
    </svg>
  );
}
