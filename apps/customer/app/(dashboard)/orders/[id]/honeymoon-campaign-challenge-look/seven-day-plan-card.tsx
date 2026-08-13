import type { SevenDaySlotPlan, SevenDaySource } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Card } from "@paon/ui/components/Card";

const SLOT_KIND_LABELS: Record<string, string> = {
  jacket: "Jacket",
  trousers: "Trousers",
  shirt: "Shirt",
  shoes: "Shoes",
  accessories: "Accessories",
};

const SOURCE_LABELS: Record<SevenDaySource, string> = {
  owned: "Owned",
  suggested: "Catalogue",
  gap: "Gap",
};

const SOURCE_TONE: Record<SevenDaySource, "success" | "neutral" | "warning"> = {
  owned: "success",
  suggested: "neutral",
  gap: "warning",
};

/**
 * Renders exactly what `composeSevenDayOwnedFirstPlan` decided per
 * day/slot — never re-derives owned/catalogue/gap itself, matching
 * `HoneymoonProgrammeCard`'s "render the decision, don't remake it"
 * precedent for this same PHASE 10.2 surface.
 */
export function SevenDayPlanCard({
  slots,
}: {
  readonly slots: readonly SevenDaySlotPlan[];
}) {
  const days = new Map<number, SevenDaySlotPlan[]>();
  for (const slot of slots) {
    const list = days.get(slot.dayIndex) ?? [];
    list.push(slot);
    days.set(slot.dayIndex, list);
  }
  const dayIndices = [...days.keys()].sort((a, b) => a - b);

  return (
    <div className="flex flex-col gap-4">
      {dayIndices.map((dayIndex, cardIndex) => (
        <Card
          key={dayIndex}
          className="paon-reveal"
          style={{ animationDelay: `${cardIndex * 30}ms` }}
        >
          <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
            Day {dayIndex}
          </h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {(days.get(dayIndex) ?? []).map((slot) => (
              <li
                key={`${slot.dayIndex}-${slot.slotKind}`}
                className="flex items-center justify-between gap-3 border-b border-[var(--color-stone-100)] pb-2 last:border-0"
              >
                <div>
                  <p className="font-medium text-[var(--color-stone-900)]">
                    {SLOT_KIND_LABELS[slot.slotKind] ?? slot.slotKind}
                  </p>
                  <p className="mt-0.5 text-[var(--color-stone-600)]">
                    {slot.citation ?? SOURCE_LABELS[slot.source]}
                  </p>
                </div>
                <Badge tone={SOURCE_TONE[slot.source]} className="shrink-0">
                  {SOURCE_LABELS[slot.source]}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
