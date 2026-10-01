"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";

import { BookAppointmentLauncher } from "./book-appointment-launcher";
import type { BookableBranch } from "./booking-flow";
import { useSmoothCarousel } from "./use-smooth-carousel";

export interface MonthData {
  readonly id: string;
  readonly month: string;
  readonly monthName: string;
  readonly monthNumber: string;
  readonly year: number;
  readonly title: string;
  readonly copy: string;
  readonly imageUrl: string;
  readonly isPast: boolean;
  readonly isCurrent: boolean;
  readonly accent?: string;
}

/** Seconds between one card's entrance and the next. */
const SPAWN_STEP = 0.2;

/**
 * The stagger stops counting after this many cards. The timeline runs twelve
 * months deep, and letting every one take its turn meant the last card — and the
 * date marker waiting behind it — arrived five seconds in, long after the reader
 * had looked. Only the cards that can be on screen get a delay.
 */
const SPAWN_CAP = 7;

export function AppointmentMonthCarousel({
  retailerId,
  branches,
  months,
}: {
  retailerId: string;
  branches: readonly BookableBranch[];
  months: readonly MonthData[];
}) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const todayMarkerRef = useRef<HTMLDivElement>(null);
  // Shared with the idea carousel; defined in customer-environment.css.
  const timelineCardWidth = "var(--paon-card-w)";

  const scrollBy = useSmoothCarousel(carouselRef);
  const scroll = (direction: "left" | "right") => {
    const card = carouselRef.current?.querySelector<HTMLElement>(
      ".appointment-month-carousel-card",
    );
    scrollBy(direction, (card?.offsetWidth ?? 260) + 10);
  };

  const visibleMonths = months.filter((month) => !month.isPast);

  // Every card is on the same 0.2s cadence, so the marker waits for the last one
  // rather than sliding in over a half-built timeline.
  const spawnCount = Math.min(visibleMonths.length + 1, SPAWN_CAP);
  const todayMarker = useTodayMarker(timelineCardWidth);
  const markerReady = useCardsSettled(spawnCount);

  useEffect(() => {
    const marker = todayMarkerRef.current;
    if (!marker || !todayMarker || !markerReady) return;
    marker.animate(
      [
        { opacity: 0, transform: "translateX(-96px)" },
        { opacity: 1, transform: "translateX(0)" },
      ],
      { duration: 900, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "both" },
    );
  }, [todayMarker, markerReady]);

  return (
    <div className="appointment-month-carousel-section">
      <div className="appointment-month-carousel-header">
        <h2
          className="appointment-month-carousel-heading"
          style={{
            color: "rgba(244, 242, 236, 0.5)",
            fontFamily: "GTBold3, Arial, sans-serif",
            fontSize: 7,
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Wardrobe Planning
        </h2>
        <div className="appointment-month-carousel-arrows">
          <button
            onClick={() => scroll("left")}
            className="appointment-month-carousel-arrow appointment-month-carousel-arrow-left"
            aria-label="Scroll left"
          >
            ←
          </button>
          <button
            onClick={() => scroll("right")}
            className="appointment-month-carousel-arrow appointment-month-carousel-arrow-right"
            aria-label="Scroll right"
          >
            →
          </button>
        </div>
      </div>
      <div
        className="appointment-month-carousel"
        ref={carouselRef}
        style={{
          position: "relative",
          display: "block",
          overflowX: "auto",
          overflowY: "clip",
          overflowClipMargin: "160px",
          // Exactly the timeline: 28 top padding + the month rule (27) + the
          // 15px gap + the scene cards, whose height now tracks their width.
          // This box is what the grey wash is drawn to, so any slack here shows
          // as wash hanging below the cards.
          minHeight: "var(--paon-timeline-h)",
          width: "calc(100% + 56px)",
          marginLeft: -28,
          marginRight: -28,
          paddingTop: 28,
          paddingLeft: 28,
          // No trailing padding here: the rows carry the right gutter themselves
          // so that scrolled fully right, the last card lands exactly on the
          // page's content edge. See customer-environment.css.
          paddingRight: 0,
          // The gutter the today marker's line needs below the last row is set
          // in customer-environment.css, together with the negative margin that
          // gives it back, so the two can never drift apart.
          paddingBottom: 0,
        }}
      >
        {/* The three rows and the date marker travel together. The marker has to
            live inside this wrapper rather than directly in the scroll container:
            an absolutely positioned child of a scroller is placed against the
            scrollport and stays put while the content moves under it, which is
            why the date drifted off its month. The wrapper is ordinary scrolled
            content, so the marker rides with the months. */}
        <div
          className="appointment-timeline-track"
          style={{
            position: "relative",
            display: "grid",
            gap: 15,
            width: "max-content",
            minWidth: "100%",
          }}
        >
          <div
            className="appointment-timeline-ruler"
            aria-hidden="true"
            style={{
              display: "flex",
              flexDirection: "row",
              flexWrap: "nowrap",
              gap: 10,
              width: "max-content",
            }}
          >
            {visibleMonths.map((month) => (
              <span
                key={month.id}
                style={{
                  display: "block",
                  flex: `0 0 ${timelineCardWidth}`,
                  width: timelineCardWidth,
                }}
              >
                {month.monthName} {month.year}
              </span>
            ))}
          </div>
          <div
            className="appointment-timeline-scenes"
            style={{
              display: "flex",
              flexDirection: "row",
              flexWrap: "nowrap",
              gap: 10,
              width: "max-content",
            }}
          >
            {visibleMonths.map((month, index) => (
              <div
                key={month.id}
                className="appointment-month-carousel-card"
                data-appointment-month={month.month}
                style={
                  {
                    display: "block",
                    flex: `0 0 ${timelineCardWidth}`,
                    width: timelineCardWidth,
                    height: "var(--paon-timeline-card-h)",
                    "--spawn-index": Math.min(index + 1, SPAWN_CAP),
                  } as CSSProperties
                }
              >
                <BookAppointmentLauncher
                  retailerId={retailerId}
                  branches={branches}
                  initialReason="in_the_mood_for_something_fresh"
                  purpose={`${month.title || month.monthName} Appointment`}
                  initialMonth={month.month}
                  className="appointment-month-launcher"
                  style={
                    {
                      "--appointment-image": `url(${month.imageUrl})`,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "flex-end",
                      width: "100%",
                      height: "var(--paon-timeline-card-h)",
                    } as CSSProperties
                  }
                >
                  <span
                    className="appointment-month-title"
                    style={{ display: "block" }}
                  >
                    {month.title || "Private appointment"}
                  </span>
                  <span
                    className="appointment-month-copy"
                    style={{ display: "block" }}
                  >
                    {month.copy}
                  </span>
                </BookAppointmentLauncher>
              </div>
            ))}
          </div>
          <div
            className="appointment-timeline-today"
            ref={todayMarkerRef}
            hidden={todayMarker === null || !markerReady}
            // The line starts at the date pill and runs to the foot of the
            // timeline; the pill itself sits on the month row's centre line.
            style={{
              position: "absolute",
              zIndex: 3,
              // Zero, because the marker now lives inside the scrolled track, whose
              // own top edge is already the month row. Measuring from the track's
              // padding box instead pushed it a row down onto the products.
              top: 0,
              // The page's own 20px bottom gutter, which is exactly how far the
              // window's bottom edge is below the last row. The scroller's clip
              // edge is extended by the same 20px, so the line is not cut short
              // and the page gains no scroll height. See customer-environment.css.
              bottom: -20,
              left: todayMarker?.left ?? 0,
              width: 1,
              background: "#e5eb56",
              pointerEvents: "none",
            }}
          >
            <span
              // As tall as the month track, so it covers the rule above and the
              // rule below and sits between them rather than on top of one.
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                display: "flex",
                alignItems: "center",
                height: 27,
                transform: "translateX(-50%)",
                padding: "0 14px",
                borderRadius: 8,
                // A yellow outline on a clear, blurred ground with the date
                // in grey: the line is the marker, the pill only labels it.
                background: "rgba(229, 235, 86, 0.2)",
                border: "1px solid #e5eb56",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                color: "rgba(244, 242, 236, 0.42)",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.4px",
                textTransform: "uppercase",
                lineHeight: 1,
                whiteSpace: "nowrap",
              }}
            >
              {todayMarker?.label ?? ""}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * True once the staggered card entrances have all run. The marker is the last
 * thing to arrive, so it reads as landing on a finished timeline rather than
 * racing cards that are still fading in.
 */
function useCardsSettled(count: number) {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) {
      setSettled(true);
      return;
    }
    // The last card's delay, plus the entrance itself.
    const ms = count * SPAWN_STEP * 1000 + 700;
    const timer = window.setTimeout(() => setSettled(true), ms);
    return () => window.clearTimeout(timer);
  }, [count]);
  return settled;
}

/**
 * Today's label and its offset along the timeline, computed in the browser
 * after mount so the server never renders a date the client disagrees with.
 * The offset is measured against the same `max(220px, …)` card width the cards
 * themselves use — the unclamped term alone puts the marker left of where it
 * belongs on any viewport narrow enough for the floor to bite.
 */
/** Until the timeline opens (it starts on the launch month), today is
 * shown as 4 October 2026, so the marker sits inside October rather than
 * hanging off the start of it. */
const MARKER_EARLIEST = new Date(2026, 9, 4);

function useTodayMarker(
  cardWidth: string,
): { readonly label: string; readonly left: string } | null {
  const [marker, setMarker] = useState<{
    readonly label: string;
    readonly left: string;
  } | null>(null);

  useEffect(() => {
    const now = new Date(Math.max(Date.now(), MARKER_EARLIEST.getTime()));
    const daysInCurrentMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
    ).getDate();
    setMarker({
      label: new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
      }).format(now),
      // Measured from the first card's own left edge, which is where the track
      // wrapper begins.
      left: `calc(${cardWidth} * ${now.getDate() / daysInCurrentMonth})`,
    });
  }, [cardWidth]);

  return marker;
}
