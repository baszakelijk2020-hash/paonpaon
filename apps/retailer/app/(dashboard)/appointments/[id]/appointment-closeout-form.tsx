"use client";

import type {
  AppointmentCloseoutOutcome,
  CloseoutRectangleKind,
  MetadataConcept,
} from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { recordAppointmentCloseout } from "./branch-calendar-actions";

const OUTCOMES: readonly {
  readonly value: AppointmentCloseoutOutcome;
  readonly label: string;
}[] = [
  { value: "completed_with_interest", label: "Completed — interest noted" },
  { value: "completed_no_purchase", label: "Completed — no purchase" },
  { value: "follow_up_scheduled", label: "Follow-up scheduled" },
  { value: "alteration_started", label: "Alteration started" },
  { value: "no_show_confirmed", label: "No-show confirmed" },
];

const KINDS: readonly CloseoutRectangleKind[] = [
  "colour",
  "pattern",
  "fibre",
  "occasion",
  "fit",
];

export function AppointmentCloseoutForm({
  appointmentId,
  customerId,
  concepts,
}: {
  readonly appointmentId: string;
  readonly customerId: string;
  readonly concepts: readonly MetadataConcept[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [outcome, setOutcome] =
    useState<AppointmentCloseoutOutcome>("completed_with_interest");
  const [selected, setSelected] = useState<
    Record<string, { kind: CloseoutRectangleKind; label: string }>
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
    kind: CloseoutRectangleKind,
    label: string,
  ) {
    setSelected((current) => {
      const next = { ...current };
      if (next[conceptId]) delete next[conceptId];
      else next[conceptId] = { kind, label };
      return next;
    });
    setSaved(false);
  }

  function onSave() {
    setError(null);
    startTransition(async () => {
      const result = await recordAppointmentCloseout({
        appointmentId,
        customerId,
        outcome,
        selections: Object.entries(selected).map(([conceptId, value]) => ({
          conceptId,
          kind: value.kind,
          label: value.label,
          polarity: "positive" as const,
        })),
        ...(note.trim() ? { followUpNotes: note.trim() } : {}),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <Card className="rounded-[var(--radius-md)]">
      <p className="font-accent text-[11px] uppercase tracking-[0.18em] text-[var(--color-stone-500)]">
        Post-appointment closeout
      </p>
      <h2 className="font-display mt-2 text-2xl">
        Capture what mattered from this visit
      </h2>
      <p className="mt-2 text-sm text-[var(--color-stone-500)]">
        Structured rectangles become advisor-observed Self-Portrait facts with
        appointment provenance — never silent inferences.
      </p>
      <label className="mt-4 block text-sm text-[var(--color-stone-700)]">
        Outcome
        <select
          value={outcome}
          onChange={(event) => {
            setOutcome(event.target.value as AppointmentCloseoutOutcome);
            setSaved(false);
          }}
          className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2 text-sm"
        >
          {OUTCOMES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {byKind.length > 0 ? (
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
      ) : null}
      <label className="mt-4 block text-sm text-[var(--color-stone-700)]">
        Follow-up note
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2 text-sm"
          placeholder="Send swatches Tuesday; book summer wedding fitting"
        />
      </label>
      {error ? (
        <p className="mt-2 text-sm text-[var(--color-danger-600)]">{error}</p>
      ) : null}
      {saved ? (
        <p className="mt-2 text-sm text-[var(--color-stone-600)]">
          Closeout saved to Self-Portrait facts.
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
