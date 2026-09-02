"use client";

import { Button, buttonVariants } from "@paon/ui/components/Button";
import { cn } from "@paon/ui/lib/cn";
import Image from "next/image";
import Link from "next/link";
import { useActionState } from "react";

import {
  generateMorningRoutineSelection,
  runMorningRoutineAction,
  type MorningRoutineActionState,
} from "./actions";

import { startConversation } from "@/app/(dashboard)/messages/actions";

/**
 * FT-06 complete-look canvas. `pag1.html` was checked directly for a
 * composed-look widget and has none — only marketing narrative and a
 * decorative live-weather overlay — so this is built with PAON primitives
 * against the blueprint's own physical description ("a composed outfit,
 * weather/calendar/live context, complementary wardrobe pieces, missing/
 * purchasable piece and clear delivery timing") rather than a source port.
 * The prior implementation was a plain numbered `<ul>`; every Server
 * Action and data field here is unchanged, only the composition. "Buy"
 * creates a real order via the same `add_to_cart`/`checkout_cart` RPCs
 * one-tap-checkout uses, gated on the same saved default address — no
 * payment step. Falls back to linking the product page when no variant
 * is resolvable for one-tap creation.
 */

const initial: MorningRoutineActionState = { fieldErrors: {} };

type Recommendation = {
  id: string;
  rank: number;
  source: string;
  displayName: string;
  categoryCode?: string;
  imageUrl?: string;
  owned?: boolean;
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
};

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
    recommendations: readonly Recommendation[];
  } | null;
}

