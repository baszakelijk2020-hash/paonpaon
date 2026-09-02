import Image from "next/image";
import Link from "next/link";

import { saveMorningRoutinePick } from "../morning-routine/actions";

import { oneTapBuy } from "./one-tap-actions";

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
  customerFirstName: string;
  selectionId: string;
  nextAppointmentHref?: string;
  oneTapEligible: boolean;
  featured: HeroPiece;
}

function PurchaseAction({
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
    const action = oneTapBuy.bind(null, retailerId, piece.productVariantId);
    return (
      <form action={action}>
        <button type="submit" className="customer-button">
          Buy now
        </button>
      </form>
    );
  }
  return (
    <Link href={piece.buyHref} className="customer-button">
      Buy
    </Link>
  );
}

export function MorningRoutineDashboardHero({
  retailerId,
  retailerSlug,
  customerFirstName,
  selectionId,
  nextAppointmentHref,
  oneTapEligible,
  featured,
}: MorningRoutineDashboardHeroProps) {
  return (
    <section
      aria-label="Outfit of the day"
      className="grid min-h-[520px] overflow-hidden bg-[#eeeae2] lg:grid-cols-[minmax(22rem,0.78fr)_minmax(0,1.22fr)]"
    >
      <div className="flex flex-col justify-between px-7 py-10 sm:px-12 sm:py-14 lg:px-14 lg:py-16">
        <div>
          <p className="customer-kicker text-[#676d64]">Outfit of the day</p>
          <h1 className="mt-5 max-w-lg text-4xl leading-[1.06] text-[#20241f] sm:text-6xl">
            Consider this today, {customerFirstName}.
          </h1>
          <p className="mt-7 max-w-md text-base leading-7 text-[#5f655d]">
            {featured.displayName}
          </p>
          <p className="mt-2 text-sm text-[#767c73]">
            {featured.owned
              ? "Already in your wardrobe"
              : (featured.priceLabel ?? "Selected for you")}
          </p>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          {featured.saveVariantId ? (
            <form action={saveMorningRoutinePick}>
              <input type="hidden" name="selectionId" value={selectionId} />
              <input
                type="hidden"
                name="recommendationId"
                value={featured.id}
              />
              <input type="hidden" name="action" value="save" />
              <input type="hidden" name="retailerId" value={retailerId} />
              <input
                type="hidden"
                name="productVariantId"
                value={featured.saveVariantId}
              />
              <button
                type="submit"
                className="customer-button customer-button-light"
              >
                Save
              </button>
            </form>
          ) : null}
          <PurchaseAction
            retailerId={retailerId}
            piece={featured}
            oneTapEligible={oneTapEligible}
          />
          <Link
            href={nextAppointmentHref ?? `/r/${retailerSlug}/appointments`}
            className="customer-button customer-button-light"
          >
            Book appointment
          </Link>
          <Link
            href="/concierge"
            className="customer-button customer-button-light"
          >
            Ask your advisor
          </Link>
        </div>
      </div>

      <div className="relative min-h-[420px] bg-[#d9d8d0] lg:min-h-0">
        {featured.imageUrl ? (
          <Image
            src={featured.imageUrl}
            alt={featured.displayName}
            fill
            priority
            unoptimized
            className="object-contain p-6 sm:p-10"
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_58%_35%,rgba(160,177,157,0.62),transparent_28%),linear-gradient(135deg,#ece8df,#c8d0c4)]" />
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/30 to-transparent" />
        <p className="font-display absolute bottom-7 left-7 right-7 text-xl leading-tight text-white sm:bottom-10 sm:left-10 sm:text-2xl">
          {featured.displayName}
        </p>
      </div>
    </section>
  );
}
