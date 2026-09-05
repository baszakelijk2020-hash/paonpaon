"use client";

import type { Outfit, WardrobeVisualizationJob } from "@paon/domain";
import { Button, buttonVariants } from "@paon/ui/components/Button";
import Image from "next/image";
import { useActionState, useEffect, useState, useTransition } from "react";

import {
  cancelAllQueuedLooks,
  cancelOutfitGeneration,
  composeCustomerOutfit,
  generateAllSavedLooks,
  generateOutfitLook,
  recordLookFeedback,
  type ComposeOutfitState,
} from "./virtual-studio-actions";

export interface ComposableItem {
  readonly key: string;
  readonly kind: "wardrobe" | "product";
  readonly id: string;
  readonly label: string;
  readonly imageUrl?: string;
  readonly suggestedSlotKind?:
    "jacket" | "trousers" | "shirt" | "shoes" | "accessories" | "pocket_square";
}

const initialComposeState: ComposeOutfitState = {};

/**
 * Image-led item picker — no per-item slot dropdown or checkbox row. Slot
 * kind is inferred automatically from the garment category
 * (`suggestedSlotKind`), matching the founder's "no prompt-playground
 * controls, no generic SaaS AI-dashboard chrome" bar (Precision Authority
 * §2/§30): the customer taps pieces, not form fields.
 */
function ComposeLookStudio({
  retailerId,
  items,
  canGenerate,
  preloadKey,
  onComposed,
}: {
  retailerId: string;
  items: readonly ComposableItem[];
  canGenerate: boolean;
  preloadKey?: string;
  onComposed: (outfitId: string) => void;
}) {
  const boundCompose = composeCustomerOutfit.bind(null, retailerId);
  const [state, formAction, isPending] = useActionState(
    boundCompose,
    initialComposeState,
  );
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(preloadKey ? [preloadKey] : []),
  );

  useEffect(() => {
    if (state.outfitId) {
      onComposed(state.outfitId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.outfitId]);

  function toggle(key: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-[var(--color-stone-400)]">
        Add items to your wardrobe or wishlist to create a look here.
      </p>
    );
  }

  const selectedItems = items.filter((item) => selected.has(item.key));

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <p className="mb-2 text-xs uppercase tracking-[0.08em] text-[var(--color-stone-400)]">
          Your look{" "}
          {selectedItems.length > 0 ? `(${selectedItems.length})` : ""}
        </p>
        {selectedItems.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {selectedItems.map((item) => (
              <span
                key={item.key}
                className="rounded-full bg-white/[0.08] px-3 py-1 text-xs text-white"
              >
                {item.label}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[var(--color-stone-500)]">
            Tap pieces below to start.
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {items.map((item) => {
          const isSelected = selected.has(item.key);
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => toggle(item.key)}
              aria-pressed={isSelected}
              className={`relative aspect-[4/5] overflow-hidden rounded-[12px] ${
                isSelected ? "ring-2 ring-white" : ""
              }`}
            >
              {item.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt={item.label}
                  fill
                  unoptimized
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--color-stone-800)] to-[var(--color-stone-950)] p-2 text-center text-xs text-[var(--color-stone-400)]">
                  {item.label}
                </div>
              )}
              {isSelected ? (
                <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs text-[var(--color-stone-900)]">
                  ✓
                </span>
              ) : null}
              <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1.5 py-1 text-[11px] text-white">
                {item.label}
              </span>
            </button>
          );
        })}
        {selectedItems.map((item) => (
          <input
            key={item.key}
            type="hidden"
            name="slotItem"
            value={`${item.suggestedSlotKind ?? "jacket"}::${item.kind}::${item.id}`}
          />
        ))}
      </div>

      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
      {!canGenerate ? (
        <p className="text-xs text-[var(--color-stone-500)]">
          Approve your Style Portrait above to generate this look — you can
          still save the composition now.
        </p>
      ) : null}

      <Button
        type="submit"
        size="sm"
        disabled={isPending || selectedItems.length === 0}
        className="self-start"
      >
        {isPending ? "Saving…" : "Create look"}
      </Button>
    </form>
  );
}