function RecommendationActions({
  recommendation,
  selectionId,
  retailerId,
  retailerSlug,
  actionAction,
  actionPending,
}: {
  recommendation: Recommendation;
  selectionId: string;
  retailerId: string;
  retailerSlug: string;
  actionAction: (payload: FormData) => void;
  actionPending: boolean;
}) {
  const save = recommendation.actions.find((action) => action.kind === "save");
  const review = recommendation.actions.find(
    (action) => action.kind === "review",
  );
  const book = recommendation.actions.find((action) => action.kind === "book");
  const buy = recommendation.actions.find((action) => action.kind === "buy");

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {save?.available ? (
        <form action={actionAction}>
          <input type="hidden" name="selectionId" value={selectionId} />
          <input
            type="hidden"
            name="recommendationId"
            value={recommendation.id}
          />
          <input type="hidden" name="action" value="save" />
          <input type="hidden" name="retailerId" value={retailerId} />
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
            className="rounded-[15px]"
          >
            Save
          </Button>
        </form>
      ) : null}
      {review?.available ? (
        <>
          <form action={actionAction}>
            <input type="hidden" name="selectionId" value={selectionId} />
            <input
              type="hidden"
              name="recommendationId"
              value={recommendation.id}
            />
            <input type="hidden" name="action" value="review" />
            <input type="hidden" name="retailerId" value={retailerId} />
            <Button
              type="submit"
              size="sm"
              variant="outline"
              disabled={actionPending}
              className="rounded-[15px]"
            >
              Mark reviewed
            </Button>
          </form>
          <form action={startConversation}>
            <input type="hidden" name="retailerId" value={retailerId} />
            <input
              type="hidden"
              name="body"
              value={`I'd like to review my MorningRoutine pick: ${recommendation.displayName}.`}
            />
            <button
              type="submit"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "rounded-[15px]",
              )}
            >
              Ask advisor
            </button>
          </form>
        </>
      ) : null}
      {book?.available && book.href ? (
        <Link
          href={book.href}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "rounded-[15px]",
          )}
        >
          Book
        </Link>
      ) : (
        <Link
          href={`/r/${retailerSlug}/appointments`}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "rounded-[15px]",
          )}
        >
          Book
        </Link>
      )}
      {buy?.available && buy.productVariantId ? (
        <form action={actionAction}>
          <input type="hidden" name="selectionId" value={selectionId} />
          <input
            type="hidden"
            name="recommendationId"
            value={recommendation.id}
          />
          <input type="hidden" name="action" value="buy" />
          <input type="hidden" name="retailerId" value={retailerId} />
          <input
            type="hidden"
            name="productVariantId"
            value={buy.productVariantId}
          />
          <Button
            type="submit"
            size="sm"
            disabled={actionPending}
            className="rounded-[15px]"
          >
            Buy
          </Button>
        </form>
      ) : buy?.available && buy.href ? (
        <Link
          href={buy.href}
          className={cn(buttonVariants({ size: "sm" }), "rounded-[15px]")}
        >
          Buy
        </Link>
      ) : null}
    </div>
  );
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

  const recommendations = view?.recommendations ?? [];
  // Prefer a suit or jacket as the featured look when one is available —
  // the founder's ask is "today's look", not an arbitrary category.
  const preferredIndex = recommendations.findIndex((rec) =>
    ["suit", "jacket"].includes(rec.categoryCode ?? ""),
  );
  const featuredIndex = preferredIndex >= 0 ? preferredIndex : 0;
  const featured = recommendations[featuredIndex];
  const rest = recommendations.filter((_, i) => i !== featuredIndex);

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
        <div className="flex flex-col gap-5 px-5 py-4">
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

          {!featured ? (
            <p role="status" className="text-sm text-[var(--color-stone-500)]">
              Nothing available to recommend from wardrobe or catalogue today.
            </p>
          ) : (
            <>
              <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-stone-200)]">
                <div className="relative aspect-[4/3] w-full bg-[var(--color-stone-100)] sm:aspect-[16/9]">
                  {featured.imageUrl ? (
                    <Image
                      src={featured.imageUrl}
                      alt=""
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center text-sm text-[var(--color-stone-400)]"
                      aria-hidden
                    >
                      No image yet
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent px-4 pb-3 pt-10">
                    <p className="text-xs uppercase tracking-[0.12em] text-white/80">
                      Today&rsquo;s look
                      {featured.owned ? " · From your wardrobe" : ""}
                    </p>
                    <p className="font-display text-2xl text-white">
                      {featured.displayName}
                    </p>
                  </div>
                </div>
                <div className="px-4 py-4">
                  <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--color-stone-600)]">
                    {featured.explanation.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  <RecommendationActions
                    recommendation={featured}
                    selectionId={view.selectionId}
                    retailerId={retailerId}
                    retailerSlug={retailerSlug}
                    actionAction={actionAction}
                    actionPending={actionPending}
                  />
                </div>
              </div>

              {rest.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-stone-500)]">
                    Complete the look
                  </p>
                  <ul className="flex snap-x gap-3 overflow-x-auto pb-1">
                    {rest.map((recommendation) => (
                      <li
                        key={recommendation.id}
                        className="w-48 flex-none snap-start overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-stone-200)]"
                      >
                        <div className="relative aspect-square w-full bg-[var(--color-stone-100)]">
                          {recommendation.imageUrl ? (
                            <Image
                              src={recommendation.imageUrl}
                              alt=""
                              fill
                              unoptimized
                              className="object-cover"
                            />
                          ) : (
                            <div
                              className="flex h-full w-full items-center justify-center text-xs text-[var(--color-stone-400)]"
                              aria-hidden
                            >
                              No image
                            </div>
                          )}
                          {!recommendation.owned ? (
                            <span className="absolute left-1.5 top-1.5 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--color-stone-700)]">
                              Add to complete
                            </span>
                          ) : null}
                        </div>
                        <div className="px-3 py-2">
                          <p className="text-sm font-medium text-[var(--color-stone-900)]">
                            {recommendation.displayName}
                          </p>
                          <p className="text-xs text-[var(--color-stone-500)]">
                            {recommendation.source}
                            {recommendation.categoryCode
                              ? ` · ${recommendation.categoryCode.replaceAll("_", " ")}`
                              : ""}
                          </p>
                          <RecommendationActions
                            recommendation={recommendation}
                            selectionId={view.selectionId}
                            retailerId={retailerId}
                            retailerSlug={retailerSlug}
                            actionAction={actionAction}
                            actionPending={actionPending}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </div>
      )}
    </section>
  );
}
