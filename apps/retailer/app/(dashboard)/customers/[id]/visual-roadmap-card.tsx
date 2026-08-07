"use client";

import type {
  Outfit,
  OutfitSlotKind,
  WardrobeRoadmap,
  WardrobeVisualizationJob,
} from "@paon/domain";
import { Button, buttonVariants } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { useActionState, useState, useTransition } from "react";

import {
  cancelRoadmapLook,
  createRoadmapLook,
  generateAllPendingRoadmapLooks,
  generateRoadmapLook,
  type RoadmapLookActionState,
} from "./visual-roadmap-actions";

const SLOT_KINDS: readonly OutfitSlotKind[] = [
  "jacket",
  "trousers",
  "shirt",
  "shoes",
  "accessories",
  "pocket_square",
];

export interface RoadmapComposableItem {
  readonly key: string;
  readonly kind: "wardrobe" | "product";
  readonly id: string;
  readonly label: string;
}

const JOB_STATUS_COPY: Record<WardrobeVisualizationJob["status"], string> = {
  queued: "Queued",
  generating: "Generating…",
  ready: "Ready",
  failed: "Generation failed",
  cancelled: "Cancelled",
};

const initialComposeState: RoadmapLookActionState = {};

/**
 * Does NOT attempt to auto-refresh the page after success: this exact
 * `/customers/[id]` route has a documented, confirmed-by-real-browser
 * Next.js 15.1 quirk where neither a bare redirect nor an explicit
 * `router.refresh()` reliably repaints after a mutation (see
 * `FitProfileCandidateDecision`'s own comment, and
 * `apps/retailer/e2e/fit-tools.spec.ts`'s established
 * wait-for-response-then-reload proof pattern). A manual reload remains
 * the reliable way to see a new look reflected; the inline confirmation
 * below is what a signed-in advisor sees without one.
 */
function ComposeLookForm({
  roadmapId,
  items,
  atCap,
}: {
  roadmapId: string;
  items: readonly RoadmapComposableItem[];
  atCap: boolean;
}) {
  const boundCreate = createRoadmapLook.bind(null, roadmapId);
  const [state, formAction, isPending] = useActionState(
    boundCreate,
    initialComposeState,
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [slotByKey, setSlotByKey] = useState<Record<string, string>>({});

  function toggle(key: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        setSlotByKey((slots) => ({ ...slots, [key]: slots[key] ?? "jacket" }));
      }
      return next;
    });
  }

  if (atCap) {
    return (
      <p className="text-sm text-[var(--color-stone-500)]">
        This roadmap already holds the maximum of 12 looks.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--color-stone-600)]">Look title</span>
        <input
          name="title"
          maxLength={200}
          placeholder="Business formal"
          className="rounded-[var(--radius-md)] border border-[var(--color-stone-300)] px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--color-stone-600)]">Occasion</span>
        <input
          name="occasionLabel"
          maxLength={120}
          placeholder="Client presentation"
          className="rounded-[var(--radius-md)] border border-[var(--color-stone-300)] px-3 py-2"
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
              onChange={() => toggle(item.key)}
              aria-label={`Include ${item.label}`}
            />
            <span className="flex-1 text-sm text-[var(--color-stone-800)]">
              {item.label}
            </span>
            {selected.has(item.key) ? (
              <>
                <select
                  value={slotByKey[item.key] ?? "jacket"}
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
                <input
                  type="hidden"
                  name="slotItem"
                  value={`${slotByKey[item.key] ?? "jacket"}::${item.kind}::${item.id}`}
                />
              </>
            ) : null}
          </div>
        ))}
      </div>

      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="text-sm text-[var(--color-success-500)]">
          Look added — reload to see it in the roadmap below.
        </p>
      ) : null}

      <Button
        type="submit"
        size="sm"
        disabled={isPending || selected.size === 0}
      >
        {isPending ? "Adding…" : "Add look to roadmap"}
      </Button>
    </form>
  );
}