const JOB_STATUS_COPY: Record<WardrobeVisualizationJob["status"], string> = {
  queued: "Queued",
  generating: "Generating…",
  ready: "Ready",
  failed: "Generation failed",
  cancelled: "Cancelled",
};

function OutfitCanvas({
  retailerId,
  outfit,
  latestJob,
  canGenerate,
}: {
  retailerId: string;
  outfit: Outfit;
  latestJob: WardrobeVisualizationJob | null;
  canGenerate: boolean;
}) {
  const [instructions, setInstructions] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function generate() {
    setError(null);
    startTransition(async () => {
      const result = await generateOutfitLook(
        retailerId,
        outfit.id,
        instructions,
      );
      if (result.error) setError(result.error);
    });
  }

  function feedback(signal: Parameters<typeof recordLookFeedback>[2]) {
    if (!latestJob) return;
    startTransition(() => recordLookFeedback(retailerId, latestJob.id, signal));
  }

  function cancel() {
    if (!latestJob) return;
    startTransition(() => cancelOutfitGeneration(retailerId, latestJob.id));
  }

  const isActive =
    latestJob?.status === "queued" || latestJob?.status === "generating";

  return (
    <div className="flex flex-col gap-3 rounded-[15px] bg-gradient-to-br from-[var(--color-stone-900)] to-[var(--color-stone-950)] p-4">
      <p className="font-display text-lg text-white">{outfit.title}</p>

      <div className="flex aspect-[4/5] w-full items-center justify-center overflow-hidden rounded-[12px] bg-black/30">
        {latestJob?.status === "ready" && latestJob.outputImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={latestJob.outputImageUrl}
            alt={outfit.title}
            className="h-full w-full object-contain"
          />
        ) : (
          <p
            className="px-6 text-center text-sm text-[var(--color-stone-400)]"
            role="status"
          >
            {latestJob
              ? JOB_STATUS_COPY[latestJob.status]
              : "Not generated yet."}
            {latestJob?.status === "failed" && latestJob.errorMessage
              ? ` — ${latestJob.errorMessage}`
              : ""}
          </p>
        )}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {error}
        </p>
      ) : null}

      {!isActive ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            placeholder="Optional styling direction…"
            maxLength={1000}
            className="w-full rounded-[10px] bg-white/[0.06] px-3 py-2 text-sm text-white placeholder:text-[var(--color-stone-500)]"
            rows={2}
          />
          <Button
            size="sm"
            onClick={generate}
            disabled={isPending || !canGenerate}
          >
            {latestJob?.status === "ready"
              ? "Regenerate"
              : "Generate this look"}
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={cancel}
          disabled={isPending || latestJob?.status !== "queued"}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Cancel
        </button>
      )}

      {latestJob?.status === "ready" ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => feedback("love_it")}
            className="rounded-[10px] bg-white/[0.1] px-3 py-1.5 text-xs text-white"
          >
            Love it
          </button>
          <button
            type="button"
            onClick={() => feedback("save")}
            className="rounded-[10px] bg-white/[0.1] px-3 py-1.5 text-xs text-white"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => feedback("not_for_me")}
            className="rounded-[10px] bg-white/[0.06] px-3 py-1.5 text-xs text-[var(--color-stone-300)]"
          >
            Not for me
          </button>
        </div>
      ) : null}
    </div>
  );
}

