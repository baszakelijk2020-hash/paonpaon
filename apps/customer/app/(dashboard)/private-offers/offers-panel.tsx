import type { PrivateOfferGroup } from "./actions";

interface OffersPanelProps {
  readonly group: PrivateOfferGroup;
}

export function OffersPanel({ group }: OffersPanelProps) {
  if (group.eligibleOffers.length === 0) {
    return (
      <p role="status" className="text-sm text-[var(--color-stone-500)]">
        No private offers match your consent and membership profile today.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-[var(--color-stone-100)] rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white">
      {group.eligibleOffers.map((offer) => (
        <li key={offer.id} className="px-5 py-4">
          <p className="font-medium text-[var(--color-stone-900)]">
            {offer.title}
          </p>
          {offer.description ? (
            <p className="mt-1 text-sm text-[var(--color-stone-600)]">
              {offer.description}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-[var(--color-stone-500)]">
            {offer.scheduleFrequency} delivery · personalization consent
            required
          </p>
        </li>
      ))}
    </ul>
  );
}
