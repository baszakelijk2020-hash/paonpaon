"use client";

import { Button } from "@paon/ui/components/Button";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { useActionState } from "react";

import {
  dismissCandidate,
  recordApprovedMeasurements,
  type MeasurementActionState,
} from "./actions";

interface MeasurementValue {
  readonly key: string;
  readonly millimetres: number;
  readonly capturedBy: string;
}

const initial: MeasurementActionState = {};

function getMeasurementLabel(key: string): string {
  const labels: Record<string, string> = {
    chest: "Chest",
    waist: "Waist",
    sleeve_length: "Sleeve length",
    shoulder: "Shoulder",
    jacket_length: "Jacket length",
    trouser_length: "Trouser length",
    trouser_inseam: "Trouser inseam",
    hips: "Hips",
  };
  return labels[key] || key;
}

function formatMeasurementUnit(mm: number): string {
  const cm = mm / 10;
  return `${cm.toFixed(1)}`;
}

function getCaptureMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    guided_self_scan: "Guided self-scan",
    tailor_tape: "Measured by hand",
    imported_record: "Imported record",
    garment_derived: "Derived from garment",
  };
  return labels[method] || method;
}

/**
 * Review and approve measurements. The advisor enters the values they
 * actually signed off and provides a review note (required if any value
 * came from a self-scan).
 */
export function MeasurementReviewForm({
  candidateId,
  customerId,
  proposedValues,
}: {
  readonly candidateId: string;
  readonly customerId: string;
  readonly proposedValues: readonly MeasurementValue[];
}) {
  const [state, action, pending] = useActionState(
    recordApprovedMeasurements,
    initial,
  );

  const hasSelfScan = proposedValues.some(
    (v) => v.capturedBy === "guided_self_scan",
  );

  // Ids are scoped to the candidate. The review queue renders one of these
  // forms PER candidate, so a literal `id="reviewNote"` appears several times
  // on the page — duplicate ids mean every `<label for>` resolves to the
  // first form, and clicking the third candidate's label focuses the first
  // candidate's input. The name attributes stay unscoped because each form
  // posts on its own.
  const fieldId = (suffix: string) => `${suffix}-${candidateId}`;

  return (
    <form
      action={action}
      className="flex flex-col gap-3 rounded border border-[var(--color-stone-200)] bg-[var(--color-stone-50)] p-4"
    >
      <input type="hidden" name="candidateId" value={candidateId} />
      <input type="hidden" name="customerId" value={customerId} />

      <h3 className="text-sm font-medium text-[var(--color-stone-900)]">
        Record approved measurements
      </h3>

      {/* One input per measurement */}
      {proposedValues.map((value, index) => (
        <div key={value.key} className="flex flex-col gap-1">
          <input
            type="hidden"
            name={`measurement_${index}_key`}
            value={value.key}
          />
          <FormField
            htmlFor={fieldId(`measurement_${index}_mm`)}
            label={getMeasurementLabel(value.key)}
            hint={`Proposed: ${formatMeasurementUnit(value.millimetres)} cm (${getCaptureMethodLabel(value.capturedBy)})`}
          >
            <Input
              id={fieldId(`measurement_${index}_mm`)}
              name={`measurement_${index}_mm`}
              type="number"
              step="0.1"
              min="0"
              placeholder="Enter in cm"
              defaultValue={formatMeasurementUnit(value.millimetres)}
              required
              aria-label={`${getMeasurementLabel(value.key)} in centimetres`}
            />
          </FormField>
        </div>
      ))}

      {/* Review note (required if self-scan present) */}
      <FormField
        htmlFor={fieldId("reviewNote")}
        label="Review note"
        hint={
          hasSelfScan
            ? "Required: This scan included guided self-measurements. Explain your decision."
            : "Optional: Explain your decision, especially if you're changing any values."
        }
      >
        <Input
          id={fieldId("reviewNote")}
          name="reviewNote"
          type="text"
          maxLength={1000}
          placeholder="Why you approved these values…"
          required={hasSelfScan}
          aria-label="Review note"
        />
      </FormField>

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Recording…" : "Record approved measurements"}
      </Button>

      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
      {state.notice ? (
        <p role="status" className="text-sm text-[var(--color-success-500)]">
          {state.notice}
        </p>
      ) : null}
    </form>
  );
}

/**
 * Dismiss a candidate without changing the approved measurements.
 * Does not require a note.
 */
export function MeasurementDismissForm({
  candidateId,
}: {
  readonly candidateId: string;
}) {
  const [state, action, pending] = useActionState(dismissCandidate, initial);

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="candidateId" value={candidateId} />
      <Button type="submit" size="sm" variant="ghost" disabled={pending}>
        {pending ? "Dismissing…" : "Dismiss without changing measurements"}
      </Button>
      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
      {state.notice ? (
        <p role="status" className="text-sm text-[var(--color-success-500)]">
          {state.notice}
        </p>
      ) : null}
    </form>
  );
}
