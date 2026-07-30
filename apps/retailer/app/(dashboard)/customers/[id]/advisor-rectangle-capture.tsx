"use client";

import type { AdvisorRectangleKind, MetadataConcept } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { recordAdvisorRectangleFacts } from "./advisor-rectangle-actions";

const KINDS: readonly AdvisorRectangleKind[] = [
  "colour",
  "pattern",
  "fibre",
  "weave",
  "occasion",
];

export function AdvisorRectangleCapture({
  customerId,
  concepts,
}: {
  customerId: string;
  concepts: readonly MetadataConcept[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<
    Record<string, { kind: AdvisorRectangleKind; label: string }>
  >({});
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const byKind = KINDS.map((kind) => ({
    kind,
    options: concepts.filter((concept) => concept.kind === kind).slice(0, 12),
  })).filter((group) => group.options.length > 0);

  function toggle(
    conceptId: string,
    kind: AdvisorRectangleKind,
    label: string,
  ) {
    setSelected((current) => {
      const next = { ...current };
      if (next[conceptId]) {
        delete next[conceptId];
      } else {
        next[conceptId] = { kind, label };
      }
      return next;
    });
    setSaved(false);
  }

  function onSave() {
    setError(null);
    startTransition(async () => {
      const result = await recordAdvisorRectangleFacts({
        customerId,
        selections: Object.entries(selected).map(([conceptId, value]) => ({
          conceptId,
          kind: value.kind,
          label: value.label,
          polarity: "positive" as const,
        })),
        ...(note.trim() ? { freeformNote: note.trim() } : {}),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSelected({});
      setNote("");
      setSaved(true);
      router.refresh();
    });
  }

  if (byKind.length === 0) {
    return null;
  }

  return (
    <Card>
      <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
        Advisor rectangles
      </h2>
      <p className="mt-1 text-sm text-[var(--color-stone-500)]">
        Log observed colour, pattern, fabric, or occasion interests. These
        become advisor-observed Self-Portrait facts — never silent inferences.
      </p>
      <div className="mt-4 flex flex-col gap-4">
        {byKind.map((group) => (
          <div key={group.kind}>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-stone-500)]">
              {group.kind.replaceAll("_", " ")}
            </p>
            <div className="flex flex-wrap gap-2">
              {group.options.map((concept) => {
                const active = Boolean(selected[concept.id]);
                return (
                  <button
                    key={concept.id}
                    type="button"
                    onClick={() =>
                      toggle(concept.id, group.kind, concept.canonicalName)
                    }
                    className={`rounded-[var(--radius-md)] border px-3 py-2 text-sm ${
                      active
                        ? "border-[var(--color-stone-900)] bg-[var(--color-stone-900)] text-white"
                        : "border-[var(--color-stone-200)] text-[var(--color-stone-800)]"
                    }`}
                  >
                    {concept.canonicalName}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <label className="mt-4 block text-sm text-[var(--color-stone-700)]">
        Freeform context
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2 text-sm"
          placeholder="Tried navy fresco; prefers soft shoulder"
        />
      </label>
      {error ? (
        <p className="mt-2 text-sm text-[var(--color-danger-600)]">{error}</p>
      ) : null}
      {saved ? (
        <p className="mt-2 text-sm text-[var(--color-stone-600)]">
          Saved to Self-Portrait facts.
        </p>
      ) : null}
      <div className="mt-4">
        <Button
          type="button"
          onClick={onSave}
          disabled={
            pending ||
            (Object.keys(selected).length === 0 && note.trim().length === 0)
          }
        >
          {pending ? "Saving…" : "Save advisor observations"}
        </Button>
      </div>
    </Card>
  );
}
