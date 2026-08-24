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
  const productImage =
    featured.imageUrl && !featured.imageUrl.endsWith("/calendar10.png")
      ? featured.imageUrl
      : undefined;

  return (
    <section className="paon-reveal customer-panel-dark overflow-hidden bg-[#11110f] text-white">
      <div className="grid min-h-[31rem] lg:grid-cols-[minmax(0,0.94fr)_minmax(25rem,1.06fr)]">
        <div className="flex flex-col p-7 sm:p-10 lg:p-12">
          <div className="flex flex-wrap items-center justify-between gap-3 text-[10px] uppercase tracking-[0.2em] text-white/60">
            <span>{retailerName} · MorningRoutine</span>
            <span className="flex items-center gap-2">
              {weatherSummary ? <span>{weatherSummary}</span> : null}
              <MorningRoutineClock />
            </span>
          </div>

          <div className="my-auto max-w-2xl py-10 lg:py-12">
            <p className="mb-5 text-base leading-6 text-white/65">
              Good morning, {customerFirstName}.{" "}
              {weatherSummary ? `${weatherSummary} — ` : ""}
              here is one considered place to start.
            </p>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#c9b890]">
              {featured.owned ? "From your wardrobe" : "Today’s look"}
            </p>
            <h1
              className="mt-4 max-w-lg text-4xl leading-[0.96] tracking-[-0.055em] sm:text-5xl lg:text-6xl"
              style={{ fontFamily: '"Google Flex", sans-serif' }}
            >
              Start with the familiar.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-6 text-white/65">
              {featured.displayName}
            </p>
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

        <div
          className="relative min-h-[22rem] overflow-hidden border-t border-white/10 bg-[#18202a] bg-cover bg-center lg:border-l lg:border-t-0"
          style={
            productImage
              ? undefined
              : {
                  backgroundImage:
                    "radial-gradient(circle at 68% 42%, rgba(128, 151, 164, 0.34), transparent 25%), repeating-linear-gradient(124deg, rgba(255,255,255,0.055) 0 1px, transparent 1px 13px), repeating-linear-gradient(56deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 13px)",
                }
          }
        >
          {productImage ? (
            <Image
              src={productImage}
              alt=""
              fill
              priority
              unoptimized
              className="object-cover opacity-95"
            />
          ) : null}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[linear-gradient(115deg,rgba(0,0,0,0.04),rgba(0,0,0,0.3))]"
          />
          <div className="absolute inset-x-0 bottom-0 p-7 sm:p-9">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/75">
              Today’s edit
            </p>
            <p className="mt-2 max-w-sm text-sm leading-6 text-white/80">
              One recommendation, grounded in your wardrobe and the house’s
              collection.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-[#1b1c18] p-7 sm:p-10 lg:p-12">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#c9b890]">
              Complete the look
            </p>
            <h2 className="mt-2 text-3xl tracking-[-0.04em] text-white sm:text-4xl">
              The rest of the story.
            </h2>
          </div>
          <Link
            href="/morning-routine"
            className="text-sm text-white/70 transition hover:text-white"
          >
            See the full routine →
          </Link>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[...pieces, featured].slice(0, 3).map((piece) => (
            <li
              key={piece.id}
              className="group overflow-hidden rounded-[1.4rem] bg-white/[0.07] transition-colors hover:bg-white/[0.12]"
            >
              <div className="relative aspect-[1.32/1] bg-white/10">
                {piece.imageUrl ? (
                  <Image
                    src={piece.imageUrl}
                    alt=""
                    fill
                    unoptimized
                    className="object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-[radial-gradient(circle_at_75%_28%,rgba(163,177,159,0.3),transparent_28%),repeating-linear-gradient(124deg,rgba(255,255,255,0.065)_0_1px,transparent_1px_14px),repeating-linear-gradient(56deg,rgba(255,255,255,0.04)_0_1px,transparent_1px_14px),linear-gradient(135deg,#393b37,#272924)]"
                  />
                )}
              </div>
              <div className="flex min-h-32 flex-col justify-between p-5">
                <div>
                  <p className="line-clamp-2 text-base font-medium leading-5 text-white">
                    {piece.displayName}
                  </p>
                  <p className="mt-2 text-sm text-white/50">
                    {piece.owned
                      ? "In your wardrobe"
                      : (piece.priceLabel ?? "Ask for pricing")}
                  </p>
                </div>
                {!piece.owned ? (
                  <div className="mt-5 flex items-center gap-4">
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
                          className="text-sm text-white/65 transition hover:text-white"
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
