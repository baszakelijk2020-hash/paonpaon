import { buttonVariants } from "@paon/ui/components/Button";
import Image from "next/image";
import Link from "next/link";

import { saveMorningRoutinePick } from "../morning-routine/actions";

import { MorningRoutineClock } from "./morning-routine-clock";
import { oneTapBuy } from "./one-tap-actions";
import {
  OneTapCheckoutBanner,
  OneTapCheckoutEnabledBadge,
} from "./one-tap-checkout-banner";

export interface HeroPiece {
  readonly id: string;
  readonly displayName: string;
  readonly imageUrl?: string;
  readonly owned?: boolean;
  readonly priceLabel?: string;
  readonly buyHref?: string;
  readonly productVariantId?: string;
  readonly saveVariantId?: string;
}

export interface MorningRoutineDashboardHeroProps {
  retailerId: string;
  retailerSlug: string;
  retailerName: string;
  customerFirstName: string;
  selectionId: string;
  weatherSummary?: string;
  nextAppointmentHref?: string;
  oneTapEligible: boolean;
  featured: HeroPiece;
  pieces: readonly HeroPiece[];
}

function BuyButton({
  retailerId,
  piece,
  oneTapEligible,
}: {
  retailerId: string;
  piece: HeroPiece;
  oneTapEligible: boolean;
}) {
  if (!piece.buyHref) return null;
  if (oneTapEligible && piece.productVariantId) {
    const boundBuy = oneTapBuy.bind(null, retailerId, piece.productVariantId);
    return (
      <form action={boundBuy}>
        <button type="submit" className={buttonVariants({ size: "sm" })}>
          Buy now
        </button>
      </form>
    );
  }
  return (
    <Link href={piece.buyHref} className={buttonVariants({ size: "sm" })}>
      Buy
    </Link>
  );
}

/**
 * The real MorningRoutine engine, surfaced at the top of the dashboard
 * instead of buried on its own page behind a manual "Select today" button
 * — pag1.html's own composed-look widget (anchor id="morning", live
 * OpenWeatherMap fetch, "Hi {name}, with {temp}°C ... today calls for
 * something special") is a personalized daily hero, not a page you have to
 * remember to visit. Same selection/action data as `/morning-routine`.
 * "Buy" is one-tap once a default address is on file (`oneTapEligible`) —
 * real payment collection stays gated on a processor decision that hasn't
 * been made; the storefront checkout has never captured payment at all,
 * it only ever created a `pending_payment` order, so one-tap buy changes
 * how many manual steps reach that same state, not what state it reaches.
 */
export function MorningRoutineDashboardHero({
  retailerId,
  retailerSlug,
  retailerName,
  customerFirstName,
  selectionId,
  weatherSummary,
  nextAppointmentHref,
  oneTapEligible,
  featured,
  pieces,
}: MorningRoutineDashboardHeroProps) {
  return (
    <section className="paon-reveal relative isolate overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-stone-900)] text-white shadow-[var(--shadow-elevated)]">
      {featured.imageUrl ? (
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-20 bg-cover bg-[center_30%] opacity-55"
          style={{ backgroundImage: `url(${featured.imageUrl})` }}
        />
      ) : null}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-r from-black/90 via-black/55 to-black/10"
      />
      <div className="flex flex-col gap-6 p-5 sm:p-10">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-[0.18em] text-white/70">
          <span>{retailerName} · MorningRoutine</span>
          <span className="flex items-center gap-2">
            {weatherSummary ? <span>{weatherSummary}</span> : null}
            <MorningRoutineClock />
          </span>
        </div>

        <div className="max-w-2xl">
          <p className="mb-3 text-sm text-white/70">
            Hi {customerFirstName}
            {weatherSummary ? `, with ${weatherSummary}` : ""} — today calls for
            something special.
          </p>
          <h1 className="font-display text-3xl leading-[0.97] sm:text-5xl">
            {featured.displayName}
          </h1>
          <p className="mt-2 text-xs uppercase tracking-[0.14em] text-white/60">
            {featured.owned ? "From your wardrobe" : "Today's look"}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            {nextAppointmentHref ? (
              <Link
                href={nextAppointmentHref}
                className={buttonVariants({ variant: "secondary", size: "lg" })}
              >
                View next appointment
              </Link>
            ) : (
              <Link
                href={`/r/${retailerSlug}`}
                className={buttonVariants({ variant: "secondary", size: "lg" })}
              >
                Request an appointment
              </Link>
            )}
            <Link
              href="/messages"
              className={buttonVariants({
                variant: "outline",
                size: "lg",
                className: "border-white/35 text-white hover:bg-white/10",
              })}
            >
              Message your advisor
            </Link>
          </div>
        </div>

        <div className="rounded-[var(--radius-md)] bg-white/95 p-4 text-[var(--color-stone-900)] sm:p-5">
          <div className="mb-4">
            {oneTapEligible ? (
              <OneTapCheckoutEnabledBadge />
            ) : (
              <OneTapCheckoutBanner retailerId={retailerId} />
            )}
          </div>
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-[var(--color-stone-500)]">
            Complete the look
          </p>
          <ul className="flex flex-col divide-y divide-[var(--color-stone-100)]">
            {[featured, ...pieces].map((piece) => (
              <li
                key={piece.id}
                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="relative h-14 w-12 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-[var(--color-stone-100)]">
                  {piece.imageUrl ? (
                    <Image
                      src={piece.imageUrl}
                      alt=""
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {piece.displayName}
                  </p>
                  <p className="text-xs text-[var(--color-stone-500)]">
                    {piece.owned
                      ? "Already in your wardrobe"
                      : (piece.priceLabel ?? "Ask your advisor for pricing")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {!piece.owned && piece.saveVariantId ? (
                    <form action={saveMorningRoutinePick}>
                      <input
                        type="hidden"
                        name="selectionId"
                        value={selectionId}
                      />
                      <input
                        type="hidden"
                        name="recommendationId"
                        value={piece.id}
                      />
                      <input type="hidden" name="action" value="save" />
                      <input
                        type="hidden"
                        name="retailerId"
                        value={retailerId}
                      />
                      <input
                        type="hidden"
                        name="productVariantId"
                        value={piece.saveVariantId}
                      />
                      <button
                        type="submit"
                        className={buttonVariants({
                          variant: "outline",
                          size: "sm",
                        })}
                      >
                        Save
                      </button>
                    </form>
                  ) : null}
                  {!piece.owned ? (
                    <BuyButton
                      retailerId={retailerId}
                      piece={piece}
                      oneTapEligible={oneTapEligible}
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
