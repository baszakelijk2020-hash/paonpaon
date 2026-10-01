"use client";

import type { CSSProperties } from "react";
import { useRef } from "react";

import { BookAppointmentLauncher } from "./book-appointment-launcher";
import type { BookableBranch } from "./booking-flow";
import { useSmoothCarousel } from "./use-smooth-carousel";

const APPOINTMENT_IDEAS = [
  {
    img: "https://www.nebelspiegel.com/images/chatpic03.png",
    caption: "I need white shirts",
    purpose: "I need white shirts",
    initialReason: "in_the_mood_for_something_fresh" as const,
  },
  {
    img: "https://www.nebelspiegel.com/images/chats222.png",
    caption: "I have a wedding",
    purpose: "I have a wedding",
    initialReason: "in_the_mood_for_something_fresh" as const,
  },
  {
    img: "https://www.nebelspiegel.com/images/chatpic02.png",
    caption: "I'm a wedding guest",
    purpose: "I'm a wedding guest",
    initialReason: "in_the_mood_for_something_fresh" as const,
  },
  {
    img: "https://www.nebelspiegel.com/images/chatpic04.png",
    caption: "I want to try your made-to-measure jeans",
    purpose: "I want to try your made-to-measure jeans",
    initialReason: "in_the_mood_for_something_fresh" as const,
  },
  {
    img: "https://www.nebelspiegel.com/images/chatpic04.png",
    caption: "How to find my style?",
    purpose: "How to find my style?",
    initialReason: "a_quick_glance" as const,
  },
] as const;

export function AppointmentIdeaCarousel({
  retailerId,
  branches,
}: {
  retailerId: string;
  branches: readonly BookableBranch[];
}) {
  const carouselRef = useRef<HTMLDivElement>(null);
  // Both carousels share one card width, set in customer-environment.css so the
  // width and the two aspect ratios that depend on it cannot drift apart.
  const cardWidth = "var(--paon-card-w)";

  const scrollBy = useSmoothCarousel(carouselRef);
  const scroll = (direction: "left" | "right") => {
    const card = carouselRef.current?.firstElementChild as HTMLElement | null;
    scrollBy(direction, (card?.offsetWidth ?? 280) + 10);
  };

  return (
    <div aria-label="Appointment ideas" className="appointment-idea-section">
      <div className="appointment-idea-header">
        <h3
          className="appointment-idea-heading"
          style={{
            color: "rgba(244, 242, 236, 0.5)",
            fontFamily: "GTBold3, Arial, sans-serif",
            fontSize: 7,
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Get started
        </h3>
        <div className="appointment-idea-arrows">
          <button
            onClick={() => scroll("left")}
            className="appointment-idea-arrow appointment-idea-arrow-left"
            aria-label="Scroll left"
          >
            ←
          </button>
          <button
            onClick={() => scroll("right")}
            className="appointment-idea-arrow appointment-idea-arrow-right"
            aria-label="Scroll right"
          >
            →
          </button>
        </div>
      </div>
      <div
        className="appointment-idea-carousel"
        ref={carouselRef}
        style={{
          width: "calc(100% + 56px)",
          marginLeft: -28,
          marginRight: -28,
          paddingLeft: 28,
          paddingRight: 28,
        }}
      >
        {APPOINTMENT_IDEAS.map((idea, index) => (
          <BookAppointmentLauncher
            key={index}
            retailerId={retailerId}
            branches={branches}
            initialReason={idea.initialReason}
            purpose={idea.purpose}
            className="appointment-idea-card"
            style={
              {
                "--appointment-idea-image": `url(${idea.img})`,
                "--spawn-index": Math.min(index, 7),
                flex: `0 0 ${cardWidth}`,
                width: cardWidth,
              } as CSSProperties
            }
          >
            <span className="appointment-idea-caption">{idea.caption}</span>
          </BookAppointmentLauncher>
        ))}
      </div>
    </div>
  );
}
