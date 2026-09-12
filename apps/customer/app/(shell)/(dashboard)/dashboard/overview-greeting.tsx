"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import "./overview.css";

function greetingForHour(hour: number): "morning" | "afternoon" | "evening" {
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

export function OverviewGreeting({
  firstName,
  nextAppointment,
}: {
  firstName: string;
  nextAppointment?: { href: string; startsAt: string };
}) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const interval = window.setInterval(update, 1_000);
    return () => window.clearInterval(interval);
  }, []);

  const hours = now?.getHours() ?? 0;
  const minutes = now?.getMinutes() ?? 0;
  const seconds = now?.getSeconds() ?? 0;
  const hourRotation = (hours % 12) * 30 + minutes * 0.5;
  const minuteRotation = minutes * 6 + seconds * 0.1;
  const secondRotation = seconds * 6;

  return (
    <section
      className="paon-overview-clock-card"
      aria-labelledby="overview-greeting"
    >
      <div className="paon-overview-clock-copy">
        <p className="paon-overview-context">
          <span className="paon-overview-presence" /> Your personal space
        </p>
        <h1 id="overview-greeting">
          Good {greetingForHour(hours)}, {firstName}.
        </h1>
        <p className="paon-overview-date">
          {now?.toLocaleDateString(undefined, {
            weekday: "long",
            day: "numeric",
            month: "long",
          }) ?? "Today"}
        </p>
        <div className="paon-overview-quick-actions">
          {nextAppointment ? (
            <Link
              href={nextAppointment.href}
              className="paon-overview-quick-card"
              data-pe-card
            >
              <span>Next appointment</span>
              <strong>
                {now
                  ? new Date(nextAppointment.startsAt).toLocaleString(
                      undefined,
                      {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      },
                    )
                  : "View next appointment"}
              </strong>
            </Link>
          ) : null}
          <Link
            href="/wardrobe"
            className="paon-overview-quick-card"
            data-pe-card
          >
            <span>Your wardrobe</span>
            <strong>Choose what to wear</strong>
          </Link>
        </div>
        <p className="paon-overview-digital-time" aria-live="off">
          <span>
            {now?.toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }) ?? "--:--"}
          </span>
          <span className="paon-overview-seconds">
            {now ? String(seconds).padStart(2, "0") : "--"}
          </span>
        </p>
      </div>

      <div className="paon-overview-analog" aria-hidden="true">
        {Array.from({ length: 12 }, (_, index) => (
          <span
            key={index}
            className="paon-overview-hour-mark"
            style={{ transform: `rotate(${index * 30}deg)` }}
          />
        ))}
        <span
          className="paon-overview-hand paon-overview-hour-hand"
          style={{ transform: `translateX(-50%) rotate(${hourRotation}deg)` }}
        />
        <span
          className="paon-overview-hand paon-overview-minute-hand"
          style={{ transform: `translateX(-50%) rotate(${minuteRotation}deg)` }}
        />
        <span
          className="paon-overview-hand paon-overview-second-hand"
          style={{ transform: `translateX(-50%) rotate(${secondRotation}deg)` }}
        />
        <span className="paon-overview-clock-pin" />
      </div>
    </section>
  );
}
