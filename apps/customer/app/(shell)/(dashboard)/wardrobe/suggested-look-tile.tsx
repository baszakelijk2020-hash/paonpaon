"use client";

import { Button } from "@paon/ui/components/Button";
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
  compact = false,
}: {
  retailerId: string;
  suggestion: SuggestedLookSuggestionView;
  /** Wardrobe rails: a narrow, natural-ratio tile with a slim caption. */
  compact?: boolean;
}) {
  const boundGenerate = generateSuggestedLookTryOn.bind(null, retailerId);
  const [state, formAction, isPending] = useActionState(boundGenerate, initial);

  if (compact) {
    return (
      <li className="paon-wardrobe-tile" data-pe-card>
        {suggestion.primaryImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={suggestion.primaryImageUrl} alt="" />
        ) : (
          <div className="paon-wardrobe-tile-empty" aria-hidden>
            No image
          </div>
        )}
        <div className="paon-wardrobe-tile-body">
          <p className="paon-wardrobe-tile-name">{suggestion.displayName}</p>
          <p className="paon-wardrobe-tile-note" title={suggestion.explanation}>
            {suggestion.explanation}
          </p>
          <form action={formAction}>
            <input
              type="hidden"
              name="productId"
              value={suggestion.productId}
            />
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
            <button
              type="submit"
              className="paon-wardrobe-pill"
              disabled={isPending}
            >
              {isPending ? "Generating…" : "See it on me"}
            </button>
          </form>
          {state.error ? (
            <p role="alert" className="paon-wardrobe-error">
              {state.error}
            </p>
          ) : null}
          {!isPending && !state.error && state !== initial ? (
            <p role="status" className="paon-wardrobe-tile-note">
              Generating your look.
            </p>
          ) : null}
        </div>
      </li>
    );
  }

  return (
    <li
      className="group min-w-0 snap-start overflow-hidden rounded-[32px] bg-[#191b1d] text-white"
      data-pe-card
    >
      <div className="w-full">
        {suggestion.primaryImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={suggestion.primaryImageUrl}
            alt=""
            className="block h-auto w-full"
          />
        ) : (
          <div
            className="flex h-40 w-full items-center justify-center bg-[#25282a] text-xs text-white/45"
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
