"use client";

import type { CSSProperties } from "react";
import { useRef } from "react";

import { BookAppointmentLauncher } from "./book-appointment-launcher";
import type { BookableBranch } from "./booking-flow";

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

  const scroll = (direction: "left" | "right") => {
    if (!carouselRef.current) return;
    const scrollAmount = 280 + 10; // card width + gap
    carouselRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  return (
    <div aria-label="Appointment ideas" className="appointment-idea-section">
      <div className="appointment-idea-header">
        <h3 className="appointment-idea-heading">Need an idea?</h3>
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
      <div className="appointment-idea-carousel" ref={carouselRef}>
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
