"use client";

import Image from "next/image";
import Link from "next/link";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import "./overview.css";
import { PearlField } from "./pearl-field";

/**
 * The pieces that make up today's highlight, each with its own button. The
 * hero piece is in the selection from the start; every other line adds to or
 * comes off the running total, shown inclusive of VAT.
 *
 * Each piece is a white rectangle, and the whole rectangle IS the button —
 * thumbnail, copy and price are all inside one <button>, so a press anywhere
 * on it toggles the piece and there is exactly one control per piece for the
 * keyboard and for a screen reader. Pressing a piece that is already in takes
 * it out again, the hero piece included; `aria-pressed` carries that state,
 * and a selected card is marked by a shimmering 1px gradient edge rather than
 * by a filled pill.
 *
 * Inside the rectangle, three registers: the name with its price set against
 * it on the same line, the material under it, and the make — full canvas,
 * handmade, Goodyear welt — in its own grey field beneath, where a piece has
 * one.
 */

type OutfitPiece = {
  id: string;
  name: string;
  /** The mill, set bold ahead of the cloth where the house names it. */
  mill?: string;
  material: string;
  priceEur: number;
  tags: string[];
  /** Product photo when there is one; otherwise the swatch colour stands in. */
  image?: string;
  swatch: string;
  hero?: boolean;
};

const OUTFIT: readonly OutfitPiece[] = [
  {
    id: "suit",
    /* "Double-Breasted" shortened to the trade's own D-B so the name
       finishes on one line at the sidebar's 12px. */
    name: "Midnight Blue D-B Suit",
    mill: "Drago",
    material: "S'130 Solaro Herringbone",
    priceEur: 2149,
    tags: ["Full canvas", "Handmade"],
    image: "https://www.nebelspiegel.com/images/smaller/6088.webp",
    swatch: "#1f2740",
    hero: true,
  },
  {
    id: "shirt",
    name: "Light Blue Striped Shirt",
    material: "100% Cotton Poplin (Albini)",
    priceEur: 189,
    tags: ["Handmade"],
    swatch: "#dfe7f2",
  },
  {
    id: "tie",
    name: "Navy Knit Tie",
    material: "100% Silk",
    priceEur: 129,
    tags: ["Northern Italy"],
    swatch: "#1b2340",
  },
  {
    id: "loafer",
    name: "Black Tassel Loafer",
    material: "Calfskin Leather · Black",
    priceEur: 449,
    tags: ["Goodyear welt"],
    swatch: "#14110f",
  },
];

const VAT_RATE = 0.21;

/**
 * The atelier quotes three weeks for a made piece, and it delivers on a
 * Thursday. The arrival is therefore the first Thursday on or after three
 * weeks from today — never a date the house cannot keep.
 */
const LEAD_TIME_DAYS = 21;
/** Thursday. `Date.getDay()` counts from Sunday. */
const DELIVERY_WEEKDAY = 4;

/** How many days the reel winds back before it settles on the arrival. */
const REEL_RUN_UP = 5;

function arrivalDate(from: Date): Date {
  const date = new Date(from);
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + LEAD_TIME_DAYS);
  /* Forward to the first Thursday on or after that day. */
  const ahead = (DELIVERY_WEEKDAY - date.getDay() + 7) % 7;
  date.setDate(date.getDate() + ahead);
  return date;
}

