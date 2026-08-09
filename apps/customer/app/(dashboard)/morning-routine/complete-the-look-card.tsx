"use client";

import { Card } from "@paon/ui/components/Card";

import {
  SuggestedLookTile,
  type SuggestedLookSuggestionView,
} from "@/app/(dashboard)/wardrobe/suggested-look-tile";

export type CompleteTheLookSuggestionView = SuggestedLookSuggestionView;

/**
 * MorningRoutine's "Complete the look" card (PHASE 17.10 / ADV-110, vision
 * spec §14 item 3) — the completion half of the three-card expansion.
 * Gap-driven suggestions (`selectCompleteTheLookSuggestions`), each with
 * its own tap-to-generate "see it on me" entry point via the shared
 * `SuggestedLookTile` — never an automatic render. Never rendered when
 * there's nothing to suggest — no fabricated empty state.
 */
export function CompleteTheLookCard({
  retailerId,
  suggestions,
}: {
  retailerId: string;
  suggestions: readonly CompleteTheLookSuggestionView[];
}) {
  if (suggestions.length === 0) return null;

  return (
    <Card className="flex flex-col gap-3" data-complete-the-look-card>
      <div>
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          Complete the look
        </h2>
        <p className="text-sm text-[var(--color-stone-500)]">
          Wardrobe-planning suggestions that complement what you already own.
        </p>
      </div>
      <ul className="flex snap-x gap-3 overflow-x-auto pb-1">
        {suggestions.map((suggestion) => (
          <SuggestedLookTile
            key={suggestion.productId}
            retailerId={retailerId}
            suggestion={suggestion}
          />
        ))}
      </ul>
    </Card>
  );
}
