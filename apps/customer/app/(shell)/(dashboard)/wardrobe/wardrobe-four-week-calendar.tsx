import Image from "next/image";

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
  const imageByDay = new Map<number, string>();
  FILLED_DAY_INDEXES.forEach((dayIndex, imageIndex) => {
    const imageUrl = imageUrls[imageIndex];
    if (imageUrl) imageByDay.set(dayIndex, imageUrl);
  });

  return (
    <section
      className="paon-wardrobe-calendar"
      aria-labelledby="paon-wardrobe-calendar-title"
    >
      <h2 id="paon-wardrobe-calendar-title" className="sr-only">
        Your next four weeks
      </h2>
      <div className="paon-wardrobe-calendar-weekdays" aria-hidden="true">
        {DAY_NAMES.map((day) => (
          <span key={day}>{day.slice(0, 3)}</span>
        ))}
      </div>
      <div className="paon-wardrobe-calendar-grid">
        {days.map(({ date, dayNumber, label }, index) => {
          const imageUrl = imageByDay.get(index);
          const revealDelay = ((index * 17) % 61) / 10;

          return (
            <article
              key={date.toISOString()}
              className={`paon-wardrobe-calendar-day${imageUrl ? "has-look" : ""}`}
              aria-label={label}
            >
              <span className="paon-wardrobe-calendar-number">{dayNumber}</span>
              {imageUrl ? (
                <div
                  className="paon-wardrobe-calendar-look"
                  style={{ animationDelay: `${revealDelay}s` }}
                >
                  <Image
                    src={imageUrl}
                    alt=""
                    fill
                    unoptimized
                    sizes="(min-width: 1024px) 12vw, 25vw"
                    className="paon-wardrobe-calendar-backdrop"
                    aria-hidden="true"
                  />
                  <Image
                    src={imageUrl}
                    alt=""
                    fill
                    unoptimized
                    sizes="(min-width: 1024px) 12vw, 25vw"
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
