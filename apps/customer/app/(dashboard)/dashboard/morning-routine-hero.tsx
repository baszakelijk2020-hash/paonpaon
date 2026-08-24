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
    <section className="paon-reveal overflow-hidden bg-[#11110f] text-white">
      <div className="grid min-h-[38rem] lg:grid-cols-[minmax(0,1fr)_minmax(25rem,0.86fr)]">
        <div className="flex flex-col p-6 sm:p-10 lg:p-12">
          <div className="flex flex-wrap items-center justify-between gap-3 text-[10px] uppercase tracking-[0.2em] text-white/60">
            <span>{retailerName} · MorningRoutine</span>
            <span className="flex items-center gap-2">
              {weatherSummary ? <span>{weatherSummary}</span> : null}
              <MorningRoutineClock />
            </span>
          </div>

          <div className="my-auto max-w-3xl py-12 lg:py-16">
            <p className="mb-5 text-base leading-6 text-white/65">
              Good morning, {customerFirstName}.{" "}
              {weatherSummary ? `${weatherSummary} — ` : ""}
              here is one considered place to start.
            </p>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#c9b890]">
              {featured.owned ? "From your wardrobe" : "Today’s look"}
            </p>
            <h1
              className="mt-4 max-w-2xl text-4xl leading-[0.98] tracking-[-0.045em] sm:text-6xl lg:text-7xl"
              style={{ fontFamily: '"Google Flex", sans-serif' }}
            >
              {featured.displayName}
            </h1>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href={nextAppointmentHref ?? `/r/${retailerSlug}`}
                className={buttonVariants({
                  variant: "secondary",
                  size: "lg",
                  className: "min-h-12 px-6",
                })}
              >
                {nextAppointmentHref
                  ? "View next appointment"
                  : "Request an appointment"}
              </Link>
              <Link
                href="/messages"
                className={buttonVariants({
                  variant: "outline",
                  size: "lg",
                  className:
                    "min-h-12 border-white/35 px-6 text-white hover:bg-white/10",
                })}
              >
                Message your advisor
              </Link>
            </div>
          </div>

          <div className="border-white/12 border-t pt-5">
            {oneTapEligible ? (
              <OneTapCheckoutEnabledBadge />
            ) : (
              <OneTapCheckoutBanner retailerId={retailerId} />
            )}
          </div>
        </div>

        <div className="relative min-h-[25rem] border-t border-white/10 lg:border-l lg:border-t-0">
          {featured.imageUrl ? (
            <Image
              src={featured.imageUrl}
              alt=""
              fill
              priority
              unoptimized
              className="object-cover opacity-90"
            />
          ) : null}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent"
          />
          <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/60">
              A quiet beginning
            </p>
            <p className="mt-2 max-w-sm text-sm leading-6 text-white/75">
              A real recommendation built from your wardrobe and the house’s
              collection.
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 bg-[#191815] p-5 sm:p-7 lg:p-8">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#c9b890]">
              Complete the look
            </p>
            <h2 className="mt-2 text-2xl tracking-[-0.03em] text-white sm:text-3xl">
              Keep it simple.
            </h2>
          </div>
          <Link
            href="/morning-routine"
            className="text-sm text-white/70 transition hover:text-white"
          >
            See the full routine →
          </Link>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[featured, ...pieces].slice(0, 4).map((piece) => (
            <li
              key={piece.id}
              className="group flex min-h-28 gap-4 rounded-2xl bg-white/[0.07] p-3 transition-colors hover:bg-white/[0.12]"
            >
              <div className="relative aspect-[4/5] w-16 shrink-0 overflow-hidden rounded-xl bg-white/10">
                {piece.imageUrl ? (
                  <Image
                    src={piece.imageUrl}
                    alt=""
                    fill
                    unoptimized
                    className="object-cover transition duration-500 group-hover:scale-105"
                  />
                ) : null}
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-between py-1">
                <div>
                  <p className="line-clamp-2 text-sm font-medium leading-5 text-white">
                    {piece.displayName}
                  </p>
                  <p className="mt-1 text-xs text-white/50">
                    {piece.owned
                      ? "In your wardrobe"
                      : (piece.priceLabel ?? "Ask for pricing")}
                  </p>
                </div>
                {!piece.owned ? (
                  <div className="flex gap-2">
                    {piece.saveVariantId ? (
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
                          className="text-xs text-white/65 transition hover:text-white"
                        >
                          Save
                        </button>
                      </form>
                    ) : null}
                    <BuyButton
                      retailerId={retailerId}
                      piece={piece}
                      oneTapEligible={oneTapEligible}
                    />
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
