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
    <Link href={piece.buyHref} prefetch={false} className="customer-button">
      Buy
    </Link>
  );
}

export function MorningRoutineDashboardHero({
  retailerId,
  retailerSlug,
  selectionId,
  nextAppointmentHref,
  oneTapEligible,
  featured,
}: MorningRoutineDashboardHeroProps) {
  return (
    <section aria-label="Outfit of the day" className="paon-overview-look">
      <div className="paon-overview-look-copy">
        <div>
          <p className="paon-overview-look-label">Outfit of the day</p>
          <h2>Consider this today.</h2>
          <p className="paon-overview-look-name">{featured.displayName}</p>
          <p className="paon-overview-look-meta">
            {featured.owned
              ? "Already in your wardrobe"
              : (featured.priceLabel ?? "Selected for you")}
          </p>
        </div>

        <div className="paon-overview-look-actions">
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
            prefetch={false}
            className="customer-button customer-button-light"
          >
            Book appointment
          </Link>
          <Link
            href="/concierge"
            prefetch={false}
            className="customer-button customer-button-light"
          >
            Ask your advisor
          </Link>
        </div>
      </div>

      <div className="paon-overview-look-image">
        {featured.imageUrl ? (
          <Image
            src={featured.imageUrl}
            alt={featured.displayName}
            fill
            priority
            unoptimized
            className="object-contain"
          />
        ) : (
          <div className="paon-overview-look-placeholder">
            Image unavailable
          </div>
        )}
      </div>
    </section>
  );
}
