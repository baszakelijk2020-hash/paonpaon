"use client";

import {
  OUTFIT_SLOT_KINDS,
  type Outfit,
  type OutfitSlotKind,
  type WardrobeVisualizationFeedbackSignal,
  type WardrobeVisualizationJob,
} from "@paon/domain";
import { useActionState, useEffect, useMemo, useState } from "react";

import { focusNextAction, useActionRunner } from "./fitting-room-shared";
import { JOB_STATUS_COPY } from "./fitting-room-studio";
import { SLOT_LABELS, type ComposableItem } from "./fitting-room-types";
import {
  cancelAllQueuedLooks,
  cancelOutfitGeneration,
  composeCustomerOutfit,
  generateAllSavedLooks,
  generateOutfitLook,
  recordLookFeedback,
  type ComposeOutfitState,
} from "./virtual-studio-actions";

export type StageGate = "ready" | "needs_portrait" | "needs_preset";

const initialComposeState: ComposeOutfitState = {};

const FEEDBACK: readonly {
  signal: WardrobeVisualizationFeedbackSignal;
  label: string;
}[] = [
  { signal: "love_it", label: "Love it" },
  { signal: "maybe", label: "Maybe" },
  { signal: "not_for_me", label: "Not for me" },
  { signal: "looks_like_me_no", label: "Doesn't look like me" },
];

function resolveSlots(
  items: readonly ComposableItem[],
  overrides: Readonly<Record<string, OutfitSlotKind>>,
): Map<string, OutfitSlotKind> {
  const result = new Map<string, OutfitSlotKind>();
  for (const item of items) {
    const slot = overrides[item.key] ?? item.suggestedSlotKind;
    if (slot) result.set(item.key, slot);
  }
  const used = new Set(result.values());
  for (const item of items) {
    if (result.has(item.key)) continue;
    const free = OUTFIT_SLOT_KINDS.find((slot) => !used.has(slot));
    const slot = free ?? "accessories";
    used.add(slot);
    result.set(item.key, slot);
  }
  return result;
}

function itemForSlot(
  slot: Outfit["slots"][number],
  itemsByKey: ReadonlyMap<string, ComposableItem>,
): ComposableItem | undefined {
  if (slot.wardrobeItemId) {
    return itemsByKey.get(`wardrobe:${slot.wardrobeItemId}`);
  }
  if (slot.productId) return itemsByKey.get(`product:${slot.productId}`);
  return undefined;
}

