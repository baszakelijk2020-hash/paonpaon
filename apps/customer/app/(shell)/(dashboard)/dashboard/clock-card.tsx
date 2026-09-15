"use client";

import { useEffect, useState } from "react";

import { HOME_LOCATION } from "../morning-routine/local-widgets";

import "./overview.css";

/** The first card across the top: the time and date at home — Breda — on
 * whatever clock the viewer's machine is on. The place itself is not printed;
 * the weather tile beside it already says where. One figure, one line under
 * it — nothing in this strip runs to three lines. */
export function ClockCard() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const interval = window.setInterval(update, 1_000);
    return () => window.clearInterval(interval);
  }, []);

  /*
   * Hour and minute are pulled out of ONE formatting of the time, not
   * formatted separately: asked for the minute on its own, Intl treats
   * "2-digit" as a hint it is free to ignore and returns "0" rather than
   * "00" — so the clock read 19:0 on the hour. Parts keep the locale's own
   * digits and its own padding.
   */
  const parts = now
    ? new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        timeZone: HOME_LOCATION.timeZone,
      }).formatToParts(now)
    : [];
  const hour = parts.find((part) => part.type === "hour")?.value ?? "--";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "--";
  /* Tabular figures give every digit the same advance, so a 1 — which is
     narrow — is centred inside it and leaves a gap on its left that no other
     digit does. At 17:00 the time visibly starts right of the label under it.
     The class pulls that bearing back, and only for an hour that opens on a
     one. */
  const opensOnOne = hour.startsWith("1");

  return (
    <article className="paon-stat paon-stat-clock" aria-label="Time">
      {/* No seconds counter: the colon carries the second instead, blinking
          the way a clock's does. Hours and minutes are formatted separately
          so the colon can be its own element — splitting the formatted
          string would break in a locale that does not use one. */}
      <p
        className={["paon-stat-value", opensOnOne ? "is-lead-one" : ""].join(
          " ",
        )}
        aria-live="off"
      >
        {hour}
        <span className="paon-clock-colon" aria-hidden="true">
          :
        </span>
        {minute}
      </p>
      {/* One line, not two: the weekday and the date together in the short
          forms — SAT · 12 SEP. The year is never in question on a dashboard
          read at a glance, and the long spelled-out date was the widest thing
          in the strip. */}
      <div className="paon-stat-meta">
        <span className="paon-stat-label">
          {now
            ? now
                .toLocaleDateString("en-GB", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  timeZone: HOME_LOCATION.timeZone,
                })
                /* "Sat 12 Sep" → "SAT · 12 SEP". */
                .replace(/^(\S+)\s/, "$1 · ")
                .toUpperCase()
            : "TODAY"}
        </span>
      </div>
    </article>
  );
}
