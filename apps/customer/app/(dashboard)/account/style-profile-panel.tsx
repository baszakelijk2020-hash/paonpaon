"use client";

import type { InferredStylePreference, StyleProfile } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { useActionState } from "react";

import {
  removeStyleInferenceEvidence,
  type StyleProfileActionState,
} from "./style-profile-actions";

export function StyleProfilePanel({
  retailerId,
  retailerName,
  profile,
  conceptNames,
}: {
  retailerId: string;
  retailerName: string;
  profile: StyleProfile;
  conceptNames: Record<string, string>;
}) {
  const initialState: StyleProfileActionState = {};
  const [state, formAction, isPending] = useActionState(
    removeStyleInferenceEvidence,
    initialState,
  );
  const displayProfile = state.profile ?? profile;

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          Style profile — {retailerName}
        </h2>
        <p className="text-sm text-[var(--color-stone-500)]">
          Declared preferences stay separate from inferred interests. Remove an
          inference to stop it influencing recommendations without deleting your
          order or browsing history.
        </p>
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="text-sm text-[var(--color-success-500)]">
          Inference updated.
        </p>
      ) : null}

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-[var(--color-stone-700)]">
          Declared preferences
        </h3>
        {displayProfile.explicitPreferences.length === 0 ? (
          <p className="text-sm text-[var(--color-stone-500)]">
            None declared yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm text-[var(--color-stone-700)]">
            {displayProfile.explicitPreferences.map((pref) => (
              <li key={`${pref.conceptId}-${pref.declaredAt}`}>
                {conceptNames[pref.conceptId] ?? pref.conceptId} —{" "}
                {pref.polarity}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium text-[var(--color-stone-700)]">
          Inferred interests
        </h3>
        {displayProfile.inferredPreferences.length === 0 ? (
          <p className="text-sm text-[var(--color-stone-500)]">
            No inferred preferences yet. Browse and save items with
            personalisation enabled to build explainable signals.
          </p>
        ) : (
          displayProfile.inferredPreferences.map((inferred) => (
            <InferredPreferenceCard
              key={inferred.conceptId}
              retailerId={retailerId}
              inferred={inferred}
              conceptName={
                conceptNames[inferred.conceptId] ?? inferred.conceptId
              }
              formAction={formAction}
              isPending={isPending}
            />
          ))
        )}
      </section>
    </Card>
  );
}

function InferredPreferenceCard({
  retailerId,
  inferred,
  conceptName,
  formAction,
  isPending,
}: {
  retailerId: string;
  inferred: InferredStylePreference;
  conceptName: string;
  formAction: (payload: FormData) => void;
  isPending: boolean;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] p-3">
      <p className="text-sm font-medium text-[var(--color-stone-900)]">
        {conceptName}
      </p>
      <p className="text-xs text-[var(--color-stone-500)]">
        {inferred.polarity} · score {inferred.score.toFixed(2)} ·{" "}
        {inferred.evidenceCount} signal
        {inferred.evidenceCount === 1 ? "" : "s"} · last{" "}
        {new Date(inferred.lastEvidenceAt).toLocaleDateString()}
      </p>
      <ul className="mt-2 flex flex-col gap-1 text-xs text-[var(--color-stone-600)]">
        {inferred.factors.map((factor) => (
          <li key={factor.evidenceId ?? factor.detail}>
            {factor.detail}
            {factor.evidenceId ? (
              <form action={formAction} className="mt-1 inline-block">
                <input type="hidden" name="retailerId" value={retailerId} />
                <input
                  type="hidden"
                  name="evidenceId"
                  value={factor.evidenceId}
                />
                <Button type="submit" variant="ghost" disabled={isPending}>
                  Remove signal
                </Button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
