"use client";

import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import Image from "next/image";
import { useActionState } from "react";

import {
  generateCompleteTheLookTryOn,
  type CompleteTheLookGenerateState,
} from "./complete-the-look-actions";

const initial: CompleteTheLookGenerateState = {};

export interface CompleteTheLookSuggestionView {
  readonly categoryCode: string;
  readonly productId: string;
  readonly displayName: string;
  readonly productSlug: string;
  readonly primaryImageUrl?: string;
  readonly explanation: string;
}

function SuggestionTile({
  retailerId,
  suggestion,
}: {
  retailerId: string;
  suggestion: CompleteTheLookSuggestionView;
}) {
  const boundGenerate = generateCompleteTheLookTryOn.bind(null, retailerId);
  const [state, formAction, isPending] = useActionState(boundGenerate, initial);

  return (
    <li className="w-48 flex-none snap-start overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-stone-200)]">
      <div className="relative aspect-square w-full bg-[var(--color-stone-100)]">
        {suggestion.primaryImageUrl ? (
          <Image
            src={suggestion.primaryImageUrl}
            alt=""
            fill
            unoptimized
            className="object-cover"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-xs text-[var(--color-stone-400)]"
            aria-hidden
          >
            No image
          </div>
        )}
      </div>
      <div className="px-3 py-2">
        <p className="text-sm font-medium text-[var(--color-stone-900)]">
          {suggestion.displayName}
        </p>
        <p className="text-xs text-[var(--color-stone-500)]">
          {suggestion.explanation}
        </p>
        <form action={formAction} className="mt-2">
          <input type="hidden" name="productId" value={suggestion.productId} />
          <input
            type="hidden"
            name="categoryCode"
            value={suggestion.categoryCode}
          />
          <input
            type="hidden"
            name="displayName"
            value={suggestion.displayName}
          />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={isPending}
          >
            {isPending ? "Generating…" : "See it on me"}
          </Button>
        </form>
        {state.error ? (
          <p
            role="alert"
            className="mt-1 text-xs text-[var(--color-danger-500)]"
          >
            {state.error}
          </p>
        ) : null}
        {!isPending && !state.error && state !== initial ? (
          <p
            role="status"
            className="mt-1 text-xs text-[var(--color-stone-500)]"
          >
            Generating your look — check your wardrobe shortly.
          </p>
        ) : null}
      </div>
    </li>
  );
}

/**
 * MorningRoutine's "Complete the look" card (PHASE 17.10 / ADV-110, vision
 * spec §14 item 3) — the completion half of the three-card expansion.
 * Gap-driven suggestions (`selectCompleteTheLookSuggestions`), each with
 * its own tap-to-generate "see it on me" entry point — never an automatic
 * render. Never rendered when there's nothing to suggest — no fabricated
 * empty state.
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
          <SuggestionTile
            key={suggestion.productId}
            retailerId={retailerId}
            suggestion={suggestion}
          />
        ))}
      </ul>
    </Card>
  );
}
