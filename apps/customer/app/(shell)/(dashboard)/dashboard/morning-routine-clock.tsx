"use client";

import { useEffect, useState } from "react";

/**
 * pag1.html's own MorningRoutine widget ticks a live clock every second
 * (`setInterval(updateDateTime, 1000)`) rather than a static server-rendered
 * timestamp. Isolated to its own client component so the rest of the hero
 * stays a Server Component. Renders nothing until mounted to avoid a
 * server/client time mismatch.
 */
export function MorningRoutineClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) return null;

  const date = now.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const time = now.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <span>
      {date} · {time}
    </span>
  );
}
