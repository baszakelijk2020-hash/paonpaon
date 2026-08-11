"use client";

import type { CustomerFact } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { useActionState } from "react";

import {
  correctOwnCustomerFact,
  type CustomerFactCorrectionFormState,
} from "./actions";

const PROVENANCE_LABELS: Record<CustomerFact["provenanceClass"], string> = {
  customer_declared: "You declared this",
  advisor_observed: "Observed by your advisor",
  transactional: "Recorded from an order or service",
  behaviour_inferred: "Inferred from your activity",
};

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

function CustomerFactRow({ fact }: { fact: CustomerFact }) {
  const initialState: CustomerFactCorrectionFormState = { fieldErrors: {} };
  const [state, formAction, isPending] = useActionState(
    correctOwnCustomerFact,
    initialState,
  );

  return (
    <li className="border-t border-[var(--color-stone-200)] pt-4 first:border-t-0 first:pt-0">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-[var(--color-stone-900)]">
          {fact.valueLabel}
        </p>
        {fact.valueText ? (
          <p className="text-sm text-[var(--color-stone-600)]">
            {fact.valueText}
          </p>
        ) : null}
        <p className="text-xs text-[var(--color-stone-500)]">
          {PROVENANCE_LABELS[fact.provenanceClass]} · recorded{" "}
          {formatDate(fact.observedAt)}
        </p>
      </div>

      <form action={formAction} className="mt-3 flex flex-col gap-3">
        <input type="hidden" name="factId" value={fact.id} />
        <label className="flex flex-col gap-1 text-sm text-[var(--color-stone-700)]">
          Correct or replace this
          <input
            name="replacementValueLabel"
            required
            maxLength={500}
            defaultValue={fact.valueLabel}
            className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white px-3 py-2 text-sm text-[var(--color-stone-900)]"
          />
          {state.fieldErrors["replacementValueLabel"] ? (
            <span className="text-xs text-[var(--color-danger-500)]">
              {state.fieldErrors["replacementValueLabel"]}
            </span>
          ) : null}
        </label>
        <label className="flex flex-col gap-1 text-sm text-[var(--color-stone-700)]">
          Why is this incorrect?{" "}
          <span className="text-xs text-[var(--color-stone-500)]">
            Optional
          </span>
          <textarea
            name="reason"
            maxLength={1000}
            rows={2}
            className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white px-3 py-2 text-sm text-[var(--color-stone-900)]"
          />
        </label>
        {state.formError ? (
          <p role="alert" className="text-sm text-[var(--color-danger-500)]">
            {state.formError}
          </p>
        ) : null}
        {state.success ? (
          <p role="status" className="text-sm text-[var(--color-success-500)]">
            Your correction has been added to your House Memory.
          </p>
        ) : null}
        <div>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : "Submit correction"}
          </Button>
        </div>
      </form>
    </li>
  );
}

export function CustomerFactsPanel({
  retailerName,
  facts,
}: {
  retailerName: string;
  facts: readonly CustomerFact[];
}) {
  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          House Memory — {retailerName}
        </h2>
        <p className="text-sm text-[var(--color-stone-500)]">
          Review the facts this House uses to serve you. A correction adds your
          declaration without erasing the original record.
        </p>
      </div>
      {facts.length === 0 ? (
        <p className="text-sm text-[var(--color-stone-500)]">
          There are no reviewable facts yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {facts.map((fact) => (
            <CustomerFactRow key={fact.id} fact={fact} />
          ))}
        </ul>
      )}
    </Card>
  );
}
