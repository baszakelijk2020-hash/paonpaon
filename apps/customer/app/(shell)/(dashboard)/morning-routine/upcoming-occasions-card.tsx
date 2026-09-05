import { Card } from "@paon/ui/components/Card";

/**
 * MorningRoutine's "Coming up" card (PHASE 17.10 / ADV-110, vision spec
 * §14) — a separate card from today's OOTD, not a replacement of it,
 * surfaced from Self-Portrait's existing dated facts far enough ahead to
 * act on. Never rendered when there's nothing upcoming — no fabricated
 * empty state.
 */
export function UpcomingOccasionsCard({
  occasions,
}: {
  occasions: readonly {
    factId: string;
    label: string;
    note?: string;
    nextOccurrenceIso: string;
    daysUntil: number;
  }[];
}) {
  if (occasions.length === 0) return null;

  return (
    <Card className="flex flex-col gap-3" data-upcoming-occasions-card>
      <div>
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          Coming up
        </h2>
        <p className="text-sm text-[var(--color-stone-500)]">
          Enough notice to book an appointment or order in time for alterations.
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {occasions.map((occasion) => (
          <li
            key={occasion.factId}
            className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2"
          >
            <p className="text-sm font-medium text-[var(--color-stone-900)]">
              {occasion.label}
              {occasion.note ? ` — ${occasion.note}` : ""}
            </p>
            <p className="text-xs text-[var(--color-stone-500)]">
              {new Date(occasion.nextOccurrenceIso).toLocaleDateString(
                "en-US",
                { month: "long", day: "numeric" },
              )}{" "}
              ·{" "}
              {occasion.daysUntil === 0
                ? "today"
                : `${occasion.daysUntil} days away`}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
