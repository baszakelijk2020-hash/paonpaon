"use client";

import { Button, buttonVariants } from "@paon/ui/components/Button";
import Link from "next/link";
import { useActionState } from "react";

import {
  generateMorningRoutineSelection,
  runMorningRoutineAction,
  type MorningRoutineActionState,
} from "./actions";

import { startConversation } from "@/app/(dashboard)/messages/actions";

const initial: MorningRoutineActionState = { fieldErrors: {} };

export interface MorningRoutinePanelProps {
  retailerId: string;
  retailerName: string;
  retailerSlug: string;
  customerId: string;
  forDate: string;
  view: {
    selectionId: string;
    summary: string;
    reviewStatus: string;
    provenance: {
      personalizationStatus: string;
      locationStatus: string;
      weatherStatus: string;
      weatherSummary?: string;
      calendarStatus: string;
      occasionLabels: readonly string[];
      locationLabel?: string;
    };
    recommendations: readonly {
      id: string;
      rank: number;
      source: string;
      displayName: string;
      categoryCode?: string;
      explanation: readonly string[];
      actions: readonly {
        kind: string;
        available: boolean;
        reason?: string;
        href?: string;
        productVariantId?: string;
        productId?: string;
        wardrobeItemId?: string;
      }[];
    }[];
  } | null;
}