/** The current look: slot chips you can remove, plus naming and saving. */
function Builder({
  retailerId,
  selectedItems,
  onToggle,
  onClear,
  onComposed,
}: {
  retailerId: string;
  selectedItems: readonly ComposableItem[];
  onToggle: (key: string) => void;
  onClear: () => void;
  onComposed: (outfitId: string) => void;
}) {
  const bound = composeCustomerOutfit.bind(null, retailerId);
  const [state, formAction, isPending] = useActionState(
    bound,
    initialComposeState,
  );
  const [overrides, setOverrides] = useState<Record<string, OutfitSlotKind>>(
    {},
  );
  const [title, setTitle] = useState("");

  const slots = useMemo(
    () => resolveSlots(selectedItems, overrides),
    [selectedItems, overrides],
  );
  const slotCounts = new Map<OutfitSlotKind, number>();
  for (const slot of slots.values()) {
    slotCounts.set(slot, (slotCounts.get(slot) ?? 0) + 1);
  }
  const conflict = [...slotCounts.entries()].find(([, n]) => n > 1)?.[0];
  const tooMany = selectedItems.length > OUTFIT_SLOT_KINDS.length;

  useEffect(() => {
    if (!state.outfitId) return;
    onComposed(state.outfitId);
    onClear();
    setTitle("");
    setOverrides({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.outfitId]);

  if (selectedItems.length === 0) {
    return (
      <p className="paon-fit-note paon-fit-look-empty">
        Tap saved pieces to build a look, one piece per slot.
      </p>
    );
  }

  return (
    <form action={formAction} className="paon-fit-builder">
      <ul className="paon-fit-slotchips" aria-label="Pieces in this look">
        {selectedItems.map((item) => {
          const slot = slots.get(item.key) ?? "accessories";
          return (
            <li key={item.key} className="paon-fit-slotchip">
              <select
                className="paon-fit-select"
                aria-label={`Slot for ${item.label}`}
                value={slot}
                onChange={(event) =>
                  setOverrides((current) => ({
                    ...current,
                    [item.key]: event.target.value as OutfitSlotKind,
                  }))
                }
              >
                {OUTFIT_SLOT_KINDS.map((option) => (
                  <option key={option} value={option}>
                    {SLOT_LABELS[option]}
                  </option>
                ))}
              </select>
              <span className="paon-fit-slotchip-name" title={item.label}>
                {item.label}
              </span>
              <button
                type="button"
                className="paon-fit-icon-btn"
                aria-label={`Remove ${item.label} from look`}
                onClick={() => onToggle(item.key)}
              >
                ×
              </button>
              <input
                type="hidden"
                name="slotItem"
                value={`${slot}::${item.kind}::${item.id}`}
              />
            </li>
          );
        })}
      </ul>
      <div className="paon-fit-save-row">
        <input
          className="paon-fit-input"
          name="title"
          maxLength={200}
          placeholder="Name this look (optional)"
          aria-label="Look name"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <button
          type="submit"
          className="paon-fit-btn paon-fit-btn-small"
          disabled={
            isPending ||
            selectedItems.length === 0 ||
            Boolean(conflict) ||
            tooMany
          }
        >
          {isPending ? "Saving…" : "Save look"}
        </button>
        <button
          type="button"
          className="paon-fit-btn paon-fit-btn-small paon-fit-btn-ghost"
          onClick={onClear}
        >
          Clear
        </button>
      </div>
      {conflict ? (
        <p role="alert" className="paon-fit-error">
          Two pieces share the {SLOT_LABELS[conflict].toLowerCase()} slot.
          Change one so each slot has a single piece.
        </p>
      ) : null}
      {tooMany ? (
        <p role="alert" className="paon-fit-error">
          A look holds up to {OUTFIT_SLOT_KINDS.length} pieces.
        </p>
      ) : null}
      {state.formError ? (
        <p role="alert" className="paon-fit-error">
          {state.formError}
        </p>
      ) : null}
    </form>
  );
}

function ActiveLook({
  retailerId,
  outfit,
  job,
  gate,
  nextLabel,
  baseImageUrl,
}: {
  retailerId: string;
  outfit: Outfit | undefined;
  job: WardrobeVisualizationJob | null;
  gate: StageGate;
  nextLabel: string;
  baseImageUrl: string | undefined;
}) {
  const [instructions, setInstructions] = useState("");
  const [given, setGiven] = useState<{
    jobId: string;
    signal: WardrobeVisualizationFeedbackSignal;
  } | null>(null);
  const runner = useActionRunner();
  const canGenerate = gate === "ready";
  const active = job?.status === "queued" || job?.status === "generating";
  const ready = job?.status === "ready" && Boolean(job.outputImageUrl);
  const shownUrl = ready ? job?.outputImageUrl : baseImageUrl;

  function generate() {
    if (!outfit) return;
    runner.run(async () => {
      const result = await generateOutfitLook(
        retailerId,
        outfit.id,
        instructions.trim() || undefined,
      );
      if (result.error) throw new Error(result.error);
    });
  }

  function feedback(signal: WardrobeVisualizationFeedbackSignal) {
    if (!job) return;
    const jobId = job.id;
    runner.run(async () => {
      await recordLookFeedback(retailerId, jobId, signal);
      setGiven({ jobId, signal });
    });
  }

  const statusLine = !outfit
    ? "Save a look to generate it on your portrait."
    : !job
      ? `${outfit.title}: not generated yet.`
      : job.status === "failed"
        ? `Generation failed${job.errorMessage ? `: ${job.errorMessage}` : "."}`
        : job.status === "cancelled"
          ? "Generation cancelled."
          : `${outfit.title}: ${JOB_STATUS_COPY[job.status].toLowerCase()}`;

  return (
    <div className="paon-fit-active">
      <div className="paon-fit-canvas" data-empty={shownUrl ? "false" : "true"}>
        {shownUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shownUrl}
            alt={ready ? (outfit?.title ?? "Generated look") : "Your portrait"}
          />
        ) : (
          <span className="paon-fit-canvas-empty">
            Your try-on appears here
          </span>
        )}
        {ready ? (
          <span className="paon-fit-canvas-tag">AI visualisation</span>
        ) : null}
        {active ? (
          <span className="paon-fit-canvas-tag" role="status">
            <span className="paon-fit-dot" aria-hidden="true" />
            {job?.status === "queued" ? "Queued" : "Generating…"}
          </span>
        ) : null}
      </div>

      {gate === "needs_portrait" ? (
        <p className="paon-fit-hint">
          Set up your portrait first.{" "}
          <button
            type="button"
            className="paon-fit-link paon-fit-link-strong"
            onClick={() => focusNextAction()}
          >
            Next: {nextLabel}
          </button>
        </p>
      ) : gate === "needs_preset" ? (
        <p className="paon-fit-hint">
          Try-on is not switched on yet. Your looks are saved and will generate
          once it is.
        </p>
      ) : null}

      <div className="paon-fit-actions">
        {active ? (
          <button
            type="button"
            className="paon-fit-btn paon-fit-btn-ghost"
            disabled={runner.pending || job?.status !== "queued"}
            onClick={() =>
              job &&
              runner.run(() => cancelOutfitGeneration(retailerId, job.id))
            }
          >
            Cancel
          </button>
        ) : (
          <>
            <input
              className="paon-fit-input"
              maxLength={1000}
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              placeholder="Styling direction (optional)"
              aria-label="Styling direction"
              disabled={!outfit}
            />
            <button
              type="button"
              className="paon-fit-btn"
              disabled={!outfit || !canGenerate || runner.pending}
              onClick={generate}
            >
              {runner.pending
                ? "Starting…"
                : ready
                  ? "Regenerate"
                  : job?.status === "failed"
                    ? "Try again"
                    : "Generate"}
            </button>
          </>
        )}
      </div>
      {gate === "ready" || active ? (
        <p className="paon-fit-note" role="status">
          {active && job?.status === "generating"
            ? "Already generating, it will finish in a moment."
            : statusLine}
        </p>
      ) : null}

      {ready && job ? (
        <div
          className="paon-fit-feedback"
          role="group"
          aria-label="How does it look?"
        >
          {FEEDBACK.map((entry) => (
            <button
              key={entry.signal}
              type="button"
              className="paon-fit-btn paon-fit-btn-small paon-fit-btn-ghost"
              aria-pressed={
                given?.jobId === job.id && given.signal === entry.signal
              }
              disabled={runner.pending}
              onClick={() => feedback(entry.signal)}
            >
              {entry.label}
            </button>
          ))}
          {given?.jobId === job.id ? (
            <span className="paon-fit-ok" role="status">
              Thanks, noted.
            </span>
          ) : null}
        </div>
      ) : null}
      {runner.error ? (
        <p role="alert" className="paon-fit-error">
          {runner.error}
        </p>
      ) : null}
    </div>
  );
}