function euro(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function CrossfadePrice({ amount }: { amount: number }) {
  const value = euro(amount);
  const [prices, setPrices] = useState<{
    current: string;
    previous: string | null;
  }>(() => ({ current: value, previous: null }));

  useEffect(() => {
    setPrices((current) =>
      current.current === value
        ? current
        : { current: value, previous: current.current },
    );
    const settle = window.setTimeout(() => {
      setPrices((current) =>
        current.current === value ? { ...current, previous: null } : current,
      );
    }, 400);
    return () => window.clearTimeout(settle);
  }, [value]);

  return (
    <strong
      className="paon-outfit-total-price"
      aria-live="polite"
      aria-atomic="true"
    >
      {prices.previous ? (
        <span
          key={`previous-${prices.previous}-${prices.current}`}
          className="paon-outfit-total-price-previous"
          aria-hidden="true"
        >
          {prices.previous}
        </span>
      ) : null}
      <span key={prices.current} className="paon-outfit-total-price-current">
        {prices.current}
      </span>
    </strong>
  );
}

function CrossfadePieceCount({ count }: { count: number }) {
  const value = `${count} ${count === 1 ? "piece" : "pieces"}`;
  const [counts, setCounts] = useState<{
    current: string;
    previous: string | null;
  }>(() => ({ current: value, previous: null }));

  useEffect(() => {
    setCounts((current) =>
      current.current === value
        ? current
        : { current: value, previous: current.current },
    );
    const settle = window.setTimeout(() => {
      setCounts((current) =>
        current.current === value ? { ...current, previous: null } : current,
      );
    }, 400);
    return () => window.clearTimeout(settle);
  }, [value]);

  return (
    <span
      className="paon-outfit-total-count"
      aria-live="polite"
      aria-atomic="true"
    >
      {counts.previous ? (
        <span
          key={`previous-${counts.previous}-${counts.current}`}
          className="paon-outfit-total-count-previous"
          aria-hidden="true"
        >
          {counts.previous}
        </span>
      ) : null}
      <span key={counts.current} className="paon-outfit-total-count-current">
        {counts.current}
      </span>
    </span>
  );
}

/** How long the reel takes to wind from the run-up to the arrival. */
const REEL_MS = 2000;
/** Centre-to-centre distance between two leaves, in px. Matches the CSS. */
const REEL_STEP = 62;

/** Quintic ease-out: it leaves fast and lands soft, like a date wheel. */
function easeOutQuint(t: number): number {
  return 1 - (1 - t) ** 5;
}

/**
 * The two halves above the total: on the left, when the pieces reach the
 * wardrobe; on the right, the fitting the house offers once the order is
 * placed.
 *
 * The date is not printed, it arrives: a carousel of calendar leaves runs in
 * from five days short and settles with the delivery Thursday in the middle
 * slot over two seconds, the day before and the day after part-faded and a
 * size smaller either side of it. The size is not a state the leaves switch
 * between — it is a function of how far each one is from the middle at that
 * instant, driven frame by frame, so a leaf grows as it comes into the centre
 * and shrinks again as it leaves. A CSS transition cannot do that: it only
 * knows where the reel started and where it ends.
 *
 * It replays on every return to the wardrobe, not only on mount. The
 * environment layer fires `paon:environment-entering` before the panel has
 * moved — which is where the reel is wound back, while it is still off
 * screen — and `paon:environment-settled` once it is fully on, which is where
 * it runs.
 *
 * The dates are worked out in an effect rather than during render — the
 * server has no idea what day it is where the reader is, and rendering
 * `new Date()` on both sides is a hydration mismatch. Until it runs, the
 * reel is blank rather than wrong.
 */
function ArrivalAndFitting() {
  const [today, setToday] = useState<Date | null>(null);
  /**
   * Which leaf is in the middle slot, as a fraction — 1 is the start of the
   * run-up, REEL_RUN_UP + 1 the arrival. Everything about the reel's look at
   * a given instant is read off this one number.
   */
  const [position, setPosition] = useState(1);
  /** True once the reel has come to rest on the arrival — it lights up. */
  const [landed, setLanded] = useState(false);
  const frame = useRef<number | null>(null);

  useEffect(() => setToday(new Date()), []);

  const settledAt = REEL_RUN_UP + 1;

  const lastEnvironmentSettledRef = useRef<number>(0);

  const runReel = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    setLanded(false);
    lastEnvironmentSettledRef.current = performance.now();
    const startedAt = performance.now();
    const travel = settledAt - 1;
    const step = (stamp: number) => {
      const t = Math.min(1, (stamp - startedAt) / REEL_MS);
      const nextPosition = 1 + travel * easeOutQuint(t);
      const remainingPixels = (settledAt - nextPosition) * REEL_STEP;
      if (remainingPixels > 0.5) {
        setPosition(nextPosition);
        frame.current = requestAnimationFrame(step);
      } else {
        setPosition(settledAt);
        frame.current = null;
        /* Light the leaf on the same frame its last visible movement ends. */
        setLanded(true);
      }
    };
    frame.current = requestAnimationFrame(step);
  }, [settledAt]);

  /* Two frames before the first run: the reel has to paint wound back before
     anything moves, or the browser coalesces both into the final state and
     there is no travel to see. */
  useEffect(() => {
    if (!today) return;
    const armed = requestAnimationFrame(() => requestAnimationFrame(runReel));
    return () => {
      cancelAnimationFrame(armed);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [runReel, today]);

  /* Every return to the wardrobe replays it. */
  useEffect(() => {
    const isCustomer = (event: Event) =>
      (event as CustomEvent<string>).detail === "customer";
    /* Wound back while the panel is still off screen. */
    const arm = (event: Event) => {
      if (!isCustomer(event)) return;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      setPosition(1);
      setLanded(false);
    };
    const play = (event: Event) => {
      if (isCustomer(event)) {
        lastEnvironmentSettledRef.current = performance.now();
        runReel();
      }
    };
    window.addEventListener("paon:environment-entering", arm);
    window.addEventListener("paon:environment-settled", play);
    return () => {
      window.removeEventListener("paon:environment-entering", arm);
      window.removeEventListener("paon:environment-settled", play);
    };
  }, [runReel]);

  /* Replay reel animation when returning to /dashboard via tab switch or route change.
     Coalesce with environment-settled to avoid double-firing within 2000ms. */
  useEffect(() => {
    const onRouteVisible = (event: Event) => {
      const customEvent = event as CustomEvent<{ pathname: string }>;
      const pathname = customEvent.detail?.pathname;
      if (!pathname || pathname !== "/dashboard") return;

      const now = performance.now();
      const timeSinceSettled = now - lastEnvironmentSettledRef.current;
      /* Skip if environment-settled fired very recently (coalesce window). */
      if (timeSinceSettled < 2000) return;

      if (frame.current !== null) cancelAnimationFrame(frame.current);
      setPosition(1);
      setLanded(false);
      lastEnvironmentSettledRef.current = now;
      runReel();
    };
    window.addEventListener("paon:customer-route-visible", onRouteVisible);
    return () => {
      window.removeEventListener("paon:customer-route-visible", onRouteVisible);
    };
  }, [runReel]);

  /* One leaf per day from a day past the arrival back to a day before the
     run-up starts, so there is always a neighbour to show either side. */
  const leaves = useMemo(() => {
    if (!today) return null;
    const arrival = arrivalDate(today);
    const offsets: number[] = [];
    for (let offset = -REEL_RUN_UP - 1; offset <= 1; offset += 1)
      offsets.push(offset);
    return offsets.map((offset) => {
      const date = new Date(arrival);
      date.setDate(date.getDate() + offset);
      return {
        offset,
        weekday: date
          .toLocaleDateString("en-GB", { weekday: "short" })
          .toUpperCase(),
        day: date.getDate(),
        month: date
          .toLocaleDateString("en-GB", { month: "short" })
          .toUpperCase(),
      };
    });
  }, [today]);

  const arrivalLabel = useMemo(
    () =>
      today
        ? arrivalDate(today).toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })
        : null,
    [today],
  );

  return (
    <div className="paon-outfit-promise">
      <div className="paon-outfit-promise-half">
        <div className="paon-outfit-calendar" aria-hidden="true">
          {/* The reel is offset by one so the leaf before the centred one
              shows on the left and the one after it on the right. */}
          <div
            className="paon-outfit-reel"
            style={
              {
                transform: `translateX(${-(position - 1) * REEL_STEP}px)`,
              } as CSSProperties
            }
          >
            {(leaves ?? []).map((leaf, index) => {
              /* How far this leaf is from the middle slot right now: 0 in
                 the centre, 1 one slot out. Both the size and the weight of
                 a leaf fall away with it. */
              const distance = Math.min(2, Math.abs(index - position));
              return (
                <span
                  key={leaf.offset}
                  className={[
                    "paon-outfit-leaf",
                    landed && leaf.offset === 0 ? "is-landed" : "",
                  ].join(" ")}
                  style={
                    {
                      transform: `scale(${(1 - 0.16 * distance).toFixed(3)})`,
                      opacity: (1 - 0.42 * distance).toFixed(3),
                      "--paon-leaf-ink": `rgba(20, 18, 15, ${(
                        0.62 -
                        0.3 * distance
                      ).toFixed(3)})`,
                    } as CSSProperties
                  }
                >
                  {/* The weekday over the figure, the month under it: a
                      delivery date is read as "Thursday the 8th of October",
                      and the leaf says it in that order. */}
                  <small>{leaf.weekday}</small>
                  <strong>{leaf.day}</strong>
                  <small>{leaf.month}</small>
                </span>
              );
            })}
          </div>
        </div>
        {/* Broken by hand, not by the measure: the line endings are the
            founder's, and leaving them to the wrap meant they moved with the
            column's width and with the length of whatever day the date falls
            on. The breaks hold; the wrap is only a safety net under a very
            long date. */}
        <p className="paon-outfit-promise-copy paon-outfit-arrival-copy">
          Your new items are
          <br />
          anticipated to complement
          <br />
          your wardrobe by
          <br />
          {arrivalLabel ? <strong>{arrivalLabel}.</strong> : null}
        </p>
      </div>
      <div className="paon-outfit-promise-half">
        {/* The tailor's tape, drawn rather than photographed: the column has
            one photograph per piece already, and a stock picture here would
            be the only image on the page that sells nothing. */}
        <span className="paon-outfit-fitting-mark" aria-hidden="true">
          <svg viewBox="0 0 48 48" fill="none" stroke="currentColor">
            <path
              d="M6 17h36a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V19a2 2 0 0 1 2-2Z"
              strokeWidth="2"
            />
            <path
              d="M11 17v6M17 17v9M23 17v6M29 17v9M35 17v6"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <p className="paon-outfit-promise-copy">
          Wish to review your sizes? Book your complimentary fitting after
          check-out.
        </p>
      </div>
    </div>
  );
}

