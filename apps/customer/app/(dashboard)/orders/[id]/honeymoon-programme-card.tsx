import type { HoneymoonProgrammeRecord } from "@paon/database";
import { Card } from "@paon/ui/components/Card";

const KIND_LABELS: Record<string, string> = {
  preparation: "Preparation",
  collection: "Collection",
  aftercare: "Aftercare",
};

/**
 * Order-to-delivery tracker (PHASE 10.2 / CMP-106). Every action already
 * carries honest suppression — this renders exactly what
 * deriveHoneymoonActions decided, it never re-derives or overrides urgency.
 */
export function HoneymoonProgrammeCard({
  programme,
}: {
  readonly programme: HoneymoonProgrammeRecord;
}) {
  return (
    <Card>
      <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
        Preparation & aftercare
      </h2>
      <ul className="mt-3 flex flex-col gap-3 text-sm">
        {programme.actions.map((action) => (
          <li
            key={action.kind}
            className="border-b border-[var(--color-stone-100)] pb-3 last:border-0"
          >
            <p className="font-medium text-[var(--color-stone-900)]">
              {KIND_LABELS[action.kind] ?? action.kind} — {action.title}
            </p>
            <p className="mt-1 text-[var(--color-stone-600)]">
              {action.dueHint}
            </p>
            {action.suppressed ? (
              <p className="mt-1 text-xs text-[var(--color-stone-400)]">
                Not yet actionable
                {action.suppressionReason
                  ? ` — ${action.suppressionReason}`
                  : ""}
                .
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