function Batch({
  retailerId,
  canGenerate,
}: {
  retailerId: string;
  canGenerate: boolean;
}) {
  const runner = useActionRunner();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="paon-fit-batch">
      <button
        type="button"
        className="paon-fit-link"
        disabled={!canGenerate || runner.pending}
        onClick={() => {
          setMessage(null);
          runner.run(async () => {
            const result = await generateAllSavedLooks(retailerId);
            setMessage(
              `${result.enqueued} look${result.enqueued === 1 ? "" : "s"} queued.${
                result.errors.length > 0
                  ? ` ${result.errors.length} skipped: ${result.errors.join("; ")}`
                  : ""
              }`,
            );
          });
        }}
      >
        Generate all
      </button>
      <button
        type="button"
        className="paon-fit-link"
        disabled={runner.pending}
        onClick={() => {
          setMessage(null);
          runner.run(async () => {
            const result = await cancelAllQueuedLooks(retailerId);
            setMessage(
              `${result.cancelled} queued look${result.cancelled === 1 ? "" : "s"} cancelled.`,
            );
          });
        }}
      >
        Cancel queued
      </button>
      {message ? (
        <span className="paon-fit-note" role="status">
          {message}
        </span>
      ) : null}
      {runner.error ? (
        <span role="alert" className="paon-fit-error">
          {runner.error}
        </span>
      ) : null}
    </div>
  );
}

