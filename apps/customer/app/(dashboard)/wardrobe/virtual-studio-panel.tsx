"use client";

import type { Outfit, WardrobeVisualizationJob } from "@paon/domain";
import { Button, buttonVariants } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { useActionState, useState, useTransition } from "react";

import {
  cancelOutfitGeneration,
  composeCustomerOutfit,
  generateOutfitLook,
  recordLookFeedback,
  type ComposeOutfitState,
} from "./virtual-studio-actions";

const SLOT_KINDS = [
  "jacket",
  "trousers",
  "shirt",
  "shoes",
  "accessories",
  "pocket_square",
] as const;

export interface ComposableItem {
  readonly key: string;
  readonly kind: "wardrobe" | "product";
  readonly id: string;
  readonly label: string;
  readonly imageUrl?: string;
  readonly suggestedSlotKind?: (typeof SLOT_KINDS)[number];
}

const initialComposeState: ComposeOutfitState = {};

function ComposeLookForm({
  retailerId,
  items,
  canGenerate,
}: {
  retailerId: string;
  items: readonly ComposableItem[];
  canGenerate: boolean;
}) {
  const boundCompose = composeCustomerOutfit.bind(null, retailerId);
  const [state, formAction, isPending] = useActionState(
    boundCompose,
    initialComposeState,
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [slotByKey, setSlotByKey] = useState<Record<string, string>>({});

  function toggle(item: ComposableItem) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(item.key)) {
        next.delete(item.key);
      } else {
        next.add(item.key);
        setSlotByKey((slots) => ({
          ...slots,
          [item.key]: slots[item.key] ?? item.suggestedSlotKind ?? "jacket",
        }));
      }
      return next;
    });
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-[var(--color-stone-500)]">
        Add items to your wardrobe or wishlist to compose a look.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="text-sm text-[var(--color-stone-700)]">
        Look title
        <input
          name="title"
          type="text"
          maxLength={200}
          placeholder="Friday client dinner"
          className="mt-1 block w-full rounded-[var(--radius-sm)] border border-[var(--color-stone-300)] px-3 py-2 text-sm"
        />
      </label>

      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.key}
            className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-stone-200)] p-2"
          >
            <input
              type="checkbox"
              checked={selected.has(item.key)}
              onChange={() => toggle(item)}
              aria-label={`Include ${item.label}`}
            />
            {item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.imageUrl}
                alt=""
                className="h-10 w-10 rounded object-cover"
              />
            ) : null}
            <span className="flex-1 text-sm text-[var(--color-stone-800)]">
              {item.label}
            </span>
            {selected.has(item.key) ? (
              <select
                value={
                  slotByKey[item.key] ?? item.suggestedSlotKind ?? "jacket"
                }
                onChange={(event) =>
                  setSlotByKey((slots) => ({
                    ...slots,
                    [item.key]: event.target.value,
                  }))
                }
                className="rounded-[var(--radius-sm)] border border-[var(--color-stone-300)] px-2 py-1 text-xs"
                aria-label={`Slot for ${item.label}`}
              >
                {SLOT_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind.replace("_", " ")}
                  </option>
                ))}
              </select>
            ) : null}
            {selected.has(item.key) ? (
              <input
                type="hidden"
                name="slotItem"
                value={`${slotByKey[item.key] ?? item.suggestedSlotKind ?? "jacket"}::${item.kind}::${item.id}`}
              />
            ) : null}
          </div>
        ))}
      </div>

      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
      {!canGenerate ? (
        <p className="text-xs text-[var(--color-stone-500)]">
          Approve a Style Portrait in Settings to generate looks — you can still
          save a look composition now.
        </p>
      ) : null}

      <Button
        type="submit"
        size="sm"
        disabled={isPending || selected.size === 0}
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

function OutfitCard({
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
    <li className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] p-3">
      <p className="text-sm font-medium text-[var(--color-stone-900)]">
        {outfit.title}
      </p>

      {latestJob?.status === "ready" && latestJob.outputImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={latestJob.outputImageUrl}
          alt={outfit.title}
          className="max-h-80 rounded-[var(--radius-md)] border border-[var(--color-stone-200)]"
        />
      ) : null}

      {latestJob ? (
        <p className="text-xs text-[var(--color-stone-500)]" role="status">
          {JOB_STATUS_COPY[latestJob.status]}
          {latestJob.status === "failed" && latestJob.errorMessage
            ? ` — ${latestJob.errorMessage}`
            : ""}
        </p>
      ) : null}

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
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-stone-300)] px-2 py-1 text-sm"
            rows={2}
          />
          <Button
            size="sm"
            onClick={generate}
            disabled={isPending || !canGenerate}
          >
            {latestJob?.status === "ready" ? "Regenerate" : "Create look"}
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
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            Love it
          </button>
          <button
            type="button"
            onClick={() => feedback("save")}
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => feedback("not_for_me")}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Not for me
          </button>
        </div>
      ) : null}
    </li>
  );
}

export function VirtualStudioPanel({
  retailerId,
  retailerName,
  composableItems,
  outfits,
  latestJobByOutfitId,
  canGenerate,
}: {
  retailerId: string;
  retailerName: string;
  composableItems: readonly ComposableItem[];
  outfits: readonly Outfit[];
  latestJobByOutfitId: Readonly<Record<string, WardrobeVisualizationJob>>;
  canGenerate: boolean;
}) {
  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          Virtual Studio — {retailerName}
        </h2>
        <p className="text-sm text-[var(--color-stone-500)]">
          Try on pieces from what you own and your wishlist. AI visualization
          only — not a guarantee of physical fit.
        </p>
      </div>

      <ComposeLookForm
        retailerId={retailerId}
        items={composableItems}
        canGenerate={canGenerate}
      />

      {outfits.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {outfits.map((outfit) => (
            <OutfitCard
              key={outfit.id}
              retailerId={retailerId}
              outfit={outfit}
              latestJob={latestJobByOutfitId[outfit.id] ?? null}
              canGenerate={canGenerate}
            />
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
