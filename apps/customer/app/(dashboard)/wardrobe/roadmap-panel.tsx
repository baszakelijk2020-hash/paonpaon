"use client";

import type { WardrobeRoadmap } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { useActionState } from "react";

import {
  decideWardrobeRoadmap,
  type CustomerRoadmapActionState,
} from "./roadmap-actions";

export function WardrobeRoadmapPanel({
  retailerName,
  roadmaps,
}: {
  retailerName: string;
  roadmaps: readonly WardrobeRoadmap[];
}) {
  const initialState: CustomerRoadmapActionState = { fieldErrors: {} };
  const [state, action, pending] = useActionState(
    decideWardrobeRoadmap,
    initialState,
  );

  if (roadmaps.length === 0) {
    return (
      <Card className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
            Roadmap — {retailerName}
          </h2>
          <p className="text-sm text-[var(--color-stone-500)]">
            When your advisor shares an approved plan, goals, ranked gaps, and
            staged suggestions appear here with explanations.
          </p>
        </div>
        <div
          className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-stone-300)] px-4 py-8 text-center"
          role="status"
        >
          <p className="text-sm text-[var(--color-stone-600)]">
            No plan awaiting review or approved yet.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          Roadmap — {retailerName}
        </h2>
        <p className="text-sm text-[var(--color-stone-500)]">
          Approved plans show how each purchase fills a gap. Pending plans need
          your approval before they become the working roadmap.
        </p>
      </div>

      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="text-sm text-[var(--color-success-500)]">
          Roadmap decision saved.
        </p>
      ) : null}

      <ul className="flex flex-col gap-4">
        {roadmaps.map((roadmap) => (
          <li
            key={roadmap.id}
            className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-[var(--color-stone-900)]">
                  {roadmap.title}
                </p>
                <p className="text-xs text-[var(--color-stone-500)]">
                  {roadmap.status.replaceAll("_", " ")}
                  {roadmap.horizonLabel ? ` · ${roadmap.horizonLabel}` : ""}
                </p>
              </div>
            </div>

            {roadmap.goals.length > 0 ? (
              <div className="mt-3">
                <p className="text-xs uppercase tracking-wide text-[var(--color-stone-500)]">
                  Goals
                </p>
                <ul className="mt-1 space-y-1 text-sm text-[var(--color-stone-700)]">
                  {roadmap.goals.map((goal) => (
                    <li key={goal.id}>{goal.title}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="mt-3">
              <p className="text-xs uppercase tracking-wide text-[var(--color-stone-500)]">
                Ranked gaps
              </p>
              <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-[var(--color-stone-700)]">
                {roadmap.gaps.map((gap) => (
                  <li key={gap.id}>
                    {gap.title}
                    {gap.howPurchaseFillsGap ? (
                      <span className="block text-xs text-[var(--color-stone-500)]">
                        How a purchase fills this: {gap.howPurchaseFillsGap}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>

            <div className="mt-3">
              <p className="text-xs uppercase tracking-wide text-[var(--color-stone-500)]">
                Staged priorities
              </p>
              <ul className="mt-1 space-y-2 text-sm text-[var(--color-stone-700)]">
                {roadmap.stages.map((stage) => (
                  <li key={stage.id}>
                    <p className="font-medium">{stage.title}</p>
                    <p className="text-xs text-[var(--color-stone-500)]">
                      {stage.explanation}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-stone-500)]">
                      Cites rule “{stage.ruleCitations[0]?.ruleTitle ?? "—"}”
                      and fact “{stage.factCitations[0]?.label ?? "—"}”.
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            {roadmap.status === "pending_approval" ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <form action={action}>
                  <input type="hidden" name="roadmapId" value={roadmap.id} />
                  <input type="hidden" name="action" value="approve" />
                  <Button type="submit" disabled={pending}>
                    Approve plan
                  </Button>
                </form>
                <form action={action}>
                  <input type="hidden" name="roadmapId" value={roadmap.id} />
                  <input type="hidden" name="action" value="reject" />
                  <Button type="submit" variant="outline" disabled={pending}>
                    Request changes
                  </Button>
                </form>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
