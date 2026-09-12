"use client";

import { Button } from "@paon/ui/components/Button";
import Image from "next/image";
import { useActionState } from "react";

import {
  generateSuggestedLookTryOn,
  type SuggestedLookGenerateState,
} from "../digital-fitting-room/virtual-studio-actions";

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
    <li
      className="group min-w-0 snap-start overflow-hidden rounded-[32px] bg-[#191b1d] text-white"
      data-pe-card
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-b-[24px] bg-[#25282a]">
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
            className="flex h-full w-full items-center justify-center text-xs text-white/45"
            aria-hidden
          >
            No image
          </div>
        )}
      </div>
      <div className="min-h-42 flex flex-col px-4 py-4">
        <p className="text-sm text-white/50">
          {suggestion.categoryCode.replaceAll("_", " ")}
        </p>
        <p className="mt-1 line-clamp-2 text-base font-semibold leading-5 text-white">
          {suggestion.displayName}
        </p>
        <p className="mt-2 line-clamp-2 text-sm leading-5 text-white/60">
          {suggestion.explanation}
        </p>
        <form action={formAction} className="mt-auto pt-4">
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
            className="min-h-[52px] w-full rounded-full border-0 bg-[#aed6e7] text-[#181818] hover:bg-[#c6e5f1]"
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
          <p role="status" className="mt-2 text-xs text-white/55">
            Generating your look — check your wardrobe shortly.
          </p>
        ) : null}
      </div>
    </li>
  );
}
