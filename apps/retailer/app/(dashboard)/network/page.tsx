import { CustomerRepository, NetworkRepository } from "@paon/database";
import { retailerRoleAtLeast } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Card } from "@paon/ui/components/Card";
import { redirect } from "next/navigation";

import {
  AttributionDemoPanel,
  CreateListingForm,
  CreatePartnerForm,
  ToggleListingActiveForm,
} from "./network-forms";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function NetworkPage() {
  const session = await requireSession();
  if (!retailerRoleAtLeast(session.retailerRole, "manager")) {
    redirect("/dashboard");
  }

  const supabase = await getSupabaseServerClient();
  const network = new NetworkRepository(supabase);
  const [partners, listings, customers] = await Promise.all([
    network.listPartners(session.retailerId),
    network.listListings(session.retailerId),
    new CustomerRepository(supabase).findByRetailer(session.retailerId),
  ]);

  const partnerById = new Map(partners.map((partner) => [partner.id, partner]));
  const customerOptions = customers.map((customer) => ({
    id: customer.id,
    label: customer.fullName,
  }));
  const partnerOptions = partners.map((partner) => ({
    id: partner.id,
    label: partner.displayName,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
          Lifestyle network
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Every listing carries disclosure text a customer would actually read.
          A partner is only ever told that a pseudonymous ref clicked, converted
          or was refunded — never a name, an email, or a Self-Portrait value.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
            Add a partner
          </h2>
          <div className="mt-3">
            <CreatePartnerForm />
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
            Create a listing
          </h2>
          <div className="mt-3">
            <CreateListingForm partners={partnerOptions} />
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Partners
        </h2>
        {partners.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-stone-500)]">
            No partners yet.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {partners.map((partner) => (
              <li key={partner.id} data-partner-id={partner.id}>
                <span className="font-medium text-[var(--color-stone-900)]">
                  {partner.displayName}
                </span>{" "}
                <span className="text-[var(--color-stone-500)]">
                  ({partner.partnerKey}) — {partner.disclosureText}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="flex flex-col gap-4">
        <h2 className="font-display text-xl text-[var(--color-stone-900)]">
          Listings
        </h2>
        {listings.length === 0 ? (
          <p className="text-sm text-[var(--color-stone-500)]">
            No listings yet — add a partner, then create one above.
          </p>
        ) : (
          listings.map((listing) => {
            const partner = partnerById.get(listing.partnerId);
            return (
              <Card key={listing.id} data-listing-id={listing.id}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-[var(--color-stone-900)]">
                      {listing.title}
                    </h3>
                    <p className="text-xs text-[var(--color-stone-500)]">
                      {partner?.displayName ?? "Unknown partner"} ·{" "}
                      {listing.destinationUrl}
                    </p>
                    {listing.description ? (
                      <p className="mt-1 text-sm text-[var(--color-stone-700)]">
                        {listing.description}
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs italic text-[var(--color-stone-500)]">
                      {partner?.disclosureText}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge tone={listing.active ? "success" : "neutral"}>
                      {listing.active ? "Active" : "Inactive"}
                    </Badge>
                    <ToggleListingActiveForm
                      listingId={listing.id}
                      active={listing.active}
                    />
                  </div>
                </div>

                {listing.active && partner ? (
                  <div className="mt-4 border-t border-[var(--color-stone-200)] pt-4">
                    <h4 className="text-xs font-medium uppercase tracking-wide text-[var(--color-stone-500)]">
                      Attribution demo
                    </h4>
                    <div className="mt-3">
                      <AttributionDemoPanel
                        listingId={listing.id}
                        partnerId={partner.id}
                        customers={customerOptions}
                      />
                    </div>
                  </div>
                ) : null}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
