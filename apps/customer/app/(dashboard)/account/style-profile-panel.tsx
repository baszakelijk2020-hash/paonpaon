"use client";

import type {
  CustomerStyleProfile,
  DeclaredStylePreference,
} from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import Link from "next/link";
import { useActionState } from "react";

import {
  removeInferredPreference,
  type StyleProfileActionState,
} from "./style-profile-actions";

function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function polarityLabel(polarity: string): string {
  if (polarity === "positive") return "Likes";
  if (polarity === "negative") return "Avoids";
  return "Neutral";
}

export function StyleProfilePanel({
  retailerId,
  retailerName,
  profile,
  conceptLabels,
}: {
  retailerId: string;
  retailerName: string;
  profile: CustomerStyleProfile | null;
  conceptLabels: Readonly<Record<string, string>>;
}) {
  const initialState: StyleProfileActionState = {
    fieldErrors: {},
  };
  const [state, formAction, isPending] = useActionState(
    removeInferredPreference,
    initialState,
  );

  const inferred = profile?.inferredPreferences ?? [];
  const declared = profile?.explicitPreferences ?? [];

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          Style profile — {retailerName}
        </h2>
        <p className="text-sm text-[var(--color-stone-500)]">
          Declared preferences stay yours. Inferred preferences come from
          consented activity and can be removed without deleting purchase or
          appointment history.
        </p>
        <Link
          href="/style-quiz"
          className="text-sm text-[var(--color-stone-700)] underline"
        >
          {declared.length === 0
            ? "Take the 60-second style quiz"
            : "Retake the style quiz"}
        </Link>
      </div>

      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="text-sm text-[var(--color-success-500)]">
          Inferred preference removed.
        </p>
      ) : null}

      <section aria-labelledby={`declared-${retailerId}`}>
        <h3
          id={`declared-${retailerId}`}
          className="text-sm font-medium text-[var(--color-stone-700)]"
        >
          Declared preferences
        </h3>
        {declared.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--color-stone-500)]">
            No concept declarations yet. Style notes in settings remain separate
            free-text notes.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {declared.map((row) => (
              <DeclaredRow
                key={row.conceptId}
                row={row}
                label={conceptLabels[row.conceptId] ?? row.conceptId}
              />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby={`inferred-${retailerId}`}>
        <h3
          id={`inferred-${retailerId}`}
          className="text-sm font-medium text-[var(--color-stone-700)]"
        >
          Inferred preferences
        </h3>
        {inferred.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--color-stone-500)]">
            Nothing inferred yet. Favourites, skips, and other consented signals
            build explainable preferences over time.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-3">
            {inferred.map((row) => (
              <li
                key={row.conceptId}
                className="flex flex-col gap-2 border-t border-[var(--color-stone-200)] pt-3 first:border-t-0 first:pt-0"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-stone-900)]">
                      {conceptLabels[row.conceptId] ?? "Concept"}{" "}
                      <span className="font-normal text-[var(--color-stone-500)]">
                        ({polarityLabel(row.polarity)})
                      </span>
                    </p>
                    <p className="text-xs text-[var(--color-stone-500)]">
                      Confidence {formatConfidence(row.confidence)} · Last
                      evidence {formatWhen(row.lastEvidenceAt)} ·{" "}
                      {row.evidenceIds.length} evidence
                      {row.evidenceIds.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <form action={formAction}>
                    <input type="hidden" name="retailerId" value={retailerId} />
                    <input
                      type="hidden"
                      name="conceptId"
                      value={row.conceptId}
                    />
                    <Button
                      type="submit"
                      variant="secondary"
                      disabled={isPending}
                    >
                      {isPending ? "Removing…" : "Remove inference"}
                    </Button>
                  </form>
                </div>
                <details className="text-xs text-[var(--color-stone-500)]">
                  <summary className="cursor-pointer">Why this exists</summary>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {row.factors.slice(0, 8).map((factor, index) => (
                      <li key={`${factor.code}-${index}`}>
                        {factor.detail}
                        {factor.delta !== 0 ? ` (${factor.delta})` : ""}
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Card>
  );
}

function DeclaredRow({
  row,
  label,
}: {
  row: DeclaredStylePreference;
  label: string;
}) {
  return (
    <li className="text-sm text-[var(--color-stone-700)]">
      <span className="font-medium text-[var(--color-stone-900)]">{label}</span>
      {" — "}
      {polarityLabel(row.polarity)}
      {row.note ? ` · ${row.note}` : ""}
      <span className="text-[var(--color-stone-500)]">
        {" "}
        · Updated {formatWhen(row.updatedAt)}
      </span>
    </li>
  );
}
