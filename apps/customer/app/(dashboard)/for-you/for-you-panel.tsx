"use client";

import { Button, buttonVariants } from "@paon/ui/components/Button";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useTransition } from "react";

import {
  dismissForYouRecommendation,
  recordForYouClick,
  recordForYouImpression,
  saveForYouRecommendation,
} from "./actions";

export interface ForYouPanelProps {
  readonly retailerId: string;
  readonly retailerName: string;
  readonly retailerSlug: string;
  readonly customerId: string;
  readonly visibility: string;
  readonly signalsUsed: readonly string[];
  readonly recommendations: readonly {
    readonly rank: number;
    readonly productId: string;
    readonly productVariantId?: string;
    readonly displayName: string;
    readonly productSlug: string;
    readonly primaryImageUrl?: string;
    readonly statement: string;
    readonly factors: readonly {
      readonly code: string;
      readonly detail: string;
    }[];
  }[];
}

export function ForYouPanel({
  retailerId,
  retailerName,
  retailerSlug,
  customerId,
  visibility,
  signalsUsed,
  recommendations,
}: ForYouPanelProps) {
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    for (const recommendation of recommendations) {
      void recordForYouImpression({
        retailerId,
        customerId,
        productId: recommendation.productId,
        rank: recommendation.rank,
      });
    }
  }, [recommendations, retailerId, customerId]);

  const consentBlocked =
    visibility === "consent_denied" ||
    visibility === "consent_withdrawn" ||
    visibility === "consent_missing";

  return (
    <section
      className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white"
      aria-labelledby={`for-you-${retailerId}`}
    >
      <div className="border-b border-[var(--color-stone-100)] px-5 py-4">
        <p className="font-accent text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-stone-500)]">
          {retailerName}
        </p>
        <h2
          id={`for-you-${retailerId}`}
          className="font-display text-xl text-[var(--color-stone-900)]"
        >
          For you
        </h2>
        <p className="mt-1 text-sm text-[var(--color-stone-500)]">
          Deterministic picks from your style, wardrobe gaps, saved pieces, and
          recent browsing — every card explains why it appears.
        </p>
        {signalsUsed.length > 0 ? (
          <p className="mt-2 text-xs text-[var(--color-stone-500)]">
            Signals used: {signalsUsed.join(", ").replaceAll("_", " ")}.
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-4 p-5">
        {consentBlocked ? (
          <div
            className="rounded-[var(--radius-sm)] border border-dashed border-[var(--color-stone-300)] px-4 py-8 text-center"
            role="status"
          >
            <p className="text-sm text-[var(--color-stone-600)]">
              Enable personalization in{" "}
              <Link href="/account" className="underline">
                Settings
              </Link>{" "}
              to see tailored recommendations from {retailerName}.
            </p>
          </div>
        ) : recommendations.length === 0 ? (
          <div
            className="rounded-[var(--radius-sm)] border border-dashed border-[var(--color-stone-300)] px-4 py-8 text-center"
            role="status"
          >
            <p className="text-sm text-[var(--color-stone-600)]">
              Nothing to suggest right now — browse the house catalogue or
              update your wardrobe roadmap with your advisor.
            </p>
          </div>
        ) : (
          recommendations.map((recommendation) => {
            const productHref = `/r/${retailerSlug}/products/${recommendation.productSlug}?legacy=1`;
            return (
              <article
                key={recommendation.productId}
                className="flex flex-col gap-3 rounded-[var(--radius-sm)] border border-[var(--color-stone-100)] p-4 sm:flex-row"
              >
                {recommendation.primaryImageUrl ? (
                  <div className="relative h-36 w-full shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-[var(--color-stone-100)] sm:h-28 sm:w-28">
                    <Image
                      src={recommendation.primaryImageUrl}
                      alt={recommendation.displayName}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div
                    className="flex h-36 w-full shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-stone-100)] text-xs text-[var(--color-stone-500)] sm:h-28 sm:w-28"
                    aria-hidden
                  >
                    No image
                  </div>
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div>
                    <p className="font-display text-lg text-[var(--color-stone-900)]">
                      {recommendation.displayName}
                    </p>
                    <p className="text-sm text-[var(--color-stone-600)]">
                      {recommendation.statement}
                    </p>
                  </div>
                  <ul className="flex flex-wrap gap-2 text-xs text-[var(--color-stone-500)]">
                    {recommendation.factors
                      .filter((factor) => factor.code !== "consent_fallback")
                      .slice(0, 3)
                      .map((factor) => (
                        <li
                          key={`${recommendation.productId}-${factor.code}`}
                          className="rounded-full border border-[var(--color-stone-200)] px-2 py-0.5"
                        >
                          {factor.detail}
                        </li>
                      ))}
                  </ul>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Link
                      href={productHref}
                      className={buttonVariants({ size: "sm" })}
                      onClick={() => {
                        void recordForYouClick({
                          retailerId,
                          customerId,
                          productId: recommendation.productId,
                          productSlug: recommendation.productSlug,
                        });
                      }}
                    >
                      View piece
                    </Link>
                    {recommendation.productVariantId ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={pending}
                        onClick={() => {
                          startTransition(async () => {
                            await saveForYouRecommendation({
                              retailerId,
                              productVariantId:
                                recommendation.productVariantId!,
                            });
                          });
                        }}
                      >
                        Save
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => {
                        startTransition(async () => {
                          await dismissForYouRecommendation({
                            retailerId,
                            customerId,
                            productId: recommendation.productId,
                          });
                        });
                      }}
                    >
                      Not for me
                    </Button>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
