import { CustomerRepository, WeddingPartyRepository } from "@paon/database";
import { Badge } from "@paon/ui/components/Badge";
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
  const [parties, customers] = await Promise.all([
    new WeddingPartyRepository(supabase).findByRetailer(session.retailerId),
    new CustomerRepository(supabase).findByRetailer(session.retailerId),
  ]);
  const names = new Map(customers.map((item) => [item.id, item.fullName]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
            Wedding Parties
          </h1>
          <p className="text-sm text-[var(--color-stone-500)]">
            Coordinate a groom&rsquo;s party across every member&rsquo;s
            fitting.
          </p>
        </div>
      </div>

      <Card className="paon-reveal divide-y overflow-hidden rounded-[var(--radius-xl)] p-0 shadow-[var(--shadow-elevated)]">
        {parties.map((party) => (
          <Link
            key={party.id}
            href={`/wedding-parties/${party.id}`}
            className="flex items-center justify-between px-6 py-4 hover:bg-[var(--color-stone-50)]"
          >
            <div>
              <p className="font-medium">
                {names.get(party.organizerCustomerId) ?? "Customer"}
              </p>
              <p className="text-sm text-[var(--color-stone-500)]">
                {party.eventDate
                  ? formatDate(party.eventDate, "en-US")
                  : "No date set"}
                {party.venueName ? ` · ${party.venueName}` : ""}
              </p>
            </div>
            <Badge tone={STATUS_TONE[party.status]}>{party.status}</Badge>
          </Link>
        ))}
        {parties.length === 0 ? (
          <p className="p-6 text-sm text-[var(--color-stone-500)]">
            No wedding parties yet — start one from a customer&rsquo;s record.
          </p>
        ) : null}
      </Card>
    </div>
  );
}
