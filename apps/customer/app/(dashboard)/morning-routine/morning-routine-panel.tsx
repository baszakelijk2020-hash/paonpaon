"use client";

import type { MorningRoutineRecommendation } from "@paon/domain";
import { buttonVariants } from "@paon/ui/components/Button";
import Image from "next/image";
import Link from "next/link";
import { useActionState } from "react";

import {
  generateMorningRoutine,
  morningRoutineInitialState,
  saveMorningRoutineCatalogueItem,
  type MorningRoutineActionState,
} from "./actions";

export function MorningRoutinePanel({
  retailerId,
  customerId,
  slug,
  retailerName,
}: {
  retailerId: string;
  customerId: string;
  slug: string;
  retailerName: string;
}) {
  const boundAction = generateMorningRoutine.bind(
    null,
    retailerId,
    customerId,
    slug,
    undefined,
  );
  const [state, action, pending] = useActionState(
    boundAction,
    morningRoutineInitialState,
  );

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white shadow-[var(--shadow-lifted)]">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--color-stone-100)] px-6 py-5">
        <div>
          <p className="font-accent text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-stone-500)]">
            Morning routine
          </p>
          <p className="text-sm text-[var(--color-stone-500)]">
            What to wear today from {retailerName} — owned pieces first, with
            explained catalogue suggestions where useful.
          </p>
        </div>
        {!state.result ? (
          <form action={action}>
            <button
              type="submit"
              disabled={pending}
              className={buttonVariants({ size: "sm" })}
            >
              {pending ? "Preparing…" : "Plan my morning"}
            </button>
          </form>
        ) : (
          <form action={action}>
            <button
              type="submit"
              disabled={pending}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              {pending ? "Refreshing…" : "Refresh"}
            </button>
          </form>
        )}
      </div>

      {state.formError ? (
        <p
          role="alert"
          className="px-6 py-4 text-sm text-[var(--color-danger-500)]"
        >
          {state.formError}
        </p>
      ) : null}

      {state.result ? (
        <div className="flex flex-col gap-6 px-6 py-5">
          <ProvenancePanel state={state} />
          {state.result.recommendations.map((recommendation, index) => (
            <RecommendationCard
              key={`${recommendation.title}-${index}`}
              recommendation={recommendation}
              slug={slug}
              retailerId={retailerId}
            />
          ))}
        </div>
      ) : (
        <p className="px-6 py-5 text-sm text-[var(--color-stone-500)]">
          Weather, occasion, wardrobe, and consented preferences are optional.
          Every suggestion explains itself and offers save, review, book, or buy
          where valid.
        </p>
      )}
    </div>
  );
}

function ProvenancePanel({ state }: { state: MorningRoutineActionState }) {
  if (!state.result) return null;
  return (
    <div
      className="rounded-[var(--radius-md)] bg-[var(--color-stone-50)] px-4 py-3 text-sm text-[var(--color-stone-600)]"
      aria-label="Input provenance"
    >
      <p className="font-medium text-[var(--color-stone-800)]">
        How this was built
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {state.result.provenance.map((entry) => (
          <li key={`${entry.input}-${entry.detail}`}>
            {entry.detail}
            {entry.used ? "" : " (not used)"}
          </li>
        ))}
      </ul>
    </div>
  );
}

function RecommendationCard({
  recommendation,
  slug,
  retailerId,
}: {
  recommendation: MorningRoutineRecommendation;
  slug: string;
  retailerId: string;
}) {
  return (
    <article className="rounded-[var(--radius-md)] border border-[var(--color-stone-100)] p-5">
      <h2 className="font-display text-2xl text-[var(--color-stone-900)]">
        {recommendation.title}
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--color-stone-600)]">
        {recommendation.summary}
      </p>
      <ul className="mt-3 space-y-1 text-sm text-[var(--color-stone-500)]">
        {recommendation.factors.slice(0, 4).map((factor) => (
          <li key={`${factor.code}-${factor.detail}`}>• {factor.detail}</li>
        ))}
      </ul>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {recommendation.items.map((item) => (
          <div
            key={
              item.candidate.kind === "owned_wardrobe"
                ? item.candidate.wardrobeItemId
                : `${item.candidate.productId}:${item.candidate.productVariantId}`
            }
            className="rounded-[var(--radius-md)] bg-[#f4f1ec] p-4"
          >
            {item.candidate.imageUrl ? (
              <div className="relative mb-3 aspect-[4/5] overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-stone-100)]">
                <Image
                  src={item.candidate.imageUrl}
                  alt={item.candidate.label}
                  fill
                  unoptimized
                  className="object-cover"
                />
              </div>
            ) : null}
            <p className="text-xs uppercase tracking-[0.12em] text-[var(--color-stone-500)]">
              {item.candidate.kind === "owned_wardrobe" ? "Owned" : "Catalogue"}{" "}
              · {item.candidate.slotKind.replace("_", " ")}
            </p>
            <p className="font-display mt-1 text-lg text-[var(--color-stone-900)]">
              {item.candidate.label}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {item.actions.map((actionItem) => {
                if (actionItem.kind === "save") {
                  return (
                    <form key="save" action={saveMorningRoutineCatalogueItem}>
                      <input
                        type="hidden"
                        name="retailerId"
                        value={retailerId}
                      />
                      <input
                        type="hidden"
                        name="productVariantId"
                        value={
                          item.candidate.kind === "catalogue_product"
                            ? item.candidate.productVariantId
                            : ""
                        }
                      />
                      <button
                        type="submit"
                        disabled={!actionItem.enabled}
                        title={actionItem.reason}
                        className={buttonVariants({
                          variant: "outline",
                          size: "sm",
                        })}
                      >
                        {actionItem.label}
                      </button>
                    </form>
                  );
                }
                if (!actionItem.href || !actionItem.enabled) {
                  return (
                    <span
                      key={actionItem.kind}
                      className="text-xs text-[var(--color-stone-400)]"
                      title={actionItem.reason}
                    >
                      {actionItem.label} unavailable
                    </span>
                  );
                }
                return (
                  <Link
                    key={actionItem.kind}
                    href={actionItem.href}
                    className={buttonVariants({
                      variant:
                        actionItem.kind === "buy" ? "primary" : "outline",
                      size: "sm",
                    })}
                  >
                    {actionItem.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <Link
          href={`/r/${slug}`}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          Review in {slug.replace(/-/g, " ")} →
        </Link>
      </div>
    </article>
  );
}
