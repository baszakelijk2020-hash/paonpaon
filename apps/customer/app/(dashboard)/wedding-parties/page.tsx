import {
  CustomerRepository,
  RetailerRepository,
  WeddingPartyRepository,
} from "@paon/database";
import { Badge } from "@paon/ui/components/Badge";
import { buttonVariants } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";
import Link from "next/link";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const STATUS_TONE = {
  planning: "neutral",
  confirmed: "success",
  completed: "success",
  cancelled: "danger",
} as const;

export default async function WeddingPartiesPage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();
  const customers = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  const partyRepo = new WeddingPartyRepository(supabase);
  const retailerRepo = new RetailerRepository(supabase);

  const grouped = await Promise.all(
    customers.map(async (customer) => {
      const parties = await partyRepo.findByCustomer(customer.id);
      const retailer = await retailerRepo.findById(customer.retailerId);
      return { customer, retailer, parties };
    }),
  );
  const rows = grouped.flatMap(({ retailer, parties }) =>
    parties.map((party) => ({ party, retailer })),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-[var(--color-stone-900)]">
            Wedding parties
          </h1>
          <p className="text-sm text-[var(--color-stone-500)]">
            Coordinate fittings for everyone in the party.
          </p>
        </div>
        <Link href="/wedding-parties/new" className={buttonVariants()}>
          Start a party
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="paon-reveal rounded-[var(--radius-lg)] border border-dashed border-[var(--color-stone-300)] px-6 py-16 text-center">
          <p className="text-[var(--color-stone-600)]">
            No wedding parties yet — start one yourself, or your Style Advisor
            can start one for you.
          </p>
        </div>
      ) : (
        <Card className="paon-reveal divide-y divide-[var(--color-stone-100)] overflow-hidden rounded-[var(--radius-xl)] p-0 shadow-[var(--shadow-elevated)]">
          {rows.map(({ party, retailer }) => (
            <Link
              key={party.id}
              href={`/wedding-parties/${party.id}`}
              className="flex items-center justify-between px-6 py-4 hover:bg-[var(--color-stone-50)]"
            >
              <div>
                <p className="font-medium text-[var(--color-stone-900)]">
                  {retailer?.displayName ?? "Retailer"}
                </p>
                <p className="text-sm text-[var(--color-stone-500)]">
                  {party.eventDate
                    ? formatDate(party.eventDate, "en-US")
                    : "No date set"}
                  {party.eventTime ? ` · ${party.eventTime}` : ""}
                  {party.fittingLocation
                    ? ` · Fitting at ${party.fittingLocation}`
                    : party.venueName
                      ? ` · ${party.venueName}`
                      : ""}
                </p>
              </div>
              <Badge tone={STATUS_TONE[party.status]}>{party.status}</Badge>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
