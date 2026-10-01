const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;
const FILLED_DAY_INDEXES = [
  4, 5, 8, 12, 13, 14, 16, 20, 21, 22, 24, 25, 27,
] as const;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

function mondayAtUtc(dateIso: string): Date {
  const now = new Date(dateIso);
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const daysSinceMonday = (today.getUTCDay() + 6) % 7;
  return new Date(today.getTime() - daysSinceMonday * DAY_IN_MS);
}

export function WardrobeFourWeekCalendar({
  nowIso,
  imageUrls,
}: {
  readonly nowIso: string;
  readonly imageUrls: readonly string[];
}) {
  const firstDay = mondayAtUtc(nowIso);
  const days = Array.from({ length: 28 }, (_, index) => {
    const date = new Date(firstDay.getTime() + index * DAY_IN_MS);
    return {
      date,
      dayNumber: date.getUTCDate(),
      label: new Intl.DateTimeFormat("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(date),
    };
  });
  const todayIndex = Math.floor(
    (Date.parse(nowIso) - firstDay.getTime()) / DAY_IN_MS,
  );
  const imageByDay = new Map<number, string>();
  FILLED_DAY_INDEXES.forEach((dayIndex, imageIndex) => {
    const imageUrl = imageUrls[imageIndex];
    if (imageUrl) imageByDay.set(dayIndex, imageUrl);
  });

  return (
    <section
      id="calendar"
      className="paon-wardrobe-card paon-wardrobe-calendar"
      aria-labelledby="paon-wardrobe-calendar-title"
    >
      <svg className="paon-wardrobe-cutout-filter" aria-hidden="true">
        <filter id="paon-calendar-cutout" colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 -20 -20 -20 0 55"
          />
        </filter>
      </svg>
      <div className="paon-wardrobe-card-head">
        <h2
          id="paon-wardrobe-calendar-title"
          className="paon-wardrobe-card-title"
        >
          Your next four weeks
        </h2>
        <span className="paon-wardrobe-card-meta">
          {new Intl.DateTimeFormat("en-GB", {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          }).format(firstDay)}
        </span>
      </div>
      <div className="paon-wardrobe-calendar-weekdays" aria-hidden="true">
        {[...DAY_NAMES, ...DAY_NAMES].map((day, index) => (
          <span
            key={`${day}-${index}`}
            className={index >= 7 ? "is-second-week" : undefined}
          >
            {day.slice(0, 3)}
          </span>
        ))}
      </div>
      <div className="paon-wardrobe-calendar-grid">
        {days.map(({ date, dayNumber, label }, index) => {
          const imageUrl = imageByDay.get(index);
          // Nearby pieces begin almost together, then settle row by row like
          // a light rainfall rather than waiting for a serial slideshow.
          const revealDelay =
            0.12 + (index % 7) * 0.11 + Math.floor(index / 7) * 0.07;

          return (
            <article
              key={date.toISOString()}
              className={[
                "paon-wardrobe-calendar-day",
                imageUrl ? "has-look" : "",
                index === todayIndex ? "is-today" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-label={label}
            >
              <span className="paon-wardrobe-calendar-number">{dayNumber}</span>
              {imageUrl ? (
                <div
                  className="paon-wardrobe-calendar-look"
                  style={{ animationDelay: `${revealDelay}s` }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt=""
                    width={1069}
                    height={2057}
                    className="paon-wardrobe-calendar-garment"
                  />
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
