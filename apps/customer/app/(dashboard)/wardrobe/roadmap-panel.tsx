"use client";

import type { Outfit, WardrobeRoadmap } from "@paon/domain";
import { Card } from "@paon/ui/components/Card";

export function CustomerApprovedRoadmapPanel({
  retailerName,
  roadmap,
  outfits,
}: {
  retailerName: string;
  roadmap: WardrobeRoadmap | null;
  outfits: readonly Outfit[];
}) {
  if (!roadmap) {
    return (
      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          Wardrobe Roadmap — {retailerName}
        </h2>
        <p className="text-sm text-[var(--color-stone-500)]">
          Your advisor has not shared an approved wardrobe plan yet.
        </p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          Wardrobe Roadmap — {retailerName}
        </h2>
        <p className="text-sm text-[var(--color-stone-500)]">
          Approved plan showing how future pieces fill ranked gaps in your
          wardrobe.
        </p>
      </div>

      <div>
        <p className="font-medium text-[var(--color-stone-900)]">
          {roadmap.title}
        </p>
        {roadmap.horizonLabel ? (
          <p className="text-sm text-[var(--color-stone-500)]">
            Horizon: {roadmap.horizonLabel}
          </p>
        ) : null}
        {roadmap.summary ? (
          <p className="mt-2 text-sm text-[var(--color-stone-700)]">
            {roadmap.summary}
          </p>
        ) : null}
      </div>

      {roadmap.goals.length > 0 ? (
        <div>
          <h3 className="text-sm font-medium">Goals</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
            {roadmap.goals.map((goal) => (
              <li key={goal.id}>{goal.title}</li>
            ))}
          </ol>
        </div>
      ) : null}

      {roadmap.gaps.length > 0 ? (
        <div>
          <h3 className="text-sm font-medium">Ranked gaps</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {roadmap.gaps.map((gap) => (
              <li
                key={gap.id}
                className="rounded border border-[var(--color-stone-100)] px-3 py-2"
              >
                <span className="font-medium">{gap.title}</span>
                <span className="text-[var(--color-stone-500)]">
                  {" "}
                  · priority {gap.rank} · stage {gap.stagePriority}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {outfits.length > 0 ? (
        <div>
          <h3 className="text-sm font-medium">Complete looks</h3>
          <ul className="mt-2 space-y-3 text-sm">
            {outfits.map((outfit) => (
              <li
                key={outfit.id}
                className="rounded border border-[var(--color-stone-100)] px-3 py-2"
              >
                <p className="font-medium">{outfit.title}</p>
                <ul className="mt-2 space-y-1 text-[var(--color-stone-600)]">
                  {outfit.slots.map((slot) => (
                    <li key={slot.id}>
                      {slot.slotKind.replace("_", " ")}: {slot.displayLabel}
                    </li>
                  ))}
                </ul>
                {outfit.ruleCitations.map((citation) => (
                  <p
                    key={citation.id}
                    className="mt-2 text-xs text-[var(--color-stone-500)]"
                  >
                    {citation.explanation}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
