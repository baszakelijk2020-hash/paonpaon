"use client";

import type { AIGeneration } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";
import { useActionState } from "react";

import { generateNextBestAction, type AIActionState } from "./actions";

const initial: AIActionState = {};

export function AIInsights({
  customerId,
  aiConfigured,
  history,
}: {
  customerId: string;
  aiConfigured: boolean;
  history: AIGeneration[];
}) {
  const [state, action, pending] = useActionState(
    generateNextBestAction.bind(null, customerId),
    initial,
  );

  const latestSucceeded = history.find((entry) => entry.status === "succeeded");

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-medium">Suggested next step</h2>
        {aiConfigured ? (
          <form action={action}>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Thinking…" : "Suggest next action"}
            </Button>
          </form>
        ) : null}
      </div>

      {!aiConfigured ? (
        <p className="text-sm text-[var(--color-stone-500)]">
          AI personalisation is not configured on this deployment.
        </p>
      ) : state.result ? (
        <div className="rounded-[var(--radius-md)] bg-[var(--color-stone-50)] p-4">
          <p className="text-sm font-medium text-[var(--color-stone-900)]">
            {state.result.action}
          </p>
          <p className="mt-1 text-sm text-[var(--color-stone-600)]">
            {state.result.rationale}
          </p>
        </div>
      ) : latestSucceeded?.output ? (
        <div className="rounded-[var(--radius-md)] bg-[var(--color-stone-50)] p-4">
          <p className="text-sm font-medium text-[var(--color-stone-900)]">
            {String(latestSucceeded.output["action"] ?? "")}
          </p>
          <p className="mt-1 text-sm text-[var(--color-stone-600)]">
            {String(latestSucceeded.output["rationale"] ?? "")}
          </p>
          <p className="mt-2 text-xs text-[var(--color-stone-500)]">
            {formatDate(latestSucceeded.createdAt, "en-US")}
          </p>
        </div>
      ) : (
        <p className="text-sm text-[var(--color-stone-500)]">
          No suggestion generated yet.
        </p>
      )}

      {state.formError ? (
        <p role="alert" className="mt-3 text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
    </Card>
  );
}
