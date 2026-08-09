"use client";

import { Button } from "@paon/ui/components/Button";
import Image from "next/image";
import { useActionState } from "react";

import {
  generateSuggestedLookTryOn,
  type SuggestedLookGenerateState,
} from "./virtual-studio-actions";

const initial: SuggestedLookGenerateState = {};

export interface SuggestedLookSuggestionView {
  readonly categoryCode: string;
  readonly productId: string;
  readonly displayName: string;
  readonly productSlug: string;
  readonly primaryImageUrl?: string;
  readonly explanation: string;
}

/**
 * One "see it on me" tap-to-generate tile for a suggested (not-yet-owned)
 * product — shared by MorningRoutine's wardrobe-level Complete the Look
 * card (PHASE 17.10) and the QR wardrobe card's item-specific one
 * (PHASE 17.13), so the tile markup and the pending/error/success states
 * exist in exactly one place.
 */
export function SuggestedLookTile({
  retailerId,
  suggestion,
}: {
  retailerId: string;
  suggestion: SuggestedLookSuggestionView;
}) {
  const boundGenerate = generateSuggestedLookTryOn.bind(null, retailerId);
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
