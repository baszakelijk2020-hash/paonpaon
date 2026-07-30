"use client";

import type { AdvisorRectangleKind, MetadataConcept } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { submitAppointmentCloseout } from "./closeout-actions";

const KINDS: readonly AdvisorRectangleKind[] = [
  "colour",
  "pattern",
  "fibre",
  "weave",
  "occasion",
  "fit",
];

/**
 * Structured post-appointment closeout — feeds provenance-aware facts
 * and optional follow-up moments (CLI-006).
 */
export function AppointmentCloseoutCapture({
  appointmentId,
  customerId,
  concepts,
  alreadyClosedOut,
}: {
  readonly appointmentId: string;
  readonly customerId: string;
  readonly concepts: readonly MetadataConcept[];
  readonly alreadyClosedOut: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<
    Record<string, { kind: AdvisorRectangleKind; label: string }>
  >({});
  const [note, setNote] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(alreadyClosedOut);

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
      const result = await submitAppointmentCloseout({
        appointmentId,
        customerId,
        selections: Object.entries(selected).map(([conceptId, value]) => ({
          conceptId,
          kind: value.kind,
          label: value.label,
          polarity: "positive" as const,
        })),
        ...(note.trim() ? { freeformNote: note.trim() } : {}),
        ...(nextStep.trim() ? { nextStep: nextStep.trim() } : {}),
        ...(followUpDate ? { followUpDate } : {}),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  if (alreadyClosedOut || saved) {
    return (
      <Card>
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          Appointment closeout
        </h2>
        <p className="mt-2 text-sm text-[var(--color-stone-500)]">
          Closeout recorded. Rectangle facts are on the customer Self-Portrait.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="mb-4">
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          Appointment closeout
        </h2>
        <p className="text-sm text-[var(--color-stone-500)]">
          Capture fabrics, colours, fit, and next step before leaving the
          conversation. Answers become advisor-observed Self-Portrait facts.
        </p>
      </div>

      {byKind.length === 0 ? (
        <p className="text-sm text-[var(--color-stone-500)]">
          No accepted metadata rectangles available yet. Add concepts in
          Metadata review first.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {byKind.map((group) => (
            <div key={group.kind}>
              <p className="mb-2 text-xs uppercase tracking-[0.14em] text-[var(--color-stone-500)]">
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
                      className={`rounded-[var(--radius-sm)] border px-3 py-1.5 text-sm ${
                        active
                          ? "border-[var(--color-stone-900)] bg-[var(--color-stone-900)] text-white"
                          : "border-[var(--color-stone-300)] text-[var(--color-stone-800)]"
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
      )}

      <label className="mt-4 block text-sm text-[var(--color-stone-700)]">
        Context
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-stone-300)] px-3 py-2 text-sm"
          rows={3}
        />
      </label>
      <label className="mt-3 block text-sm text-[var(--color-stone-700)]">
        Next step
        <input
          value={nextStep}
          onChange={(event) => setNextStep(event.target.value)}
          className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-stone-300)] px-3 py-2 text-sm"
        />
      </label>
      <label className="mt-3 block text-sm text-[var(--color-stone-700)]">
        Follow-up date
        <input
          type="date"
          value={followUpDate}
          onChange={(event) => setFollowUpDate(event.target.value)}
          className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-stone-300)] px-3 py-2 text-sm"
        />
      </label>

      {error ? (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-4">
        <Button type="button" onClick={onSave} disabled={pending}>
          {pending ? "Saving…" : "Save closeout"}
        </Button>
      </div>
    </Card>
  );
}