function LookCard({
  customerId,
  look,
  latestJob,
}: {
  customerId: string;
  look: Outfit;
  latestJob: WardrobeVisualizationJob | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [justEnqueued, setJustEnqueued] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isActive =
    latestJob?.status === "queued" || latestJob?.status === "generating";

  function generate() {
    setError(null);
    startTransition(async () => {
      const result = await generateRoadmapLook(customerId, look.id);
      if (result.error) {
        setError(result.error);
      } else {
        setJustEnqueued(true);
      }
    });
  }

  function cancel() {
    if (!latestJob) return;
    startTransition(() => cancelRoadmapLook(customerId, latestJob.id));
  }

  return (
    <li className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] p-3">
      <div>
        <p className="text-sm font-medium text-[var(--color-stone-900)]">
          {look.title}
        </p>
        {look.occasionLabel ? (
          <p className="text-xs text-[var(--color-stone-500)]">
            {look.occasionLabel}
          </p>
        ) : null}
      </div>

      {latestJob?.status === "ready" && latestJob.outputImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={latestJob.outputImageUrl}
          alt={look.title}
          className="max-h-64 rounded-[var(--radius-md)] border border-[var(--color-stone-200)]"
        />
      ) : null}

      {latestJob ? (
        <p className="text-xs text-[var(--color-stone-500)]" role="status">
          {JOB_STATUS_COPY[latestJob.status]}
          {latestJob.status === "failed" && latestJob.errorMessage
            ? ` — ${latestJob.errorMessage}`
            : ""}
        </p>
      ) : justEnqueued ? (
        <p className="text-xs text-[var(--color-stone-500)]" role="status">
          Queued — reload to see status.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {error}
        </p>
      ) : null}

      {!isActive ? (
        <Button size="sm" onClick={generate} disabled={isPending}>
          {latestJob?.status === "ready" ? "Regenerate" : "Generate"}
        </Button>
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
    </li>
  );
}

export function VisualRoadmapCard({
  customerId,
  roadmap,
  looks,
  latestJobByOutfitId,
  composableItems,
  canManage,
}: {
  customerId: string;
  roadmap: WardrobeRoadmap;
  looks: readonly Outfit[];
  latestJobByOutfitId: Readonly<Record<string, WardrobeVisualizationJob>>;
  composableItems: readonly RoadmapComposableItem[];
  canManage: boolean;
}) {
  const [batchResult, setBatchResult] = useState<{
    enqueued: number;
    errors: readonly string[];
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  function generateAll() {
    setBatchResult(null);
    startTransition(async () => {
      const result = await generateAllPendingRoadmapLooks(roadmap.id);
      setBatchResult(result);
    });
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          Visual roadmap — {roadmap.title}
        </h2>
        <p className="text-sm text-[var(--color-stone-500)]">
          Up to 12 generated looks the client can review one at a time. AI
          visualization only — never a guarantee of physical fit.
        </p>
      </div>

      {looks.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {looks.map((look) => (
            <LookCard
              key={look.id}
              customerId={customerId}
              look={look}
              latestJob={latestJobByOutfitId[look.id] ?? null}
            />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[var(--color-stone-500)]">
          No looks yet — add one below.
        </p>
      )}

      {canManage && looks.length > 0 ? (
        <div className="flex flex-col gap-2 border-t border-[var(--color-stone-100)] pt-4">
          <Button
            size="sm"
            variant="secondary"
            onClick={generateAll}
            disabled={isPending}
          >
            {isPending ? "Enqueuing…" : "Create all pending looks"}
          </Button>
          {batchResult ? (
            <p className="text-xs text-[var(--color-stone-500)]" role="status">
              {batchResult.enqueued} look
              {batchResult.enqueued === 1 ? "" : "s"} enqueued.
              {batchResult.errors.length > 0
                ? ` ${batchResult.errors.length} skipped: ${batchResult.errors.join("; ")}`
                : ""}
            </p>
          ) : null}
        </div>
      ) : null}

      {canManage ? (
        <div className="border-t border-[var(--color-stone-100)] pt-4">
          <p className="mb-2 text-sm font-medium text-[var(--color-stone-900)]">
            Add a look
          </p>
          <ComposeLookForm
            roadmapId={roadmap.id}
            items={composableItems}
            atCap={looks.length >= 12}
          />
        </div>
      ) : null}
    </Card>
  );
}