function BatchLookActions({
  retailerId,
  hasOutfits,
}: {
  retailerId: string;
  hasOutfits: boolean;
}) {
  const [generateResult, setGenerateResult] = useState<{
    enqueued: number;
    errors: readonly string[];
  } | null>(null);
  const [cancelResult, setCancelResult] = useState<{
    cancelled: number;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  function generateAll() {
    setGenerateResult(null);
    setCancelResult(null);
    startTransition(async () => {
      const result = await generateAllSavedLooks(retailerId);
      setGenerateResult(result);
    });
  }

  function cancelAll() {
    setGenerateResult(null);
    setCancelResult(null);
    startTransition(async () => {
      const result = await cancelAllQueuedLooks(retailerId);
      setCancelResult(result);
    });
  }

  if (!hasOutfits) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={generateAll} disabled={isPending}>
          {isPending ? "Enqueuing…" : "Create all saved looks"}
        </Button>
        <button
          type="button"
          onClick={cancelAll}
          disabled={isPending}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Cancel all queued
        </button>
      </div>
      {generateResult ? (
        <p className="text-xs text-[var(--color-stone-400)]" role="status">
          {generateResult.enqueued} look
          {generateResult.enqueued === 1 ? "" : "s"} enqueued.
          {generateResult.errors.length > 0
            ? ` ${generateResult.errors.length} skipped: ${generateResult.errors.join("; ")}`
            : ""}
        </p>
      ) : null}
      {cancelResult ? (
        <p className="text-xs text-[var(--color-stone-400)]" role="status">
          {cancelResult.cancelled} queued look
          {cancelResult.cancelled === 1 ? "" : "s"} cancelled.
        </p>
      ) : null}
    </div>
  );
}

/**
 * Digital Fitting Room's studio surface (contract §8): create a look from
 * real owned/wishlist/advisor-linked pieces on the left/grid, watch it
 * generate in a large canvas, and browse saved drafts/results below — no
 * garment-option configurator (lapel/vent/button pickers etc. stay a
 * retailer/catalogue-authoring concern per
 * docs/PAON_VISUAL_WARDROBE_PRECISION_AUTHORITY.md §0, not a customer
 * control here).
 */
export function FittingRoomStudio({
  retailerId,
  composableItems,
  outfits,
  latestJobByOutfitId,
  canGenerate,
  preloadKey,
}: {
  retailerId: string;
  composableItems: readonly ComposableItem[];
  outfits: readonly Outfit[];
  latestJobByOutfitId: Readonly<Record<string, WardrobeVisualizationJob>>;
  canGenerate: boolean;
  preloadKey?: string;
}) {
  const [activeOutfitId, setActiveOutfitId] = useState<string | null>(
    outfits[0]?.id ?? null,
  );
  const activeOutfit = outfits.find((outfit) => outfit.id === activeOutfitId);

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="flex-1">
        {activeOutfit ? (
          <OutfitCanvas
            retailerId={retailerId}
            outfit={activeOutfit}
            latestJob={latestJobByOutfitId[activeOutfit.id] ?? null}
            canGenerate={canGenerate}
          />
        ) : (
          <div className="flex aspect-[4/5] w-full items-center justify-center rounded-[15px] bg-gradient-to-br from-[var(--color-stone-900)] to-[var(--color-stone-950)] p-6 text-center">
            <p className="text-sm text-[var(--color-stone-400)]">
              Create a look on the right to see it here.
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-6">
        <ComposeLookStudio
          retailerId={retailerId}
          items={composableItems}
          canGenerate={canGenerate}
          {...(preloadKey ? { preloadKey } : {})}
          onComposed={setActiveOutfitId}
        />

        {outfits.length > 0 ? (
          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.08em] text-[var(--color-stone-400)]">
              Saved drafts &amp; results
            </p>
            <div className="flex flex-wrap gap-2">
              {outfits.map((outfit) => (
                <button
                  key={outfit.id}
                  type="button"
                  onClick={() => setActiveOutfitId(outfit.id)}
                  className={`rounded-full px-3 py-1.5 text-xs ${
                    outfit.id === activeOutfitId
                      ? "bg-white text-[var(--color-stone-900)]"
                      : "bg-white/[0.08] text-white"
                  }`}
                >
                  {outfit.title}
                  {latestJobByOutfitId[outfit.id]
                    ? ` · ${JOB_STATUS_COPY[latestJobByOutfitId[outfit.id]!.status]}`
                    : ""}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <BatchLookActions
          retailerId={retailerId}
          hasOutfits={outfits.length > 0}
        />
      </div>
    </div>
  );
}