export function MorningRoutinePanel({
  retailerId,
  retailerName,
  retailerSlug,
  customerId,
  forDate,
  view,
}: MorningRoutinePanelProps) {
  const [generateState, generateAction, generatePending] = useActionState(
    generateMorningRoutineSelection,
    initial,
  );
  const [actionState, actionAction, actionPending] = useActionState(
    runMorningRoutineAction,
    initial,
  );

  return (
    <section
      className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white"
      aria-labelledby={`morning-routine-${retailerId}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-stone-100)] px-5 py-4">
        <div>
          <p className="font-accent text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-stone-500)]">
            MorningRoutine
          </p>
          <h2
            id={`morning-routine-${retailerId}`}
            className="font-display text-xl text-[var(--color-stone-900)]"
          >
            {retailerName}
          </h2>
          <p className="mt-1 text-sm text-[var(--color-stone-500)]">
            Owned pieces first, then catalogue — with a clear why for every
            pick. For {forDate}.
          </p>
        </div>
        <form action={generateAction}>
          <input type="hidden" name="retailerId" value={retailerId} />
          <input type="hidden" name="customerId" value={customerId} />
          <input type="hidden" name="forDate" value={forDate} />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={generatePending}
          >
            {generatePending
              ? "Selecting…"
              : view
                ? "Refresh today"
                : "Select today"}
          </Button>
        </form>
      </div>

      {generateState.formError ? (
        <p
          role="alert"
          className="px-5 py-3 text-sm text-[var(--color-danger-500)]"
        >
          {generateState.formError}
        </p>
      ) : null}
      {actionState.formError ? (
        <p
          role="alert"
          className="px-5 py-3 text-sm text-[var(--color-danger-500)]"
        >
          {actionState.formError}
        </p>
      ) : null}

      {!view ? (
        <div
          className="px-5 py-10 text-center text-sm text-[var(--color-stone-500)]"
          role="status"
        >
          No routine for today yet. Select one to see owned-first
          recommendations with save, review, book, and buy where valid.
        </div>
      ) : (
        <div className="flex flex-col gap-4 px-5 py-4">
          <div className="rounded-[var(--radius-sm)] bg-[var(--color-stone-50)] px-4 py-3 text-sm text-[var(--color-stone-700)]">
            <p>{view.summary}</p>
            <dl className="mt-3 grid gap-1 text-xs text-[var(--color-stone-500)] sm:grid-cols-2">
              <div>
                <dt className="inline font-medium">Personalization: </dt>
                <dd className="inline">
                  {view.provenance.personalizationStatus.replaceAll("_", " ")}
                </dd>
              </div>
              <div>
                <dt className="inline font-medium">Location: </dt>
                <dd className="inline">
                  {view.provenance.locationStatus.replaceAll("_", " ")}
                  {view.provenance.locationLabel
                    ? ` (${view.provenance.locationLabel})`
                    : ""}
                </dd>
              </div>
              <div>
                <dt className="inline font-medium">Weather: </dt>
                <dd className="inline">
                  {view.provenance.weatherSummary ??
                    view.provenance.weatherStatus.replaceAll("_", " ")}
                </dd>
              </div>
              <div>
                <dt className="inline font-medium">Calendar: </dt>
                <dd className="inline">
                  {view.provenance.occasionLabels.length > 0
                    ? view.provenance.occasionLabels.join(", ")
                    : view.provenance.calendarStatus.replaceAll("_", " ")}
                </dd>
              </div>
              <div>
                <dt className="inline font-medium">Review: </dt>
                <dd className="inline">{view.reviewStatus}</dd>
              </div>
            </dl>
          </div>

          {view.recommendations.length === 0 ? (
            <p role="status" className="text-sm text-[var(--color-stone-500)]">
              Nothing available to recommend from wardrobe or catalogue today.
            </p>
          ) : (
            <ul className="flex flex-col gap-4">
              {view.recommendations.map((recommendation) => {
                const save = recommendation.actions.find(
                  (action) => action.kind === "save",
                );
                const review = recommendation.actions.find(
                  (action) => action.kind === "review",
                );
                const book = recommendation.actions.find(
                  (action) => action.kind === "book",
                );
                const buy = recommendation.actions.find(
                  (action) => action.kind === "buy",
                );
                return (
                  <li
                    key={recommendation.id}
                    className="border-t border-[var(--color-stone-100)] pt-4 first:border-t-0 first:pt-0"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-display text-lg text-[var(--color-stone-900)]">
                        {recommendation.rank}. {recommendation.displayName}
                      </p>
                      <p className="text-xs uppercase tracking-[0.12em] text-[var(--color-stone-500)]">
                        {recommendation.source}
                        {recommendation.categoryCode
                          ? ` · ${recommendation.categoryCode.replaceAll("_", " ")}`
                          : ""}
                      </p>
                    </div>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--color-stone-600)]">
                      {recommendation.explanation.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {save?.available ? (
                        <form action={actionAction}>
                          <input
                            type="hidden"
                            name="selectionId"
                            value={view.selectionId}
                          />
                          <input
                            type="hidden"
                            name="recommendationId"
                            value={recommendation.id}
                          />
                          <input type="hidden" name="action" value="save" />
                          <input
                            type="hidden"
                            name="retailerId"
                            value={retailerId}
                          />
                          {save.productVariantId ? (
                            <input
                              type="hidden"
                              name="productVariantId"
                              value={save.productVariantId}
                            />
                          ) : null}
                          <Button
                            type="submit"
                            size="sm"
                            variant="outline"
                            disabled={actionPending}
                          >
                            Save
                          </Button>
                        </form>
                      ) : null}
                      {review?.available ? (
                        <>
                          <form action={actionAction}>
                            <input
                              type="hidden"
                              name="selectionId"
                              value={view.selectionId}
                            />
                            <input
                              type="hidden"
                              name="recommendationId"
                              value={recommendation.id}
                            />
                            <input type="hidden" name="action" value="review" />
                            <input
                              type="hidden"
                              name="retailerId"
                              value={retailerId}
                            />
                            <Button
                              type="submit"
                              size="sm"
                              variant="outline"
                              disabled={actionPending}
                            >
                              Mark reviewed
                            </Button>
                          </form>
                          <form action={startConversation}>
                            <input
                              type="hidden"
                              name="retailerId"
                              value={retailerId}
                            />
                            <input
                              type="hidden"
                              name="body"
                              value={`I'd like to review my MorningRoutine pick: ${recommendation.displayName}.`}
                            />
                            <button
                              type="submit"
                              className={buttonVariants({
                                variant: "outline",
                                size: "sm",
                              })}
                            >
                              Ask advisor
                            </button>
                          </form>
                        </>
                      ) : null}
                      {book?.available && book.href ? (
                        <Link
                          href={book.href}
                          className={buttonVariants({
                            variant: "outline",
                            size: "sm",
                          })}
                        >
                          Book
                        </Link>
                      ) : (
                        <Link
                          href={`/r/${retailerSlug}/appointments`}
                          className={buttonVariants({
                            variant: "outline",
                            size: "sm",
                          })}
                        >
                          Book
                        </Link>
                      )}
                      {buy?.available && buy.href ? (
                        <Link
                          href={buy.href}
                          className={buttonVariants({ size: "sm" })}
                        >
                          Buy
                        </Link>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
