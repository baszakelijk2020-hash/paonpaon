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
    <Card className="overflow-hidden p-0" data-complete-the-look-card>
      <div className="flex items-end justify-between gap-6 border-b border-[var(--color-stone-200)] px-5 py-5 sm:px-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-stone-400)]">
            Edit your rotation
          </p>
          <h2 className="font-display mt-1 text-2xl text-[var(--color-stone-900)]">
            Complete the look
          </h2>
          <p className="mt-1 text-sm text-[var(--color-stone-500)]">
            Chosen to complement what you already own.
          </p>
        </div>
        <span className="hidden text-xs text-[var(--color-stone-500)] sm:block">
          {suggestions.length} considered
        </span>
      </div>
      <ul className="grid gap-px bg-[var(--color-stone-200)] sm:grid-cols-2 xl:grid-cols-3">
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
