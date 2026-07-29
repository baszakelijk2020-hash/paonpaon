"use client";

import {
  OUTFIT_SLOT_KINDS,
  type Outfit,
  type WardrobeRoadmap,
} from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { useActionState } from "react";

import {
  addWardrobeGap,
  addWardrobeRoadmapGoal,
  createAdvisorOutfit,
  createWardrobeRoadmap,
  transitionOutfitStatus,
  transitionWardrobeRoadmapStatus,
  type RoadmapActionState,
} from "./wardrobe-roadmap-actions";

function statusLabel(status: string): string {
  return status.replaceAll("_", " ");
}

export function CustomerRoadmapCard({
  customerId,
  roadmaps,
  outfits,
  stylingRules,
}: {
  customerId: string;
  roadmaps: readonly WardrobeRoadmap[];
  outfits: readonly Outfit[];
  stylingRules: readonly { id: string; title: string }[];
}) {
  const initialState: RoadmapActionState = { fieldErrors: {} };
  const [createState, createAction, createPending] = useActionState(
    createWardrobeRoadmap,
    initialState,
  );
  const [goalState, goalAction, goalPending] = useActionState(
    addWardrobeRoadmapGoal,
    initialState,
  );
  const [gapState, gapAction, gapPending] = useActionState(
    addWardrobeGap,
    initialState,
  );
  const [statusState, statusAction, statusPending] = useActionState(
    transitionWardrobeRoadmapStatus,
    initialState,
  );
  const [outfitState, outfitAction, outfitPending] = useActionState(
    createAdvisorOutfit,
    initialState,
  );
  const [outfitApproveState, outfitApproveAction, outfitApprovePending] =
    useActionState(transitionOutfitStatus, initialState);

  const activeRoadmap = roadmaps[0];

  return (
    <Card id="roadmap" className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          Wardrobe Roadmap
        </h2>
        <p className="text-sm text-[var(--color-stone-500)]">
          Author goals, ranked gaps, staged priorities, and complete looks.
          Every suggestion cites approved styling rules and owned or catalogue
          facts.
        </p>
      </div>

      {!activeRoadmap ? (
        <form action={createAction} className="flex flex-col gap-3">
          <input type="hidden" name="customerId" value={customerId} />
          <label className="flex flex-col gap-1 text-sm">
            Plan title
            <input
              name="title"
              required
              className="rounded border border-[var(--color-stone-200)] px-3 py-2"
              placeholder="Three-year wardrobe plan"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Horizon
            <input
              name="horizonLabel"
              className="rounded border border-[var(--color-stone-200)] px-3 py-2"
              placeholder="3 years"
            />
          </label>
          {createState.formError ? (
            <p className="text-sm text-red-700" role="alert">
              {createState.formError}
            </p>
          ) : null}
          <Button type="submit" disabled={createPending}>
            Create roadmap
          </Button>
        </form>
      ) : (
        <>
          <div className="rounded border border-[var(--color-stone-200)] p-3">
            <p className="font-medium text-[var(--color-stone-900)]">
              {activeRoadmap.title}
            </p>
            <p className="text-sm text-[var(--color-stone-500)]">
              Status: {statusLabel(activeRoadmap.status)}
              {activeRoadmap.horizonLabel
                ? ` · ${activeRoadmap.horizonLabel}`
                : ""}
            </p>
            {activeRoadmap.summary ? (
              <p className="mt-2 text-sm text-[var(--color-stone-700)]">
                {activeRoadmap.summary}
              </p>
            ) : null}
          </div>

          {activeRoadmap.goals.length > 0 ? (
            <div>
              <h3 className="text-sm font-medium text-[var(--color-stone-900)]">
                Goals
              </h3>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                {activeRoadmap.goals.map((goal) => (
                  <li key={goal.id}>{goal.title}</li>
                ))}
              </ol>
            </div>
          ) : null}

          {activeRoadmap.gaps.length > 0 ? (
            <div>
              <h3 className="text-sm font-medium text-[var(--color-stone-900)]">
                Ranked gaps
              </h3>
              <ul className="mt-2 space-y-2 text-sm">
                {activeRoadmap.gaps.map((gap) => (
                  <li
                    key={gap.id}
                    className="rounded border border-[var(--color-stone-100)] px-3 py-2"
                  >
                    <span className="font-medium">{gap.title}</span>
                    <span className="text-[var(--color-stone-500)]">
                      {" "}
                      · {gap.slotKind.replace("_", " ")} · stage{" "}
                      {gap.stagePriority}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <form action={goalAction} className="grid gap-2 sm:grid-cols-3">
            <input type="hidden" name="customerId" value={customerId} />
            <input type="hidden" name="roadmapId" value={activeRoadmap.id} />
            <input
              name="title"
              required
              placeholder="Goal title"
              className="rounded border border-[var(--color-stone-200)] px-3 py-2 text-sm sm:col-span-2"
            />
            <input
              name="rank"
              type="number"
              min={1}
              max={99}
              defaultValue={activeRoadmap.goals.length + 1}
              className="rounded border border-[var(--color-stone-200)] px-3 py-2 text-sm"
            />
            <Button type="submit" size="sm" disabled={goalPending}>
              Add goal
            </Button>
          </form>
          {goalState.formError ? (
            <p className="text-sm text-red-700" role="alert">
              {goalState.formError}
            </p>
          ) : null}

          <form action={gapAction} className="grid gap-2 sm:grid-cols-2">
            <input type="hidden" name="customerId" value={customerId} />
            <input type="hidden" name="roadmapId" value={activeRoadmap.id} />
            <input
              name="title"
              required
              placeholder="Gap title"
              className="rounded border border-[var(--color-stone-200)] px-3 py-2 text-sm"
            />
            <select
              name="slotKind"
              className="rounded border border-[var(--color-stone-200)] px-3 py-2 text-sm"
              defaultValue="jacket"
            >
              {OUTFIT_SLOT_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {kind.replace("_", " ")}
                </option>
              ))}
            </select>
            <input
              name="rank"
              type="number"
              min={1}
              max={99}
              defaultValue={activeRoadmap.gaps.length + 1}
              className="rounded border border-[var(--color-stone-200)] px-3 py-2 text-sm"
            />
            <input
              name="stagePriority"
              type="number"
              min={1}
              max={5}
              defaultValue={1}
              className="rounded border border-[var(--color-stone-200)] px-3 py-2 text-sm"
            />
            {stylingRules[0] ? (
              <input
                type="hidden"
                name="knowledgeObjectId"
                value={stylingRules[0].id}
              />
            ) : null}
            <Button type="submit" size="sm" disabled={gapPending}>
              Add ranked gap
            </Button>
          </form>
          {gapState.formError ? (
            <p className="text-sm text-red-700" role="alert">
              {gapState.formError}
            </p>
          ) : null}

          <form action={statusAction} className="flex flex-wrap gap-2">
            <input type="hidden" name="customerId" value={customerId} />
            <input type="hidden" name="roadmapId" value={activeRoadmap.id} />
            {activeRoadmap.status === "draft" ? (
              <Button
                type="submit"
                name="status"
                value="proposed"
                size="sm"
                variant="outline"
                disabled={statusPending}
              >
                Propose to customer
              </Button>
            ) : null}
            {activeRoadmap.status === "proposed" ? (
              <Button
                type="submit"
                name="status"
                value="approved"
                size="sm"
                disabled={statusPending}
              >
                Approve plan
              </Button>
            ) : null}
          </form>
          {statusState.formError ? (
            <p className="text-sm text-red-700" role="alert">
              {statusState.formError}
            </p>
          ) : null}

          <div>
            <h3 className="text-sm font-medium text-[var(--color-stone-900)]">
              Complete looks
            </h3>
            {outfits.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--color-stone-500)]">
                No outfits yet.
              </p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {outfits.map((outfit) => (
                  <li
                    key={outfit.id}
                    className="rounded border border-[var(--color-stone-100)] px-3 py-2"
                  >
                    <span className="font-medium">{outfit.title}</span>
                    <span className="text-[var(--color-stone-500)]">
                      {" "}
                      · {statusLabel(outfit.status)} · {outfit.slots.length}{" "}
                      slots
                    </span>
                    {outfit.ruleCitations.length > 0 ? (
                      <p className="mt-1 text-xs text-[var(--color-stone-500)]">
                        Rule: {outfit.ruleCitations[0]?.explanation}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <form action={outfitAction} className="flex flex-col gap-2">
            <input type="hidden" name="customerId" value={customerId} />
            <input type="hidden" name="roadmapId" value={activeRoadmap.id} />
            <input type="hidden" name="title" value="Complete look draft" />
            <input
              type="hidden"
              name="occasionLabel"
              value="Business weekday"
            />
            <input
              type="hidden"
              name="slotsJson"
              value={JSON.stringify([
                {
                  slotKind: "jacket",
                  displayLabel: "Navy jacket",
                },
                {
                  slotKind: "trousers",
                  displayLabel: "Grey trousers",
                },
                {
                  slotKind: "shirt",
                  displayLabel: "White shirt",
                },
                {
                  slotKind: "shoes",
                  displayLabel: "Brown loafers",
                },
              ])}
            />
            <input
              type="hidden"
              name="knowledgeObjectIdsJson"
              value={JSON.stringify(
                stylingRules[0] ? [stylingRules[0].id] : [],
              )}
            />
            <Button
              type="submit"
              size="sm"
              variant="outline"
              disabled={outfitPending}
            >
              Add sample complete look
            </Button>
          </form>
          {outfitState.formError ? (
            <p className="text-sm text-red-700" role="alert">
              {outfitState.formError}
            </p>
          ) : null}

          {outfits.some((outfit) => outfit.status === "draft") ? (
            <form action={outfitApproveAction}>
              <input type="hidden" name="customerId" value={customerId} />
              <input
                type="hidden"
                name="outfitId"
                value={outfits.find((o) => o.status === "draft")?.id ?? ""}
              />
              <Button
                type="submit"
                name="status"
                value="approved"
                size="sm"
                disabled={outfitApprovePending}
              >
                Approve draft outfit
              </Button>
            </form>
          ) : null}
          {outfitApproveState.formError ? (
            <p className="text-sm text-red-700" role="alert">
              {outfitApproveState.formError}
            </p>
          ) : null}
        </>
      )}
    </Card>
  );
}
