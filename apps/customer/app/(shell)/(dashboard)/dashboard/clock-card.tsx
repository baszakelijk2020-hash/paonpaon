"use client";

import { useEffect, useState } from "react";

import { HOME_LOCATION } from "../morning-routine/local-widgets";

import "./overview.css";

/** The first card across the top: the time and date at home — Breda — on
 * whatever clock the viewer's machine is on. The place itself is not printed;
 * the weather tile beside it already says where. */
export function ClockCard() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const interval = window.setInterval(update, 1_000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <article className="paon-stat paon-stat-clock" aria-label="Time">
      <p className="paon-stat-value" aria-live="off">
        {now?.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: HOME_LOCATION.timeZone,
        }) ?? "--:--"}
        <small>
          {now?.toLocaleTimeString("en-GB", {
            second: "2-digit",
            timeZone: HOME_LOCATION.timeZone,
          }) ?? "--"}
        </small>
      </p>
      <div className="paon-stat-meta">
        <span className="paon-stat-label">
          {now?.toLocaleDateString("en-GB", {
            weekday: "long",
            timeZone: HOME_LOCATION.timeZone,
          }) ?? "Today"}
        </span>
        <span className="paon-stat-detail">
          {now?.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
            timeZone: HOME_LOCATION.timeZone,
          }) ?? ""}
        </span>
      </div>
    </article>
  );
}