/** The size a name is set at before it is fitted. */
const NAME_BASE_PX = 14.5;
/**
 * Below this it stops being a product name and starts being fine print.
 *
 * Only a floor: the fitter always picks the largest size that fits, so this
 * is reached only on a narrow column. At 11 the suit's name still ran 4px
 * past its room on a 1443px window and picked up an ellipsis, which is the
 * one thing a name here must never do.
 */
const NAME_MIN_PX = 10;

/**
 * Sets every piece's name at the largest size that still lets the longest of
 * them finish on one line.
 *
 * One size for all of them, not a size each: names at four different sizes
 * down a column read as four different kinds of thing. So the longest name
 * sets the size and the rest follow it.
 *
 * It measures rather than guesses — the column's width depends on the window
 * and the names come from the catalogue, so there is no number to hard-code.
 * A hidden probe carrying the name's own typography gives its natural
 * one-line width; the room it has is the head row less the price.
 */
function useFittedNames(listRef: React.RefObject<HTMLUListElement | null>) {
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const fit = () => {
      const heads = [
        ...list.querySelectorAll<HTMLElement>(".paon-outfit-head"),
      ];
      if (!heads.length) return;
      const probe = document.createElement("span");
      probe.setAttribute("aria-hidden", "true");
      probe.style.cssText =
        "position:absolute;left:-9999px;top:0;white-space:nowrap;visibility:hidden";
      document.body.appendChild(probe);

      let ratio = 1;
      for (const head of heads) {
        const name = head.querySelector<HTMLElement>(".paon-outfit-name");
        const price = head.querySelector<HTMLElement>(".paon-outfit-price");
        if (!name || !price) continue;
        const style = getComputedStyle(name);
        probe.style.font = style.font;
        probe.style.letterSpacing = style.letterSpacing;
        probe.textContent = name.textContent;
        const natural = probe.getBoundingClientRect().width;
        if (!natural) continue;
        /* The head's width less the price and the gap between them. */
        /* Two pixels short of the exact room: a fit that lands on the last
           sub-pixel rounds over it once the text is laid out, and the name
           picks up an ellipsis it does not need. */
        const room =
          head.getBoundingClientRect().width -
          price.getBoundingClientRect().width -
          parseFloat(getComputedStyle(head).columnGap || "0") -
          2;
        ratio = Math.min(ratio, room / natural);
      }
      probe.remove();

      const size = Math.max(
        NAME_MIN_PX,
        Math.min(NAME_BASE_PX, NAME_BASE_PX * ratio),
      );
      list.style.setProperty("--paon-name-size", `${size.toFixed(2)}px`);
    };

    /* Fonts land after first paint, and a name measured in the fallback face
       is the wrong width. */
    fit();
    void document.fonts?.ready.then(fit);
    const observer = new ResizeObserver(fit);
    observer.observe(list);
    return () => observer.disconnect();
  }, [listRef]);
}