export function FittingStageCard({
  retailerId,
  items,
  outfits,
  latestJobByOutfitId,
  gate,
  nextLabel,
  baseImageUrl,
  selectedKeys,
  onToggle,
  onClear,
}: {
  retailerId: string;
  items: readonly ComposableItem[];
  outfits: readonly Outfit[];
  latestJobByOutfitId: Readonly<Record<string, WardrobeVisualizationJob>>;
  gate: StageGate;
  /** Label of the "You" rail's next action, which the stage points at. */
  nextLabel: string;
  baseImageUrl: string | undefined;
  selectedKeys: ReadonlySet<string>;
  onToggle: (key: string) => void;
  onClear: () => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(
    outfits[0]?.id ?? null,
  );
  const itemsByKey = useMemo(
    () => new Map(items.map((item) => [item.key, item])),
    [items],
  );
  const selectedItems = items.filter((item) => selectedKeys.has(item.key));
  const activeOutfit = outfits.find((outfit) => outfit.id === activeId);
  const activeJob = activeOutfit
    ? (latestJobByOutfitId[activeOutfit.id] ?? null)
    : null;

  return (
    <section
      id="fitting-room-stage"
      className="paon-fit-zone paon-fit-stage"
      aria-labelledby="fitting-room-stage-title"
    >
      <div className="paon-fit-zone-head">
        <h3 id="fitting-room-stage-title" className="paon-fit-label">
          Try on
        </h3>
      </div>

      <Builder
        retailerId={retailerId}
        selectedItems={selectedItems}
        onToggle={onToggle}
        onClear={onClear}
        onComposed={setActiveId}
      />

      <ActiveLook
        key={activeOutfit?.id ?? "none"}
        retailerId={retailerId}
        outfit={activeOutfit}
        job={activeJob}
        gate={gate}
        nextLabel={nextLabel}
        baseImageUrl={baseImageUrl}
      />

      {outfits.length > 0 ? (
        <div className="paon-fit-looks-wrap">
          <div className="paon-fit-zone-head">
            <h4 className="paon-fit-label">Saved looks</h4>
            <Batch retailerId={retailerId} canGenerate={gate === "ready"} />
          </div>
          <div className="paon-fit-looks">
            {outfits.map((outfit) => {
              const job = latestJobByOutfitId[outfit.id];
              const cover =
                job?.status === "ready" && job.outputImageUrl
                  ? job.outputImageUrl
                  : outfit.slots
                      .map((slot) => itemForSlot(slot, itemsByKey))
                      .find((item) => item?.imageUrl)?.imageUrl;
              const status = job ? JOB_STATUS_COPY[job.status] : "Draft";
              return (
                <button
                  key={outfit.id}
                  type="button"
                  className="paon-fit-look"
                  aria-pressed={outfit.id === activeId}
                  aria-label={`${outfit.title}, ${status}`}
                  title={`${outfit.title}, ${status}`}
                  onClick={() => setActiveId(outfit.id)}
                >
                  <span className="paon-fit-look-frame">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cover} alt="" />
                    ) : (
                      <span className="paon-fit-look-blank" />
                    )}
                    <span
                      className="paon-fit-look-dot"
                      data-status={job?.status ?? "draft"}
                      aria-hidden="true"
                    />
                  </span>
                  <span className="paon-fit-look-title">{outfit.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
