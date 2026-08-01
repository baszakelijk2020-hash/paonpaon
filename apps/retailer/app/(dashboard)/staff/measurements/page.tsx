import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";

import {
  MeasurementReviewForm,
  MeasurementDismissForm,
} from "./measurement-forms";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

interface CandidateRow {
  id: string;
  customer_id: string;
  decision: string;
  values: unknown;
  deltas: unknown;
  rationale: string;
  created_at: string;
}

interface MeasurementValue {
  key: string;
  millimetres: number;
  capturedBy: string;
}

interface MeasurementDelta {
  key: string;
  deltaMillimetres: number;
}

function formatMeasurementUnit(mm: number): string {
  const cm = mm / 10;
  return `${cm.toFixed(1)} cm`;
}

function formatDelta(delta: MeasurementDelta): string {
  const sign = delta.deltaMillimetres > 0 ? "+" : "";
  return `${sign}${formatMeasurementUnit(Math.abs(delta.deltaMillimetres))}`;
}

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
 * Advisor measurement review queue (PHASE 12.1 / MeasurementMonitor).
 * Candidates are listed per retailer; advisors review and decide which
 * values to sign off by restating them explicitly. A self-scan is never
 * a measurement of record without an advisor and a written review note.
 */
export default async function MeasurementReviewPage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();

  // Fetch all candidates across all customers for this retailer
  const { data: candidatesData, error: candidatesError } = await supabase
    .from("customer_measurement_candidates")
    .select("*")
    .eq("retailer_id", session.retailerId)
    .eq("decision", "advisor_review")
    .is("resolved_at", null)
    .order("created_at", { ascending: true });

  if (candidatesError) throw candidatesError;
  const candidates = (candidatesData ?? []) as CandidateRow[];

  // Fetch customer names for all unique customer IDs
  const { data: customersData, error: customersError } = await supabase
    .from("customers")
    .select("id, full_name");

  if (customersError) throw customersError;
  const customerMap = new Map(
    (customersData ?? []).map((c: { id: string; full_name: string }) => [
      c.id,
      c.full_name,
    ]),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
          Measurement reviews
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          A scan proposes. You decide what measurements are actually on record.
        </p>
      </div>

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Waiting for your review ({candidates.length})
        </h2>
        {candidates.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-stone-500)]">
            No scans are waiting for review. Anything a customer captures that
            differs from their approved measurements will appear here.
          </p>
        ) : (
          <ul
            id="measurement-review-queue"
            className="mt-3 flex flex-col gap-6"
          >
            {candidates.map((candidate) => {
              const customerName = customerMap.get(candidate.customer_id);
              const values = (candidate.values ?? []) as MeasurementValue[];
              const deltas = (candidate.deltas ?? []) as MeasurementDelta[];

              return (
                <li
                  key={candidate.id}
                  data-candidate-id={candidate.id}
                  data-decision={candidate.decision}
                  className="border-b border-[var(--color-stone-100)] pb-6 last:border-0"
                >
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-[var(--color-stone-900)]">
                      {customerName} ·{" "}
                      {formatDate(candidate.created_at, "en-US")}
                    </p>
                    <p className="text-sm text-[var(--color-stone-700)]">
                      {candidate.rationale}
                    </p>
                  </div>

                  {/* Deltas summary */}
                  {deltas.length > 0 && (
                    <div className="mt-3 rounded bg-[var(--color-stone-50)] p-3">
                      <p className="text-xs font-medium text-[var(--color-stone-600)]">
                        Changes from approved:
                      </p>
                      <ul className="mt-2 space-y-1">
                        {deltas.map((delta) => (
                          <li
                            key={delta.key}
                            className="text-sm text-[var(--color-stone-700)]"
                          >
                            {getMeasurementLabel(delta.key)}:{" "}
                            <span className="font-mono">
                              {formatDelta(delta)}
                            </span>{" "}
                            larger than approved
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Proposed values with capture methods */}
                  {values.length > 0 && (
                    <div className="mt-3 rounded bg-[var(--color-stone-50)] p-3">
                      <p className="text-xs font-medium text-[var(--color-stone-600)]">
                        Proposed measurements:
                      </p>
                      <ul className="mt-2 space-y-1">
                        {values.map((value) => (
                          <li
                            key={value.key}
                            className="text-sm text-[var(--color-stone-700)]"
                          >
                            {getMeasurementLabel(value.key)}:{" "}
                            <span className="font-mono">
                              {formatMeasurementUnit(value.millimetres)}
                            </span>{" "}
                            ({getCaptureMethodLabel(value.capturedBy)})
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Review form */}
                  <div className="mt-4 space-y-3">
                    <MeasurementReviewForm
                      candidateId={candidate.id}
                      customerId={candidate.customer_id}
                      proposedValues={values}
                    />
                    <MeasurementDismissForm candidateId={candidate.id} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
