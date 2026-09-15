"use client";

import type { CSSProperties } from "react";
import { useRef } from "react";

import { BookAppointmentLauncher } from "./book-appointment-launcher";
import type { BookableBranch } from "./booking-flow";

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

export function AppointmentMonthCarousel({
  retailerId,
  branches,
  months,
  retailerName = "your atelier",
}: {
  retailerId: string;
  branches: readonly BookableBranch[];
  months: readonly MonthData[];
  retailerName?: string;
}) {
  const carouselRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (!carouselRef.current) return;
    const scrollAmount = 260 + 10; // card width + gap
    carouselRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  // Filter to only render non-empty months
  const visibleMonths = months.filter(
    (month) => month.isPast || month.isCurrent || month.title !== "",
  );

  return (
    <div className="appointment-month-carousel-section">
      <div className="appointment-month-carousel-header">
        <h2 className="appointment-month-carousel-heading">
          Your next 12 months with {retailerName}
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
      <div className="appointment-month-carousel" ref={carouselRef}>
        {visibleMonths.map((month) => (
          <div
            key={month.id}
            className="appointment-month-carousel-card"
            data-appointment-month={month.month}
          >
            {month.isPast ? (
              <div className="appointment-month-past">
                <span className="appointment-month-name">
                  {month.monthName}
                </span>
                <span className="appointment-month-year">{month.year}</span>
              </div>
            ) : (
              <BookAppointmentLauncher
                retailerId={retailerId}
                branches={branches}
                initialReason="in_the_mood_for_something_fresh"
                purpose={`${month.title} Appointment`}
                initialMonth={month.month}
                className="appointment-month-launcher"
                style={
                  {
                    "--appointment-image": `url(${month.imageUrl})`,
                  } as CSSProperties
                }
              >
                <span className="appointment-month-topline">
                  <span className="appointment-month-name">
                    {month.monthName}
                  </span>
                </span>
                <span className="appointment-month-year">{month.year}</span>
                <span className="appointment-month-title">{month.title}</span>
                <span className="appointment-month-copy">{month.copy}</span>
                <span className="appointment-month-cta">Book visit →</span>
              </BookAppointmentLauncher>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
