"use client";

import { OUTFIT_SLOT_KINDS, type WardrobeRoadmap } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { useActionState } from "react";

import {
  createCustomerWardrobeRoadmap,
  type RoadmapActionState,
} from "./roadmap-actions";

export function CustomerRoadmapCard({
  customerId,
  roadmaps,
  catalogueProducts,
  canManage,
}: {
  customerId: string;
  roadmaps: readonly WardrobeRoadmap[];
  catalogueProducts: readonly { id: string; name: string }[];
  canManage: boolean;
}) {
  const initialState: RoadmapActionState = { fieldErrors: {} };
  const [state, action, pending] = useActionState(
    createCustomerWardrobeRoadmap,
    initialState,
  );

  return (
    <Card id="wardrobe-roadmap" className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          Wardrobe roadmap
        </h2>
        <p className="text-sm text-[var(--color-stone-500)]">
          Advisor-authored goals, ranked gaps, and staged priorities. Every
          suggestion cites an approved sartorial rule and catalogue or owned
          facts. The client approves the plan in their wardrobe.
        </p>
      </div>

      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="text-sm text-[var(--color-success-500)]">
          Roadmap submitted for client approval.
        </p>
      ) : null}

      {roadmaps.length === 0 ? (
        <div
          className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-stone-300)] px-4 py-8 text-center"
          role="status"
        >
          <p className="text-sm font-medium text-[var(--color-stone-900)]">
            No roadmap yet
          </p>
          <p className="mt-2 text-sm text-[var(--color-stone-500)]">
            Author a goal, ranked gap, and staged suggestion when the catalogue
            has a product to cite.
          </p>
        </div>
      ) : (
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
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-[var(--color-stone-700)]">
                {roadmap.gaps.map((gap) => (
                  <li key={gap.id}>
                    <span className="font-medium">#{gap.rank}</span> {gap.title}
                    {gap.howPurchaseFillsGap ? (
                      <span className="block text-xs text-[var(--color-stone-500)]">
                        {gap.howPurchaseFillsGap}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>
              <ul className="mt-3 space-y-2 text-sm text-[var(--color-stone-700)]">
                {roadmap.stages.map((stage) => (
                  <li key={stage.id}>
                    <p className="font-medium">{stage.title}</p>
                    <p className="text-xs text-[var(--color-stone-500)]">
                      {stage.explanation}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-stone-500)]">
                      Rule: {stage.ruleCitations[0]?.ruleTitle ?? "—"} · Fact:{" "}
                      {stage.factCitations[0]?.label ?? "—"}
                    </p>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {canManage ? (
        <form
          action={action}
          className="flex flex-col gap-3 border-t border-[var(--color-stone-100)] pt-4"
        >
          <input type="hidden" name="customerId" value={customerId} />
          <p className="text-sm font-medium text-[var(--color-stone-900)]">
            Author and submit a plan
          </p>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--color-stone-600)]">Title</span>
            <input
              name="title"
              required
              maxLength={200}
              className="rounded-[var(--radius-md)] border border-[var(--color-stone-300)] px-3 py-2"
              defaultValue="Wardrobe roadmap"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--color-stone-600)]">Goal</span>
            <input
              name="goalTitle"
              required
              maxLength={200}
              className="rounded-[var(--radius-md)] border border-[var(--color-stone-300)] px-3 py-2"
              defaultValue="Build a stronger wardrobe core"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--color-stone-600)]">Ranked gap</span>
            <input
              name="gapTitle"
              required
              maxLength={200}
              className="rounded-[var(--radius-md)] border border-[var(--color-stone-300)] px-3 py-2"
              placeholder="Missing navy jacket"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--color-stone-600)]">Gap slot</span>
            <select
              name="gapSlotKind"
              className="rounded-[var(--radius-md)] border border-[var(--color-stone-300)] px-3 py-2"
              defaultValue="jacket"
            >
              {OUTFIT_SLOT_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {kind.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--color-stone-600)]">
              How purchase fills the gap
            </span>
            <input
              name="howPurchaseFillsGap"
              maxLength={1000}
              className="rounded-[var(--radius-md)] border border-[var(--color-stone-300)] px-3 py-2"
              placeholder="Anchors weekday and travel looks."
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--color-stone-600)]">
              Suggested catalogue product
            </span>
            <select
              name="suggestedProductId"
              required
              className="rounded-[var(--radius-md)] border border-[var(--color-stone-300)] px-3 py-2"
              disabled={catalogueProducts.length === 0}
            >
              {catalogueProducts.length === 0 ? (
                <option value="">No products available</option>
              ) : (
                catalogueProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))
              )}
            </select>
          </label>
          {Object.keys(state.fieldErrors).length > 0 ? (
            <p role="alert" className="text-sm text-[var(--color-danger-500)]">
              {Object.values(state.fieldErrors)[0]}
            </p>
          ) : null}
          <Button
            type="submit"
            disabled={pending || catalogueProducts.length === 0}
          >
            {pending ? "Submitting…" : "Submit for client approval"}
          </Button>
        </form>
      ) : null}
    </Card>
  );
}