export function OutfitBreakdown() {
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set(OUTFIT.filter((piece) => piece.hero).map((p) => p.id)),
  );
  const listRef = useRef<HTMLUListElement>(null);
  useFittedNames(listRef);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (selected.size === 0) setSaved(false);
  }, [selected.size]);

  const total = OUTFIT.filter((piece) => selected.has(piece.id)).reduce(
    (sum, piece) => sum + piece.priceEur,
    0,
  );

  /**
   * The piece just let go of, while the pointer is still on it. Hovering a
   * resting card brings its pearl in, so without this a card released under
   * the pointer would keep its pearl and never read as released. It fades to
   * white instead, and the hover pearl returns only once the pointer has left
   * the card and come back.
   */
  const [released, setReleased] = useState<string | null>(null);

  const toggle = (id: string) => {
    setReleased(selected.has(id) ? id : null);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <section className="paon-outfit" aria-label="Today’s outfit">
      {/* The progressive blur the pieces sit on when this list floats over
          the photograph (morning layout; display:none everywhere else). Five
          stacked layers, each blurring more than the last and masked to begin
          lower, so the picture goes soft under the copy with no hard edge —
          one backdrop-filter can only give a single radius, which reads as a
          band. It extends above the list so the ramp starts on open photo. */}
      <div className="paon-outfit-veil" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      {/* The column names itself, under a rule, in the same small voice the
          readings strip and the world clock use. */}
      <h2 className="paon-outfit-heading">Outfit of the day</h2>
      {/* data-no-press: EnvironmentMotion squeezes every <button> in the
          environment on pointerdown and springs it back with an overshoot;
          the rows are toggles, not buttons to be pressed, and stay still. */}
      <ul className="paon-outfit-list" data-no-press ref={listRef}>
        {OUTFIT.map((piece) => {
          const inSelection = selected.has(piece.id);
          return (
            <li key={piece.id}>
              {/*
               * One rectangle, two controls. The whole card still toggles the
               * piece — a full-bleed button laid under the copy takes every
               * press that lands anywhere on it — and the ••• beside the make
               * opens the piece's configuration. The card itself is a <div>,
               * not a <button>: a button cannot contain another button, so
               * the toggle had to step out of the wrapper to let ••• in.
               */}
              <div
                className={[
                  "paon-outfit-piece",
                  inSelection ? "is-selected" : "",
                  released === piece.id ? "is-released" : "",
                ].join(" ")}
                onPointerLeave={() => {
                  if (released === piece.id) setReleased(null);
                }}
              >
                <PearlField seed={piece.id} />
                <button
                  type="button"
                  className="paon-outfit-hit"
                  aria-pressed={inSelection}
                  aria-label={`${inSelection ? "Remove" : "Add"} ${piece.name}, ${
                    inSelection ? "" : "+ "
                  }${euro(piece.priceEur)}`}
                  onClick={() => toggle(piece.id)}
                />
                <span
                  className="paon-outfit-thumb"
                  /* The image is also handed to CSS: a square thumb fills the
                     space a portrait photograph leaves beside it by stretching
                     that photograph's own edge pixels, so there is never a
                     band of another colour. */
                  style={
                    {
                      background: piece.swatch,
                      ...(piece.image
                        ? { "--paon-piece-image": `url(${piece.image})` }
                        : {}),
                    } as CSSProperties
                  }
                  aria-hidden="true"
                >
                  {piece.image ? (
                    <Image
                      src={piece.image}
                      alt=""
                      fill
                      unoptimized
                      sizes="64px"
                    />
                  ) : null}
                </span>
                <span className="paon-outfit-copy">
                  {/* The name and the price share the top line, the price set
                      hard right. "+" while the piece is still to be added; it
                      keeps its slot either way so the number never shifts. */}
                  <span className="paon-outfit-head" aria-hidden="true">
                    <span className="paon-outfit-name">{piece.name}</span>
                    <span className="paon-outfit-price">
                      <span className="paon-outfit-price-plus">+</span>
                      {euro(piece.priceEur)}
                    </span>
                  </span>
                  <span className="paon-outfit-material" aria-hidden="true">
                    {piece.mill ? (
                      <>
                        <strong className="paon-outfit-mill">
                          {piece.mill}
                        </strong>{" "}
                      </>
                    ) : null}
                    {piece.material}
                  </span>
                  {/* The make, in its own white field, and beside it the way
                      into the piece's configuration, in a field of the same
                      cut. */}
                  <span className="paon-outfit-tagrow">
                    {piece.tags.length ? (
                      <span className="paon-outfit-tags" aria-hidden="true">
                        {piece.tags.join(" · ")}
                      </span>
                    ) : null}
                    {/* In the row, not over the card: the toggle is a sibling
                        layer beneath the copy, not a wrapper round it, so
                        this link is not inside a button and can sit in the
                        flow beside the make. */}
                    <Link
                      href="/r/atelier-demo/configurator"
                      className="paon-outfit-configure"
                      aria-label={`Configure ${piece.name}`}
                    >
                      <span aria-hidden="true" />
                      <span aria-hidden="true" />
                      <span aria-hidden="true" />
                    </Link>
                  </span>
                </span>
              </div>
              {/* The hero is the look; everything under it is an addition to
                  it. A short rule says so without a heading. */}
              {piece.hero ? (
                <span className="paon-outfit-rule" aria-hidden="true" />
              ) : null}
            </li>
          );
        })}
      </ul>
      {/* Two halves over the total: when the pieces land, and the fitting that
          follows the order. Ruled top and bottom, divided down the middle. */}
      <ArrivalAndFitting />
      <div className="paon-outfit-total">
        <span>
          Total incl. {Math.round(VAT_RATE * 100)}% VAT ·{" "}
          <CrossfadePieceCount count={selected.size} />
        </span>
        <CrossfadePrice amount={total} />
      </div>
      {/* The product panel's own checkout row: heart · Continue In-Store ·
          Add to Bag. One vocabulary for "take this further", wherever it
          appears. */}
      <div className="paon-outfit-actions">
        {/* A toggle, not a link: the favourite says whether the look is
            saved, and it says it the way every product in the house does —
            by swapping the pierced-heart mark for its filled twin. */}
        {/* data-no-press: EnvironmentMotion squeezes every <button> in the
            environment on pointerdown and springs it back. The favourite
            became a <button> when it turned into a toggle, and picked that
            up; its feedback is the hearts cross-fading, not a squeeze. */}
        <button
          type="button"
          data-no-press
          className="paon-outfit-heart"
          disabled={selected.size === 0}
          aria-label={
            selected.size === 0
              ? "Select an outfit piece before saving"
              : saved
                ? "Remove this outfit from favourites"
                : "Save this outfit"
          }
          aria-pressed={saved}
          onClick={() => setSaved((current) => !current)}
        >
          <span className="paon-outfit-heart-mark" aria-hidden="true" />
        </button>
        <Link
          href="/r/atelier-demo"
          className="paon-outfit-action"
          aria-disabled={selected.size === 0}
          tabIndex={selected.size === 0 ? -1 : undefined}
          onClick={(event) => {
            if (selected.size === 0) event.preventDefault();
          }}
        >
          Continue In-Store
        </Link>
        <Link
          href="/r/atelier-demo/cart"
          className="paon-outfit-action paon-outfit-action-primary"
          aria-disabled={selected.size === 0}
          tabIndex={selected.size === 0 ? -1 : undefined}
          onClick={(event) => {
            if (selected.size === 0) event.preventDefault();
          }}
        >
          <PearlField seed="add-to-bag" />
          {/* Its own element so the wordmark's shimmer, painted into the letters,
              sits above the button's fill layer rather than beneath it. */}
          <span className="paon-outfit-action-label">Add to Bag</span>
        </Link>
      </div>
    </section>
  );
}
